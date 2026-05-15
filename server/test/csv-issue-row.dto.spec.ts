import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CsvIssueRowDto } from '../src/issues/dto/csv-issue-row.dto';

describe('CsvIssueRowDto validation', () => {
  const base = {
    title: 'Late visit',
    description: 'Visit week 4 occurred on week 6',
    site: 'Site-202',
    severity: 'minor',
  } as const;

  it('accepts a row with a valid ISO createdAt', async () => {
    const dto = plainToInstance(CsvIssueRowDto, {
      ...base,
      createdAt: '2025-05-03T12:30:00Z',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('accepts a row without createdAt (optional)', async () => {
    const dto = plainToInstance(CsvIssueRowDto, base);
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a malformed createdAt', async () => {
    const dto = plainToInstance(CsvIssueRowDto, {
      ...base,
      createdAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'createdAt')).toBe(true);
  });

  it('still enforces inherited rules (bad severity)', async () => {
    const dto = plainToInstance(CsvIssueRowDto, {
      ...base,
      severity: 'catastrophic',
      createdAt: '2025-05-03T12:30:00Z',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'severity')).toBe(true);
  });
});
