import { auth } from '@/lib/auth';
import type {
  CreateIssueInput,
  ImportResult,
  Issue,
  IssueList,
  IssueStats,
  ListIssuesQuery,
  UpdateIssueInput,
} from '@/types';

const BASE = '/api';

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  username: string;
}

export class ApiError extends Error {
  statusCode: number;
  fieldMessages: string[];
  constructor(message: string, statusCode: number, fieldMessages: string[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.fieldMessages = fieldMessages;
  }
}

function authHeader(): Record<string, string> {
  const token = auth.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

// Called when any non-login request comes back 401 — token must be missing,
// expired, or revoked, so we drop it and bounce to /login. Hard navigation
// because we don't want a stale React Query cache lingering for the new user.
function handleUnauthorized(path: string) {
  if (path.startsWith('/auth/')) return;
  auth.clear();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) handleUnauthorized(path);
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  if (!res.ok) {
    const message =
      typeof payload === 'object' && payload?.error ? payload.error : `Request failed (${res.status})`;
    const fieldMessages =
      typeof payload === 'object' && Array.isArray(payload?.message)
        ? payload.message
        : typeof payload === 'object' && typeof payload?.message === 'string'
          ? [payload.message]
          : [];
    throw new ApiError(message, res.status, fieldMessages);
  }
  return payload as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listIssues(query: ListIssuesQuery = {}): Promise<IssueList> {
    return fetchJson(`/issues${buildQuery({ ...query })}`);
  },
  getIssue(id: string): Promise<Issue> {
    return fetchJson(`/issues/${id}`);
  },
  createIssue(input: CreateIssueInput): Promise<Issue> {
    return fetchJson('/issues', { method: 'POST', body: JSON.stringify(input) });
  },
  updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    return fetchJson(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  deleteIssue(id: string): Promise<void> {
    return fetchJson(`/issues/${id}`, { method: 'DELETE' });
  },
  stats(): Promise<IssueStats> {
    return fetchJson('/issues/stats');
  },
  sites(): Promise<string[]> {
    return fetchJson('/issues/sites');
  },
  async importCsv(file: File): Promise<ImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    // Don't set content-type — fetch picks the multipart boundary itself.
    const res = await fetch(`${BASE}/issues/import`, {
      method: 'POST',
      body: fd,
      headers: authHeader(),
    });
    if (res.status === 401) handleUnauthorized('/issues/import');
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new ApiError(payload?.error ?? 'Import failed', res.status, payload?.message ?? []);
    }
    return res.json();
  },
  login(input: LoginInput): Promise<LoginResponse> {
    return fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
