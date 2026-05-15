import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Filters, FilterState } from '@/components/Filters';
import { IssuesTable } from '@/components/IssuesTable';
import { IssueForm } from '@/components/IssueForm';
import { CsvImportButton } from '@/components/CsvImportButton';
import { Pagination } from '@/components/Pagination';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import {
  CreateIssueInput,
  Issue,
  ListIssuesQuery,
  SEVERITIES,
  STATUSES,
  Severity,
  Status,
  UpdateIssueInput,
} from '@/types';

// URL <-> FilterState bridge. Unknown/garbage values are dropped silently so a
// bookmarked URL with stale enum values still loads (rather than throwing).
function parseFilters(searchParams: URLSearchParams): FilterState {
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');
  return {
    q: searchParams.get('q') ?? '',
    status:
      status && (STATUSES as readonly string[]).includes(status)
        ? (status as Status)
        : undefined,
    severity:
      severity && (SEVERITIES as readonly string[]).includes(severity)
        ? (severity as Severity)
        : undefined,
    site: searchParams.get('site') || undefined,
  };
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get('page') ?? 1);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

function buildSearchParams(filters: FilterState, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.site) params.set('site', filters.site);
  // page=1 is the default — omit from URL to keep it clean.
  if (page > 1) params.set('page', String(page));
  return params;
}

const PAGE_LIMIT = 20;

export function IssuesPage() {
  const qc = useQueryClient();
  // Filters live in the URL so reload / bookmark / back-button all work.
  // `replace: true` keeps the back button useful (one history entry per
  // navigation, not one per keystroke).
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const page = parsePage(searchParams);

  // Changing filters resets to page 1 — without that, a user on page 5
  // applying a filter could land on a page that no longer exists.
  const setFilters = (next: FilterState) => {
    setSearchParams(buildSearchParams(next, 1), { replace: true });
  };

  const setPage = (next: number) => {
    setSearchParams(buildSearchParams(filters, next), { replace: true });
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [deleting, setDeleting] = useState<Issue | null>(null);

  const query: ListIssuesQuery = {
    q: filters.q || undefined,
    status: filters.status,
    severity: filters.severity,
    site: filters.site,
    page,
    limit: PAGE_LIMIT,
  };

  const list = useQuery({
    queryKey: queryKeys.issues.list(query),
    queryFn: () => api.listIssues(query),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.issues.all });
    void qc.invalidateQueries({ queryKey: queryKeys.stats });
    void qc.invalidateQueries({ queryKey: queryKeys.sites });
  };

  const handleError = (err: unknown) => {
    const message =
      err instanceof ApiError
        ? (err.fieldMessages[0] ?? err.message)
        : (err as Error).message;
    toast.error(message);
  };

  const create = useMutation({
    mutationFn: (input: CreateIssueInput) => api.createIssue(input),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast.success('Issue created');
    },
    onError: handleError,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIssueInput }) =>
      api.updateIssue(id, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success('Issue updated');
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIssue(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success('Issue deleted');
    },
    onError: handleError,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Issues</h2>
        <div className="flex gap-2">
          <CsvImportButton />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New issue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create issue</DialogTitle>
                <DialogDescription>
                  Log a new issue observed during the site visit.
                </DialogDescription>
              </DialogHeader>
              <IssueForm
                onSubmit={async (v) => {
                  await create.mutateAsync(v);
                }}
                submitLabel="Create"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Filters value={filters} onChange={setFilters} />

      <IssuesTable
        issues={list.data?.items ?? []}
        loading={list.isLoading}
        onEdit={setEditing}
        onResolve={(issue) =>
          update.mutate({ id: issue.id, input: { status: 'resolved' } })
        }
        onDelete={setDeleting}
      />

      {list.data && (
        <Pagination
          page={list.data.page}
          limit={list.data.limit}
          total={list.data.total}
          onPageChange={setPage}
        />
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit issue</DialogTitle>
          </DialogHeader>
          {editing && (
            <IssueForm
              defaultValues={editing}
              onSubmit={async (v) => {
                await update.mutateAsync({ id: editing.id, input: v });
              }}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete issue?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes "{deleting?.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
