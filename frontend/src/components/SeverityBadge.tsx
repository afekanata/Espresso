import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITY_LABELS, Severity } from '@/types';

const styles: Record<Severity, string> = {
  minor: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  major: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  critical: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export function SeverityBadge({ value }: { value: Severity }) {
  return (
    <Badge className={cn('border-transparent', styles[value])}>
      {SEVERITY_LABELS[value]}
    </Badge>
  );
}
