import { readFile } from 'node:fs/promises';
import {
  DRIVE_CHUNK_BYTES,
  DRIVE_TOTAL_BYTES,
  DRIVE_UPLOAD_TTL_MS,
  isDrivePreviewableMime,
  normalizeDriveName,
} from '@cuberoot/shared/drive';
import { describe, expect, it } from 'vitest';
import { parseByteRange } from '../src/utils/byte_range.js';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');
const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('Drive contract', () => {
  it('keeps its migration and schema snapshot aligned', async () => {
    const [migration, schema] = await Promise.all([
      read('../migrations/0184_drive.sql'),
      read('../src/db/schema.pg.sql'),
    ]);

    expect(migration).toContain('CREATE TABLE drive_members');
    expect(migration).toContain('CREATE TABLE drive_nodes');
    expect(migration).toContain('CREATE TABLE drive_uploads');
    expect(migration).toContain('expected_bytes <= 21474836480');
    expect(normalizeSql(schema)).toContain(normalizeSql(migration));
  });

  it('locks the 20 GB shared quota and resumable-upload boundaries', () => {
    expect(DRIVE_TOTAL_BYTES).toBe(20 * 1024 * 1024 * 1024);
    expect(DRIVE_CHUNK_BYTES).toBe(8 * 1024 * 1024);
    expect(DRIVE_UPLOAD_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects unsafe names and limits inline preview types', () => {
    expect(normalizeDriveName('  report.pdf  ')).toBe('report.pdf');
    expect(normalizeDriveName('../report.pdf')).toBeNull();
    expect(normalizeDriveName('folder/name')).toBeNull();
    expect(normalizeDriveName('line\nbreak')).toBeNull();
    expect(isDrivePreviewableMime('video/mp4')).toBe(true);
    expect(isDrivePreviewableMime('application/pdf')).toBe(true);
    expect(isDrivePreviewableMime('application/zip')).toBe(false);
  });

  it('parses bounded, open-ended, and suffix download ranges', () => {
    expect(parseByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=-8', 100)).toEqual({ start: 92, end: 99 });
    expect(parseByteRange('bytes=100-', 100)).toBeNull();
    expect(parseByteRange('bytes=0-1,4-5', 100)).toBeNull();
  });

  it('streams chunks and downloads through dedicated proxy locations', async () => {
    const nginx = await read('../../../../ops/nginx/www.cuberoot.me.conf');
    const route = await read('../src/routes/drive.ts');

    expect(nginx).toContain('location ~ ^/v1/drive/uploads/[0-9a-fA-F-]+$');
    expect(nginx).toContain('client_max_body_size 9m');
    expect(nginx).toContain('location ^~ /v1/drive/content/');
    expect(route).toContain("c.req.header('Upload-Checksum')");
    expect(route).toContain("createHash('sha256')");
    expect(route).toContain('pg_advisory_xact_lock');
    expect(route).toContain('cancel active uploads before trashing this item');
    expect(route).toContain("driveRoutes.on('HEAD', '/drive/uploads/:id'");
    expect(route).toContain("driveRoutes.on('HEAD', '/drive/content/:id'");
  });
});
