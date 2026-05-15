import { Injectable, NotFoundException } from '@nestjs/common';
import { Issue, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { SEVERITIES, STATUSES, Severity, Status } from './issues.types';

export interface ListResult {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
}

export interface Stats {
  total: number;
  byStatus: Record<Status, number>;
  bySeverity: Record<Severity, number>;
}

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateIssueDto): Promise<Issue> {
    return this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        site: dto.site,
        severity: dto.severity,
        status: dto.status ?? 'open',
      },
    });
  }

  async findAll(query: ListIssuesDto): Promise<ListResult> {
    const { q, status, severity, site, page, limit } = query;
    // SQLite's LIKE is case-insensitive for ASCII by default — so `contains` works
    // without a `mode: 'insensitive'` flag (which Prisma supports only on Postgres/Mongo).
    const where: Prisma.IssueWhereInput = {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(site && { site }),
      ...(q && { title: { contains: q } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.issue.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Issue> {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      throw new NotFoundException(`Issue ${id} not found`);
    }
    return issue;
  }

  async update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    await this.findOne(id);
    return this.prisma.issue.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.issue.delete({ where: { id } });
  }

  async stats(): Promise<Stats> {
    const [statusGroups, severityGroups] = await Promise.all([
      this.prisma.issue.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.issue.groupBy({ by: ['severity'], _count: { _all: true } }),
    ]);

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      Status,
      number
    >;
    const bySeverity = Object.fromEntries(
      SEVERITIES.map((s) => [s, 0]),
    ) as Record<Severity, number>;

    let total = 0;
    for (const row of statusGroups) {
      if ((STATUSES as readonly string[]).includes(row.status)) {
        byStatus[row.status as Status] = row._count._all;
        total += row._count._all;
      }
    }
    for (const row of severityGroups) {
      if ((SEVERITIES as readonly string[]).includes(row.severity)) {
        bySeverity[row.severity as Severity] = row._count._all;
      }
    }

    return { total, byStatus, bySeverity };
  }

  async sites(): Promise<string[]> {
    const rows = await this.prisma.issue.findMany({
      select: { site: true },
      distinct: ['site'],
      orderBy: { site: 'asc' },
    });
    return rows.map((r) => r.site);
  }
}
