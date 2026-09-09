import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkRenewalEnvironment, checkLocalDatabaseEnvironment, checkRenewalSchema,
  renewalReadinessReport, RENEWAL_COLUMNS, RENEWAL_MIGRATION,
} from '../src/payment/wechat-renewal-readiness.js';

const valid = {
  WECHAT_PAPAY_APPID: 'wx0123456789abcdef', WECHAT_PAPAY_MCHID: '1234567890',
  WECHAT_PAPAY_API_V2_KEY: '0123456789abcdef0123456789abcdef',
};
const database = { DB_HOST: '127.0.0.1', DB_PORT: '5433', DB_USER: 'fixture', DB_PASS: 'fixture-secret', DB_NAME: 'fixture-db' };
const columns = Object.entries(RENEWAL_COLUMNS).map(([column_name, [data_type, is_nullable]]) => ({ column_name, data_type, is_nullable }));

describe('local WeChat renewal readiness', () => {
  it('checks syntax without returning any credential values', () => {
    const checks = checkRenewalEnvironment(valid);
    expect(checks.map((item) => item.status)).toEqual(['present', 'present', 'present']);
    const output = JSON.stringify(renewalReadinessReport(checks));
    for (const value of Object.values(valid)) expect(output).not.toContain(value);
    expect(output).not.toContain('fixture-secret');
  });
  it('does not treat APIv3 credentials as APIv2 papay credentials', () => {
    expect(checkRenewalEnvironment({ WECHAT_API_V3_KEY: valid.WECHAT_PAPAY_API_V2_KEY }).map((item) => item.status))
      .toEqual(['missing', 'missing', 'missing']);
  });
  it.each([
    ['WECHAT_PAPAY_APPID', 'wxshort'], ['WECHAT_PAPAY_APPID', `${valid.WECHAT_PAPAY_APPID} `],
    ['WECHAT_PAPAY_MCHID', '-123'], ['WECHAT_PAPAY_API_V2_KEY', 'x'.repeat(31)],
    ['WECHAT_PAPAY_API_V2_KEY', '!'.repeat(32)],
  ])('rejects malformed %s', (name, value) => {
    expect(checkRenewalEnvironment({ ...valid, [name]: value }).find((item) => item.name === name)?.status).toBe('invalid');
  });
  it('requires all DB values and accepts only explicit loopback literals', () => {
    expect(checkLocalDatabaseEnvironment({}).every((item) => item.status === 'missing')).toBe(true);
    expect(checkLocalDatabaseEnvironment(database).every((item) => item.status === 'present')).toBe(true);
    expect(checkLocalDatabaseEnvironment({ ...database, DB_HOST: '::1' })[0].status).toBe('present');
    for (const host of ['db.example.test', 'localhost', '/tmp/socket', '127.0.0.1,db.example.test']) {
      expect(checkLocalDatabaseEnvironment({ ...database, DB_HOST: host })[0].status).toBe('invalid');
    }
  });
  it.each(['0', '65536', '123junk', '-1'])('rejects invalid DB port %s', (DB_PORT) => {
    expect(checkLocalDatabaseEnvironment({ ...database, DB_PORT })[1].status).toBe('invalid');
  });
  it('checks every required column, type, nullability and migration ledger', () => {
    expect(checkRenewalSchema(columns, 'verified').every((item) => item.status === 'verified')).toBe(true);
    expect(checkRenewalSchema([], 'missing').every((item) => item.status === 'missing')).toBe(true);
    const changed = columns.map((item) => item.column_name === 'verified_at' ? { ...item, is_nullable: 'NO' } : item);
    expect(checkRenewalSchema(changed, 'mismatch').filter((item) => item.status === 'mismatch').map((item) => item.name))
      .toEqual([RENEWAL_MIGRATION, 'membership_contracts.verified_at']);
  });
  it('keeps the column checklist synchronized with the current migration source', () => {
    const migration = readFileSync(new URL(`../migrations/${RENEWAL_MIGRATION}`, import.meta.url), 'utf8');
    const table = migration.slice(migration.indexOf('CREATE TABLE membership_contracts ('), migration.indexOf('\n);'));
    const names = [...table.matchAll(/^  ([a-z_]+) (?:UUID|TEXT|INTEGER|TIMESTAMPTZ)\b/gm)].map((match) => match[1]);
    expect(Object.keys(RENEWAL_COLUMNS)).toEqual(names);
  });
  it('never certifies full launch even if environment and schema checks pass', () => {
    const report = renewalReadinessReport([...checkRenewalEnvironment(valid), ...checkRenewalSchema(columns, 'verified')]);
    expect(report.readyForProduction).toBe(false);
    expect(report.blockers.map((item) => item.status)).toEqual(['not_implemented', 'not_implemented', 'not_verified', 'not_verified']);
  });
});
