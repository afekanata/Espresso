import { parse } from 'csv-parse';
import { Readable } from 'stream';

export interface CsvIssueRow {
  title?: string;
  description?: string;
  site?: string;
  severity?: string;
  status?: string;
  createdAt?: string;
}

export function parseIssuesCsv(buffer: Buffer): Promise<CsvIssueRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvIssueRow[] = [];
    const parser = parse({
      columns: true,
      trim: true,
      skip_empty_lines: true,
      bom: true,
    });
    parser.on('readable', () => {
      let record: CsvIssueRow | null;
      while ((record = parser.read())) {
        rows.push(record);
      }
    });
    parser.on('error', reject);
    parser.on('end', () => resolve(rows));
    Readable.from(buffer).pipe(parser);
  });
}
