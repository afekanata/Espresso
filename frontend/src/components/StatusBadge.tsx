import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, Status } from '@/types';

const styles: Record<Status, string> = {
  open: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  in_progress: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  resolved: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
};

export function StatusBadge({ value }: { value: Status }) {
  return (
    <Badge className={cn('border-transparent', styles[value])}>
      {STATUS_LABELS[value]}
    </Badge>
  );
}
