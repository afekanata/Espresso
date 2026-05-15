import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseIssuesCsv } from '../src/issues/csv-parser';

describe('parseIssuesCsv', () => {
  it('parses the sample issues.csv', async () => {
    const buffer = readFileSync(resolve(__dirname, '../../issues.csv'));
    const rows = await parseIssuesCsv(buffer);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      title: 'Missing consent form',
      site: 'Site-101',
      severity: 'major',
      status: 'open',
      createdAt: '2025-05-01T09:00:00Z',
    });
    expect(rows.filter((r) => r.severity === 'critical')).toHaveLength(1);
    expect(new Set(rows.map((r) => r.site))).toEqual(
      new Set(['Site-101', 'Site-202', 'Site-303']),
    );
  });
});
