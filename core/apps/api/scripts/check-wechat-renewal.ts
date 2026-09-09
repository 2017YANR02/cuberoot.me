/** From core/: pnpm --filter @cuberoot/server exec tsx scripts/check-wechat-renewal.ts [--db]
 * Reads inherited environment only; does not load or modify .env, contact WeChat, or print values.
 * --db additionally checks an explicitly configured loopback PostgreSQL schema in a read-only transaction.
 * Exit 1 is intentional: these limited checks can never certify full auto-renewal launch readiness.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  checkRenewalEnvironment, checkLocalDatabaseEnvironment, checkRenewalSchema,
  renewalReadinessReport, RENEWAL_MIGRATION, type ReadinessCheck, type RenewalColumn,
} from '../src/payment/wechat-renewal-readiness.js';

async function main() {
  const args = process.argv.slice(2);
  const checks: ReadinessCheck[] = checkRenewalEnvironment(process.env);
  if (args.some((arg) => arg !== '--db') || args.length > 1) {
    checks.push({ name: 'arguments_expected_optional_db_flag', status: 'invalid' });
  } else if (!args.includes('--db')) {
    checks.push({ name: 'database_explicit_db_flag_required', status: 'skipped' });
  } else {
    const databaseChecks = checkLocalDatabaseEnvironment(process.env);
    checks.push(...databaseChecks);
    if (databaseChecks.every((check) => check.status === 'present')) {
      try {
        // Keep the shared production pool out of this script: it is not read-only or loopback-only.
        const { default: postgres } = await import('postgres');
        const expectedHash = createHash('sha256').update(await readFile(new URL(`../migrations/${RENEWAL_MIGRATION}`, import.meta.url))).digest('hex');
        const sql = postgres({
          host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
          password: process.env.DB_PASS, database: process.env.DB_NAME,
          max: 1, connect_timeout: 5, idle_timeout: 1,
          connection: { application_name: 'wechat-renewal-local-readiness', default_transaction_read_only: true, statement_timeout: 5000 },
          onnotice: () => {},
        });
        try {
          const databaseResult = await sql.begin('read only', async (tx) => {
            const columns = await tx<RenewalColumn[]>`
              SELECT column_name, data_type, is_nullable FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'membership_contracts'`;
            const ledger = await tx`SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = '_schema_migrations'`;
            const migration = ledger.length ? await tx<{ sha256: string }[]>`
              SELECT sha256 FROM public._schema_migrations WHERE filename = ${RENEWAL_MIGRATION}` : [];
            return checkRenewalSchema(columns, !migration.length ? 'missing' : migration[0].sha256 === expectedHash ? 'verified' : 'mismatch');
          });
          checks.push(...databaseResult);
        } finally { await sql.end({ timeout: 1 }); }
      } catch {
        // Driver/file errors may contain connection details. Emit a fixed label, never the exception.
        checks.push({ name: 'database_schema_check', status: 'unavailable' });
      }
    }
  }
  console.log(JSON.stringify(renewalReadinessReport(checks), null, 2));
  process.exitCode = 1;
}
main().catch(() => {
  console.log(JSON.stringify(renewalReadinessReport([{ name: 'local_precheck', status: 'unavailable' }]), null, 2));
  process.exitCode = 1;
});
