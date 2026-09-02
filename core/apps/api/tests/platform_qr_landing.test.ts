import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PlatformApiError } from '../src/platform/errors.js';
import { QR_LINK_LIMIT, parseQrLinks } from '../src/platform/qr-landing.js';
import { workspaceFixturePath } from './workspace-fixture-path';

describe('QR landing metadata contract', () => {
  it('normalizes strict link records and safe destinations', () => {
    expect(parseQrLinks([
      { label: '  Course  ', href: ' /courses/intro?from=qr ', note: '  Start here  ' },
      { label: 'External', href: 'https://example.com/lesson' },
      { label: 'No note', href: '/', note: '' },
    ])).toEqual([
      { label: 'Course', href: '/courses/intro?from=qr', note: 'Start here' },
      { label: 'External', href: 'https://example.com/lesson' },
      { label: 'No note', href: '/' },
    ]);
  });

  it('rejects missing, unknown, unsafe, oversized, and wrongly typed link fields', () => {
    const invalid: unknown[] = [
      null,
      {},
      [{}],
      [{ label: 'Missing href' }],
      [{ href: '/', label: null }],
      [{ label: 'Null note', href: '/', note: null }],
      [{ label: 'Unknown key', href: '/', extra: true }],
      [{ label: 'Protocol relative', href: '//example.com/path' }],
      [{ label: 'Script', href: 'javascript:alert(1)' }],
      [{ label: 'Credentials', href: 'https://user:pass@example.com/path' }],
      [{ label: `Control\u0007`, href: '/' }],
      [{ label: 'x'.repeat(161), href: '/' }],
      [{ label: 'Too long note', href: '/', note: 'x'.repeat(241) }],
      Array.from({ length: QR_LINK_LIMIT + 1 }, (_, index) => ({ label: String(index), href: '/' })),
    ];
    for (const value of invalid) {
      expect(() => parseQrLinks(value), JSON.stringify(value)).toThrow(PlatformApiError);
    }
  });

  it('keeps the migration, canonical schema, and deployment ledgers synchronized', async () => {
    const [migration, schema, readme, devSchema] = await Promise.all([
      readFile(new URL('../migrations/0203_qr_landing_content.sql', import.meta.url), 'utf8'),
      readFile(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8'),
      readFile(new URL('../migrations/README.md', import.meta.url), 'utf8'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    for (const source of [migration, schema]) {
      expect(source).toContain('CREATE OR REPLACE FUNCTION platform_qr_links_valid');
      expect(source).toContain("JSONB_TYPEOF(link->'label') IS DISTINCT FROM 'string'");
      expect(source).toContain("JSONB_TYPEOF(link->'href') IS DISTINCT FROM 'string'");
      expect(source).toContain("JSONB_TYPEOF(link->'note') IS DISTINCT FROM 'string'");
      expect(source).toContain("label VARCHAR(160) NOT NULL DEFAULT ''");
      expect(source).toContain("qr_type VARCHAR(20) NOT NULL DEFAULT 'redirect'");
      expect(source).toContain("links JSONB NOT NULL DEFAULT '[]'::JSONB");
      expect(source).not.toMatch(/ADD COLUMN (?:intro|term)\b/);
    }
    expect(migration).toContain("UPDATE platform_qr_revisions SET qr_type = 'landing' WHERE target_kind = 'content'");
    expect(readme).toContain('0203_qr_landing_content.sql');
    expect(devSchema).toContain("evolved: [203]");
    expect(devSchema).toContain("{ n: 203, slug: 'qr_landing_content'");
  });

  it('projects card copy and preserves the landing lifecycle in the active API route', async () => {
    const source = await readFile(new URL('../src/routes/platform_qr.ts', import.meta.url), 'utf8');
    expect(source).toContain("AND qr.status IN ('active', 'disabled')");
    expect(source).toContain("visibility === false");
    expect(source).toContain(": \"COALESCE(NULLIF(revision.title_zh, ''), NULLIF(revision.title_en, ''), qr.code)\"");
    expect(source).toContain("COALESCE(design.card->>'intro', '') AS intro");
    expect(source).toContain("COALESCE(design.card->>'term', '') AS term");
    expect(source).toContain("qr.type !== 'redirect' || qr.targetKind === 'content'");
    expect(source).toContain('const target = approvedQrTarget(qr.targetValue)');
    expect(source).toContain('const revisionRequested = QR_REVISION_FIELDS.some');
    expect(source).toContain('parseRevision(body, current)');
    expect(source).toContain('label = COALESCE($6, label)');
    expect(source).toContain('assertOnlyQrFields(body');
    expect(source).toContain('async function resolveQrRef');
    expect(source.match(/resolveQrRef\(db, id/g)).toHaveLength(5);
    expect(source).toContain('ORDER BY (qr.id::text = $1) DESC');
    expect(source).not.toMatch(/QR_REVISION_FIELDS\s*=\s*\[[^\]]*(?:intro|term)/s);

    const publicProjection = source.slice(source.indexOf('function publicQr('), source.indexOf('\nfunction scanSecret'));
    expect(publicProjection).toContain('intro: qr.intro');
    expect(publicProjection).toContain('term: qr.term');
    expect(publicProjection).not.toContain('label: qr.label');
  });
});
