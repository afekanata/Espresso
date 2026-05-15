import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CsvIssueRowDto } from './dto/csv-issue-row.dto';
import { CsvIssueRow, parseIssuesCsv } from './csv-parser';

export interface ImportError {
  row: number;
  messages: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

@Injectable()
export class CsvImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importBuffer(buffer: Buffer | undefined): Promise<ImportResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException(
        'CSV file is required (multipart field name: "file").',
      );
    }

    let rows: CsvIssueRow[];
    try {
      rows = await parseIssuesCsv(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown CSV parse error';
      throw new BadRequestException(`Invalid CSV: ${message}`);
    }

    const errors: ImportError[] = [];
    const valid: CsvIssueRowDto[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { dto, messages } = await this.validateRow(rows[i]);
      if (messages.length > 0) {
        // +2 = +1 for 1-indexed rows + 1 for the header line
        errors.push({ row: i + 2, messages });
        continue;
      }
      valid.push(dto);
    }

    if (valid.length === 0) {
      return { imported: 0, skipped: rows.length, errors };
    }

    await this.prisma.$transaction(
      valid.map((row) =>
        this.prisma.issue.create({
          data: {
            title: row.title,
            description: row.description,
            site: row.site,
            severity: row.severity,
            status: row.status ?? 'open',
            // `createdAt` arrives as an ISO string from the CSV; Prisma needs Date.
            ...(row.createdAt ? { createdAt: new Date(row.createdAt) } : {}),
          },
        }),
      ),
    );

    return {
      imported: valid.length,
      skipped: rows.length - valid.length,
      errors,
    };
  }

  private async validateRow(
    row: CsvIssueRow,
  ): Promise<{ dto: CsvIssueRowDto; messages: string[] }> {
    const dto = plainToInstance(CsvIssueRowDto, {
      title: row.title,
      description: row.description,
      site: row.site,
      severity: row.severity,
      status: row.status || undefined,
      createdAt: row.createdAt || undefined,
    });

    const validationErrors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    const messages = validationErrors.flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );

    return { dto, messages };
  }
}
