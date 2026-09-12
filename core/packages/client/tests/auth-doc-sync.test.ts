// guard-registry: tracked at /dev/guards
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';
import { CORE_ROOT, DOC_PATH, checkAuthDocReview, collectAuthDocSources,
  fingerprintAuthSources, isAuthDocSource } from '../../../scripts/check-auth-doc-sync.mjs';

const entries = [['fixture.ts', 'old behavior']];
const page = (sources = entries, reason = 'Reviewed sign-in, linking, merging and deletion; behavior matches the diagram.') =>
  `/* auth-doc-review ${JSON.stringify({ fingerprint: fingerprintAuthSources(sources), reason })} */`;

describe('/dev/auth source-review drift', () => {
  it('requires the real page to acknowledge the current authentication sources', () => {
    const sources = collectAuthDocSources();
    expect(sources.length).toBeGreaterThan(20);
    expect(checkAuthDocReview(readFileSync(resolve(CORE_ROOT, DOC_PATH), 'utf8'), sources)).toEqual([]);
  });
  it('rejects a code-only change even if the page date changes', () => {
    expect(checkAuthDocReview(page(), entries)).toEqual([]);
    expect(checkAuthDocReview(page() + '\n// updated today', [['fixture.ts', 'new behavior']])[0]).toContain('stale');
  });
  it('detects additions, deletions and renames', () => {
    for (const sources of [[], [...entries, ['new.ts', '']], [['renamed.ts', 'old behavior']]]) {
      expect(checkAuthDocReview(page(), sources)[0]).toContain('stale');
    }
  });
  it('requires an explicit review reason, not just a refreshed fingerprint', () => {
    for (const text of ['', '/* auth-doc-review not json */', page(entries, ''), page(entries, 'updated')]) {
      expect(checkAuthDocReview(text, entries)[0]).toContain('reason');
    }
  });
  it('is independent of line endings, input order and Windows separators', () => {
    expect(fingerprintAuthSources([['b', 'b\r\n'], ['a\\c', 'a\r\n']]))
      .toBe(fingerprintAuthSources([['a/c', 'a\n'], ['b', 'b\n']]));
  });
  it('ignores unrelated schema additions but still detects account constraints', () => {
    const path = relative(CORE_ROOT, workspaceFixturePath('@cuberoot/server', 'src/db/schema.pg.sql'));
    const sql = 'CREATE TABLE auth_identities (id INT);';
    expect(fingerprintAuthSources([[path, sql + 'CREATE TABLE deskpet_catalog (id INT);']]))
      .toBe(fingerprintAuthSources([[path, sql]]));
    expect(fingerprintAuthSources([[path, sql.replace('INT', 'BIGINT')]]))
      .not.toBe(fingerprintAuthSources([[path, sql]]));
  });
  it('ignores toolbar-only edits, but retains refresher and import changes', () => {
    const path = relative(CORE_ROOT, workspaceFixturePath('@cuberoot/client', 'components/AuthTokenRefresher.tsx'));
    const source = 'import refreshSession from "auth";\nexport default function AuthTokenRefresher() { refreshSession(); }\nexport function AdminTools() { return 1; }';
    expect(fingerprintAuthSources([[path, source.replace('return 1', 'return 2')]]))
      .toBe(fingerprintAuthSources([[path, source]]));
    expect(fingerprintAuthSources([[path, source.replace('refreshSession', 'refreshOtherSession')]]))
      .not.toBe(fingerprintAuthSources([[path, source]]));
    expect(fingerprintAuthSources([[path, 'import toolbarOnly from "toolbar";\n' + source]]))
      .toBe(fingerprintAuthSources([[path, source]]));
    expect(fingerprintAuthSources([[path, source + '\nfunction newLoginHelper() {}']]))
      .not.toBe(fingerprintAuthSources([[path, source]]));
    const alias = 'import refresh from "auth-a";\nconst run = refresh;\nexport default function AuthTokenRefresher() { run(); }\nexport function AdminTools() {}';
    expect(fingerprintAuthSources([[path, alias.replace('auth-a', 'auth-b')]]))
      .not.toBe(fingerprintAuthSources([[path, alias]]));
  });
  it.each([
    "CREATE TABLE auth_codes (purpose TEXT CHECK (purpose <> 'a;b'));",
    'CREATE TABLE auth_codes ("a;b" TEXT);',
    'CREATE FUNCTION auth_helper() RETURNS TEXT AS $fn$ BEGIN RETURN \'a;b\'; END $fn$ LANGUAGE plpgsql;',
    'CREATE TABLE auth_codes (id INT /* a;b */);',
    "CREATE TABLE auth_codes (purpose TEXT DEFAULT 'a;''b');",
    "CREATE TABLE auth_codes (purpose TEXT DEFAULT 'a;b",
  ])('retains changes after semicolons inside SQL lexical boundaries: %s', source => {
    const path = relative(CORE_ROOT, workspaceFixturePath('@cuberoot/server', 'src/db/schema.pg.sql'));
    expect(fingerprintAuthSources([[path, source.replace('b', 'c')]]))
      .not.toBe(fingerprintAuthSources([[path, source]]));
  });
  it.each([
    ['@cuberoot/server', 'src/routes/account_auth.ts'], ['@cuberoot/server', 'src/utils/account_merge.ts'],
    ['@cuberoot/server', 'src/utils/account_delete.ts'], ['@cuberoot/server', 'src/utils/apple_login.ts'],
    ['@cuberoot/server', 'src/utils/future_oauth.ts'], ['@cuberoot/server', 'migrations/0999_auth_new.sql'],
    ['@cuberoot/server', 'src/utils/password.ts'], ['@cuberoot/server', 'src/utils/credentials.ts'],
    ['@cuberoot/mobile', 'src/native/secure-token.ts'], ['@cuberoot/client', 'proxy.ts'],
    ['@cuberoot/client', 'components/AuthPanel.tsx'], ['@cuberoot/client', 'lib/identity-choice.ts'],
    ['@cuberoot/client', 'app/auth/social/callback/page.tsx'], ['@cuberoot/client', 'app/[lang]/account/page.tsx'],
    ['@cuberoot/shared', 'src/auth/web_session.ts'], ['@cuberoot/app-ui', 'src/auth/installed-auth.ts'],
    ['@cuberoot/mobile', 'src/mobile-auth.ts'], ['@cuberoot/desktop', 'src-tauri/src/lib.rs'],
    ['@cuberoot/harmony', 'entry/src/main/ets/bridge/SecureAuthStore.ets'],
    ['@cuberoot/miniprogram', 'src/lib/auth.ts'], ['@cuberoot/miniprogram', 'src/pages/account/index.wxml'],
    ['@cuberoot/miniprogram', 'src/lib/web-routes.ts'], ['@cuberoot/app-ui', 'src/App.tsx'],
    ['@cuberoot/mobile', 'ios/App/App/AppDelegate.swift'], ['@cuberoot/mobile', 'android/app/src/main/AndroidManifest.xml'],
  ])('covers lifecycle source %s/%s', (pkg, path) => {
    expect(isAuthDocSource(relative(CORE_ROOT, workspaceFixturePath(pkg, path)))).toBe(true);
  });
  it.each([
    ['@cuberoot/client', 'components/DeskPet.tsx'], ['@cuberoot/app-ui', 'src/auth/installed-auth.test.ts'],
    ['@cuberoot/mobile', 'dist/auth.js'], ['@cuberoot/server', 'tests/account.test.ts'],
  ])('excludes unrelated/generated/test %s/%s', (pkg, path) => {
    expect(isAuthDocSource(relative(CORE_ROOT, workspaceFixturePath(pkg, path)))).toBe(false);
  });
});
