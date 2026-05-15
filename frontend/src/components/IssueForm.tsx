import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SEVERITIES,
  STATUSES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  CreateIssueInput,
  Issue,
  Severity,
  Status,
} from '@/types';

const schema = z.object({
  title: z.string().trim().min(1, 'Required').max(200),
  description: z.string().trim().min(1, 'Required').max(5000),
  site: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(100)
    .transform((s) => {
      // Accept any case; canonicalise to "Site-<N>" before sending.
      const m = /^site-(\d+)$/i.exec(s);
      return m ? `Site-${m[1]}` : s;
    })
    .refine((s) => /^Site-\d+$/.test(s), 'Format: Site-<number> (e.g. Site-101)'),
  severity: z.enum(SEVERITIES),
  status: z.enum(STATUSES).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Issue;
  onSubmit: (values: CreateIssueInput) => Promise<void> | void;
  submitLabel?: string;
}

export function IssueForm({ defaultValues, onSubmit, submitLabel = 'Save' }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues
      ? {
          title: defaultValues.title,
          description: defaultValues.description,
          site: defaultValues.site,
          severity: defaultValues.severity,
          status: defaultValues.status,
        }
      : {
          title: '',
          description: '',
          site: '',
          severity: 'minor',
        },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        title: defaultValues.title,
        description: defaultValues.description,
        site: defaultValues.site,
        severity: defaultValues.severity,
        status: defaultValues.status,
      });
    }
  }, [defaultValues, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Title" error={form.formState.errors.title?.message}>
        <Input {...form.register('title')} autoFocus />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Textarea rows={4} {...form.register('description')} />
      </Field>
      <Field label="Site" error={form.formState.errors.site?.message}>
        <Input placeholder="Site-101" {...form.register('site')} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Severity" error={form.formState.errors.severity?.message}>
          <Select
            value={form.watch('severity')}
            onValueChange={(v) =>
              form.setValue('severity', v as Severity, { shouldValidate: true, shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {defaultValues && (
          <Field label="Status" error={form.formState.errors.status?.message}>
            <Select
              value={form.watch('status') ?? 'open'}
              onValueChange={(v) =>
                form.setValue('status', v as Status, { shouldValidate: true, shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
          title={!form.formState.isDirty ? 'No changes to save' : undefined}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
