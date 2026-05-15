import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SEVERITIES, STATUSES, Severity, Status } from '../issues.types';

// Spec examples are all "Site-<number>" (Site-101, Site-202, Site-303). We
// enforce that pattern so malformed CSV rows and bad client payloads are
// rejected with a clear message at the API edge.
export const SITE_PATTERN = /^Site-\d+$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Trim + case-normalize a site value (Postel's law: liberal on input, canonical
// on storage). "site-101" / "SITE-101" / "Site-101" all become "Site-101"; any
// non-matching string is passed through unchanged so @Matches can still reject it.
const normalizeSite = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const m = /^site-(\d+)$/i.exec(trimmed);
  return m ? `Site-${m[1]}` : trimmed;
};

export class CreateIssueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trim)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @Transform(trim)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(normalizeSite)
  @Matches(SITE_PATTERN, {
    message: 'site must match the format "Site-<number>" (e.g. Site-101)',
  })
  site!: string;

  @IsIn(SEVERITIES as readonly string[])
  severity!: Severity;

  @IsOptional()
  @IsIn(STATUSES as readonly string[])
  status?: Status;
}
