import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SEVERITIES, STATUSES, Severity, Status } from '../issues.types';

export class ListIssuesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(STATUSES as readonly string[])
  status?: Status;

  @IsOptional()
  @IsIn(SEVERITIES as readonly string[])
  severity?: Severity;

  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
