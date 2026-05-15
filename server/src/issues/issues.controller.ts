import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { IssuesService } from './issues.service';
import { CsvImportService } from './csv-import.service';

@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly csv: CsvImportService,
  ) {}

  @Post()
  create(@Body() dto: CreateIssueDto) {
    return this.issues.create(dto);
  }

  @Get()
  list(@Query() query: ListIssuesDto) {
    return this.issues.findAll(query);
  }

  @Get('stats')
  stats() {
    return this.issues.stats();
  }

  @Get('sites')
  sites() {
    return this.issues.sites();
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: Express.Multer.File) {
    return this.csv.importBuffer(file?.buffer);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.issues.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.issues.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.issues.remove(id);
  }
}
