import {
  applyDecorators,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

// Hard ceiling on uploaded CSV size. 5 MB is ~25k rows at ~200B/row, which
// comfortably covers a year of clinical trial issues per site. Anything bigger
// belongs on a batched/admin ingest pipeline, not a synchronous HTTP request.
export const CSV_MAX_BYTES = 5 * 1024 * 1024;

// There is no canonical CSV mimetype — Excel, LibreOffice, browsers, and curl
// all disagree. Allow the realistic set rather than rejecting valid uploads on
// a mimetype technicality. The CSV parser itself is the real content check.
const CSV_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'text/plain',
]);

/**
 * Method decorator for the CSV import endpoint. Bundles the file-size limit,
 * single-file constraint, and mimetype filter into one call so the controller
 * stays readable.
 */
export function CsvUpload(field = 'file'): MethodDecorator {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(field, {
        limits: { fileSize: CSV_MAX_BYTES, files: 1 },
        fileFilter: (_req, file, cb) => {
          if (!CSV_MIMETYPES.has(file.mimetype)) {
            cb(
              new BadRequestException(
                `Unsupported file type "${file.mimetype}". Upload a .csv file.`,
              ),
              false,
            );
            return;
          }
          cb(null, true);
        },
      }),
    ),
  );
}
