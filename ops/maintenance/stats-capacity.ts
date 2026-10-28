import { execFileSync } from 'node:child_process';
import { statfsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GiB = 1024 ** 3;

export function capacityReport(available: number, historyHeap: number) {
  if (![available, historyHeap].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid disk capacity measurement');
  // Early admission only: 8 GiB floor covers the observed 5.08 GiB staging
  // requirement plus uploads/concurrent growth. Scale with the existing history
  // heap, reserving 1 GiB safety and 2 GiB for uploads/growth. The importer still
  // performs exact source-size and changed-row/WAL checks immediately before use.
  const required = Math.max(8 * GiB, Math.ceil(historyHeap * 1.75) + 3 * GiB);
  return { available, required, historyHeap, admitted: available >= required };
}

export function checkServerCapacity() {
  const command = (file: string, args: string[]) => execFileSync(file, args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 ** 2 }).trim();
  const result = command('sudo', ['-u', 'postgres', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-d', 'cuberoot_db', '-c',
    "SELECT json_build_object('dataDirectory', current_setting('data_directory'), 'historyHeap', GREATEST(pg_table_size('historical_ranks_snapshot'), pg_table_size('historical_ranks_monthly_snapshot')));"]);
  const { dataDirectory, historyHeap } = JSON.parse(result);
  if (typeof dataDirectory !== 'string' || !dataDirectory.startsWith('/')) throw new Error('Invalid PostgreSQL data directory');
  // The exact importer currently measures /tmp. Refuse to claim protection when
  // PG data, WAL or tablespaces live on a different filesystem.
  const device = statSync('/tmp').dev;
  for (const path of [dataDirectory, `${dataDirectory}/pg_wal`]) {
    if (statSync(path).dev !== device) throw new Error('PostgreSQL and import directory must share a filesystem; update both capacity checks before migrating storage');
  }
  const tablespaces = command('sudo', ['-u', 'postgres', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-d', 'cuberoot_db', '-c',
    "SELECT pg_tablespace_location(oid) FROM pg_tablespace WHERE pg_tablespace_location(oid) <> '';"]);
  for (const path of tablespaces.split('\n').filter(Boolean)) if (statSync(path).dev !== device) throw new Error('Unaccounted PostgreSQL tablespace filesystem');
  const disk = statfsSync('/tmp');
  const report = capacityReport(disk.bavail * disk.bsize, historyHeap);
  console.log(JSON.stringify(report));
  console.log(command('df', ['-h', '/tmp', dataDirectory]));
  console.log(command('du', ['-xsh', '/root/core-api/releases', '/root/core-api/artifacts', '/root/core-api/.drive-storage', '/www/wwwroot/toolkit', '/var/lib/pgsql', '/var/log', '/tmp']));
  if (!report.admitted) throw new Error(`Insufficient server disk space before WCA computation: available=${report.available}, required=${report.required}; reclaim old releases or expand storage. Import-time checks remain mandatory.`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkServerCapacity();
