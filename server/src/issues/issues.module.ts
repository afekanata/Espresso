import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { CsvImportService } from './csv-import.service';

@Module({
  controllers: [IssuesController],
  providers: [IssuesService, CsvImportService],
  exports: [IssuesService, CsvImportService],
})
export class IssuesModule {}
