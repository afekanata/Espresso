import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import {
  SEVERITIES,
  STATUSES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  Severity,
  Status,
} from '@/types';

export interface FilterState {
  q: string;
  status?: Status;
  severity?: Severity;
  site?: string;
}

// Radix Select can't use "" as a value, so we use a sentinel for "all".
const ALL = '__all__';

interface Props {
  value: FilterState;
  onChange: (v: FilterState) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function Filters({ value, onChange }: Props) {
  const { data: sites = [] } = useQuery({
    queryKey: queryKeys.sites,
    queryFn: () => api.sites(),
  });
  const isDirty = !!(value.q || value.status || value.severity || value.site);

  // Two-layer search state: `localQ` drives the input for instant feedback;
  // changes are committed to the parent (and the URL) only after the user
  // stops typing for SEARCH_DEBOUNCE_MS, so we don't spam network requests.
  const [localQ, setLocalQ] = useState(value.q);

  // Refs hold the latest props so the debounced commit always reads the
  // current filters/onChange — avoids overwriting a status/site change that
  // happened mid-typing, and avoids resetting the timer on every parent render.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  // Commit localQ to the parent after a quiet period.
  useEffect(() => {
    if (localQ === valueRef.current.q) return;
    const t = setTimeout(() => {
      onChangeRef.current({ ...valueRef.current, q: localQ });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [localQ]);

  // External clears (Clear button, back/forward navigation) sync back in.
  useEffect(() => {
    setLocalQ(value.q);
  }, [value.q]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search by title…"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
        />
      </div>
      <FilterSelect
        placeholder="Status"
        value={value.status}
        onChange={(v) => onChange({ ...value, status: v as Status | undefined })}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <FilterSelect
        placeholder="Severity"
        value={value.severity}
        onChange={(v) => onChange({ ...value, severity: v as Severity | undefined })}
        options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
      />
      <FilterSelect
        placeholder="Site"
        value={value.site}
        onChange={(v) => onChange({ ...value, site: v })}
        options={sites.map((s) => ({ value: s, label: s }))}
      />
      {isDirty && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ q: '' })}>
          Clear
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
