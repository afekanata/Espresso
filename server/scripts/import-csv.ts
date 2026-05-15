import 'dotenv/config';
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CsvImportService } from '../src/issues/csv-import.service';

/**
 * One-shot seed script — reads a CSV file from disk and feeds it through the
 * same import pipeline as the HTTP endpoint. Usage:
 *   pnpm --filter server run csv:import [path/to/issues.csv]
 * Defaults to `../issues.csv` (the sample at the repo root).
 */
async function main(): Promise<void> {
  const csvPath = resolve(process.argv[2] ?? '../issues.csv');
  const buffer = readFileSync(csvPath);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const importer = app.get(CsvImportService);
    const result = await importer.importBuffer(buffer);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
