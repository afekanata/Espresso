import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIssueDto } from '../src/issues/dto/create-issue.dto';

describe('CreateIssueDto validation', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 'Late visit',
      description: 'Visit week 4 occurred on week 6',
      site: 'Site-202',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a missing title', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      description: 'something happened',
      site: 'Site-1',
      severity: 'minor',
    });
    const errors = await validate(dto);
    const titleError = errors.find((e) => e.property === 'title');
    expect(titleError).toBeDefined();
  });

  it('rejects an unknown severity', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 't',
      description: 'd',
      site: 's',
      severity: 'catastrophic',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'severity')).toBe(true);
  });

  it('trims whitespace and rejects whitespace-only fields', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: '   ',
      description: 'd',
      site: 'Site-1',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects a malformed site (must match Site-<number>)', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 't',
      description: 'd',
      site: 'free text site',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'site')).toBe(true);
  });

  it('accepts a well-formed site (Site-<number>)', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 't',
      description: 'd',
      site: 'Site-303',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('normalises site casing on input (site-303 → Site-303)', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 't',
      description: 'd',
      site: 'site-303',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect(dto.site).toBe('Site-303');
  });

  it('normalises shouty site casing too (SITE-101 → Site-101)', async () => {
    const dto = plainToInstance(CreateIssueDto, {
      title: 't',
      description: 'd',
      site: '  SITE-101  ',
      severity: 'minor',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect(dto.site).toBe('Site-101');
  });
});
