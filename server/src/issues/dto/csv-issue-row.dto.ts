import { IsISO8601, IsOptional } from 'class-validator';
import { CreateIssueDto } from './create-issue.dto';

// CSV-only DTO: shares every field with CreateIssueDto, plus `createdAt`.
export class CsvIssueRowDto extends CreateIssueDto {
  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
