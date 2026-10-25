import { afterAll, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { fetchTranslationSnapshot, WEBLATE } from '../src/utils/wca_translation_source.js';

vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAdminOrApiKey: (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer fixture-admin') throw new HTTPException(403);
  },
}));
function fixtureFetch(change: (data: any, url: string) => void = () => {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input); const component = url.split('/')[6];
    const count = component === 'glossary' ? 0 : 100;
    const data: any = url.includes('/units/') ? { count, next: null, results: Array.from({ length: count }, (_, i) => ({
      id: i + 1, context: i === 0 ? 'page->groups->wic' : `test->${i}`, source: [i === 0 ? 'WCA Integrity Committee' : `Fixture ${i}`],
      target: [i === 0 ? 'WCA 廉政委员会 (WIC)' : `条目 ${i}`], state: 20, translated: true, fuzzy: false, approved: false,
      web_url: `${WEBLATE}/translate/wca/${component}/zh_Hans/?checksum=${i}`, last_updated: null, has_failing_check: false,
    })) } : { language_code: component === 'locales' ? 'zh-CN' : 'zh_Hans', language: { code: 'zh_Hans' }, total: count, revision: 'fixture-r1', component: { slug: component, source_language: { code: 'en' }, license: 'GPL-3.0-or-later' } };
    change(data, url);
    return Response.json(data);
  }) as unknown as typeof fetch;
}

describe('WCA source contract', () => {
  it('preserves bilingual forms, attribution, source state and stable snapshot digest', async () => {
    const data = await fetchTranslationSnapshot(fixtureFetch());
    expect(data.units).toHaveLength(200);
    expect(data.components[2]).toMatchObject({ component: 'glossary', total: 0 });
    expect(data.units[0]).toMatchObject({ key: 'page->groups->wic', zh: 'WCA 廉政委员会 (WIC)', usable: true, approved: false, source_forms: ['WCA Integrity Committee'] });
    expect((await fetchTranslationSnapshot(fixtureFetch())).digest).toBe(data.digest);
  });
  it('retains incomplete/fuzzy source evidence but excludes it from usable translations', async () => {
    const data = await fetchTranslationSnapshot(fixtureFetch(d => {
      if (d.results?.length) {
        d.count = 101;
        d.results.push({ ...d.results[0], id: 101, fuzzy: true, state: 10 });
      } else if (d.total) d.total = 101;
    }));
    expect(data.units.filter(u => !u.usable)).toHaveLength(2);
  });
  it.each(['missing', 'duplicate', 'outside', 'revision'])('rejects %s snapshots before publication', async mode => {
    let metadataReads = 0;
    await expect(fetchTranslationSnapshot(fixtureFetch((d, url) => {
      if (!url.includes('/units/')) { metadataReads++; if (mode === 'revision' && metadataReads === 2) d.revision = 'changed'; }
      else if (mode === 'missing') d.results.pop();
      else if (mode === 'duplicate') d.results[1].id = d.results[0].id;
      else if (mode === 'outside') d.next = 'https://example.org/private';
    }))).rejects.toThrow();
  });
});

describe.skipIf(process.env.WCA_TRANSLATION_TEST_PG !== '1')('WCA mirror persistence and public routes', () => {
  afterAll(async () => { const { sql } = await import('../src/db/connection.js'); await sql.end(); });
  it('publishes a full corpus, supports batches, literal queries and exact keys with provenance', async () => {
    const { syncTranslations } = await import('../src/utils/wca_translations.js');
    const { wcaTranslationRoutes: app } = await import('../src/routes/wca_translations.js');
    expect((await syncTranslations(true, fixtureFetch())).status).toBe('synced');
    const response = await app.request('/wca/translations?q=WIC&q=page.groups.wic&component=locales&limit=2');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ready).toBe(true); expect(data.stale).toBe(false);
    expect(data.results.map((r: any) => r.matches[0].zh)).toEqual(['WCA 廉政委员会 (WIC)', 'WCA 廉政委员会 (WIC)']);
    expect(data.results[1].matches[0].rank).toBe(0);
    expect(data.components[0].revision).toBe('fixture-r1');
    const missing = await app.request('/wca/translations?q=%25_%27');
    expect((await missing.json()).results[0].matches).toEqual([]);
    expect(missing.headers.get('Cache-Control')).toBe('no-store');
  });
  it('retains the last good corpus after upstream failure and exposes failure status', async () => {
    const { syncTranslations } = await import('../src/utils/wca_translations.js');
    const { wcaTranslationRoutes: app } = await import('../src/routes/wca_translations.js');
    await expect(syncTranslations(true, vi.fn(async () => new Response('', { status: 429 })) as typeof fetch)).rejects.toThrow('429');
    expect((await (await app.request('/wca/translations?q=廉政委员会')).json()).results[0].matches).toHaveLength(2);
    const status = await (await app.request('/wca/translations/status')).json();
    expect(status.lastError).toContain('previous snapshot retained');
    expect(status.ready).toBe(true);
  });
  it('prefers the official organization-name context to conflicting form labels for acronyms', async () => {
    const { syncTranslations } = await import('../src/utils/wca_translations.js');
    const { wcaTranslationRoutes: app } = await import('../src/routes/wca_translations.js');
    await syncTranslations(true, fixtureFetch(d => {
      if (!d.results?.length) return;
      Object.assign(d.results[0], { context: 'competitions->competition_form->wcat', source: ['WCA Competition Announcement Team'], target: ['WCA 比赛公告小组'] });
      Object.assign(d.results[1], { context: 'page->teams_committees_councils->groups_name->wcat', source: ['WCA Competition Announcement Team'], target: ['WCA比赛公示组 (WCAT)'] });
    }));
    const data = await (await app.request('/wca/translations?q=WCAT&component=locales&limit=2')).json();
    expect(data.results[0].matches.map((m: any) => m.zh)).toEqual(['WCA比赛公示组 (WCAT)', 'WCA 比赛公告小组']);
  });
  it('rejects public mutation and malformed or unbounded searches', async () => {
    const { wcaTranslationRoutes: app } = await import('../src/routes/wca_translations.js');
    expect((await app.request('/wca/translations/sync', { method: 'POST' })).status).toBe(403);
    for (const query of ['', '?q=', '?q=WIC&limit=999', '?q=WIC&component=private']) expect((await app.request('/wca/translations' + query)).status).toBe(400);
  });
});
