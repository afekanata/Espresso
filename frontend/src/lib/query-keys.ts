import type { ListIssuesQuery } from '@/types';

// Central registry for TanStack Query keys.
// Each entry is `as const` so the literal types survive (e.g. `queryKeys.issues.all`
// is `readonly ['issues']`, not `string[]`). Hierarchy is explicit so a single
// invalidate({ queryKey: queryKeys.issues.all }) refreshes every issues-related entry.
export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    list: (q: ListIssuesQuery) => ['issues', 'list', q] as const,
    detail: (id: string) => ['issues', 'detail', id] as const,
  },
  stats: ['stats'] as const,
  sites: ['sites'] as const,
} as const;
