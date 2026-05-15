import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { SEVERITIES, STATUSES, SEVERITY_LABELS, STATUS_LABELS } from '@/types';

const statusColor: Record<string, string> = {
  open: 'text-blue-700',
  in_progress: 'text-violet-700',
  resolved: 'text-emerald-700',
};

const severityColor: Record<string, string> = {
  minor: 'text-slate-700',
  major: 'text-amber-700',
  critical: 'text-red-700',
};

export function DashboardPage() {
  const stats = useQuery({ queryKey: queryKeys.stats, queryFn: () => api.stats() });

  if (stats.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!stats.data) {
    return <div className="text-sm text-muted-foreground">Failed to load stats.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {stats.data.total} issue{stats.data.total === 1 ? '' : 's'} tracked.
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">By status</h3>
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map((s) => (
            <Card key={s}>
              <CardHeader className="pb-2">
                <CardDescription>{STATUS_LABELS[s]}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-semibold ${statusColor[s]}`}>
                  {stats.data.byStatus[s]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">By severity</h3>
        <div className="grid grid-cols-3 gap-4">
          {SEVERITIES.map((s) => (
            <Card key={s}>
              <CardHeader className="pb-2">
                <CardDescription>{SEVERITY_LABELS[s]}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-semibold ${severityColor[s]}`}>
                  {stats.data.bySeverity[s]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
