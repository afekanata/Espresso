export const SEVERITIES = ['minor', 'major', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type Status = (typeof STATUSES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export interface Issue {
  id: string;
  title: string;
  description: string;
  site: string;
  severity: Severity;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface IssueList {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
}

export interface IssueStats {
  total: number;
  byStatus: Record<Status, number>;
  bySeverity: Record<Severity, number>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; messages: string[] }>;
}

export interface ListIssuesQuery {
  q?: string;
  status?: Status;
  severity?: Severity;
  site?: string;
  page?: number;
  limit?: number;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  site: string;
  severity: Severity;
  status?: Status;
}

export type UpdateIssueInput = Partial<CreateIssueInput>;
