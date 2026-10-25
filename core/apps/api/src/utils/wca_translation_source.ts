import { createHash } from 'node:crypto';
import { z } from 'zod';

export const WEBLATE = 'https://translate.worldcubeassociation.org';
// These components are exposed by WCA's public API. Payload CMS is not currently exposed.
export const TRANSLATION_COMPONENTS = ['locales', 'regulations', 'glossary'] as const;
const forms = z.array(z.string().max(100_000)).min(1).max(10);
const unitSchema = z.object({
  id: z.number().int().positive(), context: z.string().max(2000),
  source: forms, target: forms, state: z.number().int(),
  translated: z.boolean(), fuzzy: z.boolean(), approved: z.boolean(),
  web_url: z.string().url(), last_updated: z.string().nullable(), has_failing_check: z.boolean(),
});
const metaSchema = z.object({
  language_code: z.enum(['zh_Hans', 'zh-CN']), language: z.object({ code: z.literal('zh_Hans') }),
  total: z.number().int().min(0).max(10_000), revision: z.string(),
  component: z.object({ slug: z.string(), source_language: z.object({ code: z.literal('en') }), license: z.string() }),
});
export type TranslationUnit = {
  component: string; unit_id: number; key: string; en: string; zh: string;
  source_forms: string[]; target_forms: string[]; state: number; usable: boolean; approved: boolean;
  source_url: string; source_updated_at: string | null; checks: boolean;
};
export type TranslationSnapshot = Awaited<ReturnType<typeof fetchTranslationSnapshot>>;

/** Bound each response and reject redirects/pagination outside the exact public source. */
async function json(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    redirect: 'error', signal: AbortSignal.timeout(25_000),
    headers: { Accept: 'application/json', ...(process.env.WCA_WEBLATE_TOKEN ? { Authorization: `Token ${process.env.WCA_WEBLATE_TOKEN}` } : {}) },
  });
  if (!response.ok) throw new Error(`Weblate HTTP ${response.status}`);
  if (!response.body) throw new Error('Weblate empty response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 8_000_000) throw new Error('Weblate response exceeds limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function fetchTranslationSnapshot(fetcher: typeof fetch = fetch) {
  const units: TranslationUnit[] = [];
  let totalTextBytes = 0;
  const components: { component: string; revision: string; total: number; usable: number; license: string; url: string }[] = [];
  for (const component of TRANSLATION_COMPONENTS) {
    const root = `${WEBLATE}/api/translations/wca/${component}/zh_Hans/`;
    const before = metaSchema.parse(await json(root, fetcher));
    if (before.component.slug !== component) throw new Error('Weblate component mismatch');
    const seen = new Set<number>(); const pages = new Set<string>();
    const entries: TranslationUnit[] = [];
    let next: string | null = `${root}units/?page_size=1000`;
    while (next) {
      const url: URL = new URL(next);
      if (url.origin !== WEBLATE || url.pathname !== new URL(`${root}units/`).pathname || url.username || url.password || pages.has(next) || pages.size >= 20) throw new Error('Invalid Weblate pagination');
      pages.add(next);
      const page = z.object({ count: z.number().int(), next: z.string().nullable(), results: z.array(unitSchema).max(1000) }).parse(await json(next, fetcher));
      if (page.count !== before.total) throw new Error('Weblate changed during sync');
      for (const unit of page.results) {
        totalTextBytes += Buffer.byteLength(unit.source.join('') + unit.target.join(''));
        if (totalTextBytes > 20_000_000) throw new Error('Weblate corpus exceeds size limit');
        if (seen.has(unit.id)) throw new Error('Duplicate Weblate unit');
        seen.add(unit.id);
        const source = new URL(unit.web_url);
        if (source.origin !== WEBLATE || source.pathname !== `/translate/wca/${component}/zh_Hans/` || source.username || source.password) throw new Error('Invalid Weblate source link');
        entries.push({ component, unit_id: unit.id, key: unit.context, en: unit.source.join('\n'), zh: unit.target.join('\n'), source_forms: unit.source, target_forms: unit.target,
          state: unit.state, usable: unit.translated && !unit.fuzzy && unit.state >= 20 && unit.target.some(s => s.trim()), approved: unit.approved,
          source_url: unit.web_url, source_updated_at: unit.last_updated, checks: unit.has_failing_check });
      }
      next = page.next;
    }
    const after = metaSchema.parse(await json(root, fetcher));
    if (seen.size !== before.total || after.total !== before.total || after.revision !== before.revision) throw new Error('Incomplete or changing Weblate snapshot');
    if (component !== 'glossary' && entries.filter(u => u.usable).length < 100) throw new Error('Unexpectedly empty WCA translation component');
    components.push({ component, revision: before.revision, total: entries.length, usable: entries.filter(u => u.usable).length, license: before.component.license, url: root });
    units.push(...entries);
  }
  const digest = createHash('sha256').update(JSON.stringify({ components, units })).digest('hex');
  return { components, units, digest };
}
