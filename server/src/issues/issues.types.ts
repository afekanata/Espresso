export const SEVERITIES = ['minor', 'major', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type Status = (typeof STATUSES)[number];
