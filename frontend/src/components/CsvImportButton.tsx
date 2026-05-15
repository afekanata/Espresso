import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function CsvImportButton() {
  const fileInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { mutateAsync } = useMutation({
    mutationFn: (file: File) => api.importCsv(file),
  });

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const result = await mutateAsync(file);
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.issues.all }),
        qc.invalidateQueries({ queryKey: queryKeys.stats }),
        qc.invalidateQueries({ queryKey: queryKeys.sites }),
      ]);
      const skippedSuffix = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
      toast.success(
        `Imported ${result.imported} issue${result.imported === 1 ? '' : 's'}${skippedSuffix}`,
        {
          description:
            result.errors.length > 0
              ? `Row errors: ${result.errors
                  .map((er) => `#${er.row}: ${er.messages[0]}`)
                  .join(' • ')}`
              : undefined,
        },
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.fieldMessages[0] ?? err.message)
          : (err as Error).message;
      toast.error('Import failed', { description: message });
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => fileInput.current?.click()}
        disabled={loading}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
