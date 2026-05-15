import { ArrowDown, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Issue } from '@/types';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';

interface Props {
  issues: Issue[];
  loading: boolean;
  onEdit: (issue: Issue) => void;
  onResolve: (issue: Issue) => void;
  onDelete: (issue: Issue) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function IssuesTable({ issues, loading, onEdit, onResolve, onDelete }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No issues found. Create one above, or import a CSV to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <Th>Title</Th>
            <Th>Site</Th>
            <Th>Severity</Th>
            <Th>Status</Th>
            <Th
              aria-sort="descending"
              title="Sorted by created date, newest first"
            >
              <span className="inline-flex items-center gap-1">
                Created
                <ArrowDown
                  className="h-3 w-3 opacity-60"
                  aria-hidden="true"
                />
              </span>
            </Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} className="border-t hover:bg-muted/30">
              <Td>
                <div className="font-medium">{issue.title}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">
                  {issue.description}
                </div>
              </Td>
              <Td>{issue.site}</Td>
              <Td>
                <SeverityBadge value={issue.severity} />
              </Td>
              <Td>
                <StatusBadge value={issue.status} />
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {formatDate(issue.createdAt)}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(issue)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onResolve(issue)}
                  disabled={issue.status === 'resolved'}
                  aria-label="Resolve"
                  title={issue.status === 'resolved' ? 'Already resolved' : 'Mark resolved'}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(issue)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground ${className ?? ''}`}
      {...rest}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
