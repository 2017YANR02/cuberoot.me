/**
 * Nemesizer API routes — server-side substitute for the client-side dataset.
 *
 * Dataset is loaded into Node heap at boot (see ../nemesizer/loader.ts).
 * Endpoints:
 *   GET /v1/nemesizer/meta                                 — exportDate + counts
 *   GET /v1/nemesizer/person?wcaId=                        — one person + their ranks
 *   GET /v1/nemesizer/nemeses?wcaId=&view=&scope=          — nemesis list
 *   GET /v1/nemesizer/h2h?p1=&p2=                          — head-to-head per-event
 *   GET /v1/nemesizer/whatif?wcaId=&view=&overrides=       — nemeses with rank override
 *
 * `overrides` format: `ek1:rank1,ek2:rank2` where ek = event_idx * 2 + kind.
 *
 * All responses Cache-Control: 24h — dataset only changes weekly. nginx
 * proxy_cache (see ops/nginx/api.cuberoot.me.conf) deduplicates same-arg hits.
 */
import { Hono } from 'hono';
import { applyRelation, filterByScope, type RelationView, type RankOverride } from '../nemesizer/algo.js';
import { getDataset, type NemesizerDataset } from '../nemesizer/loader.js';
import { NEMESIZER_EVENTS } from '@cuberoot/shared/nemesizer-format';

export const nemesizerRoutes = new Hono();

const CACHE_HEADER = 'public, max-age=86400, stale-while-revalidate=86400';
const VALID_VIEWS = new Set<RelationView>(['myNem', 'iNem', 'nearlyMe', 'iNearly', 'onlyJustMe', 'iOnlyJust']);
const VALID_SCOPES = new Set<'world' | 'continent' | 'country'>(['world', 'continent', 'country']);
const MAX_RESULTS = 500;

function requireReady(): NemesizerDataset | { error: string; status: 503 } {
  const ds = getDataset();
  if (!ds) return { error: 'nemesizer dataset still loading', status: 503 };
  return ds;
}

// GET /v1/nemesizer/meta
nemesizerRoutes.get('/nemesizer/meta', (c) => {
  const ds = getDataset();
  if (!ds) return c.json({ ready: false }, 503);
  return c.json({
    ready: true,
    exportDate: ds.meta.exportDate,
    generatedAt: ds.meta.generatedAt,
    personCount: ds.meta.personCount,
    rankCount: ds.meta.rankCount,
  }, 200, { 'Cache-Control': CACHE_HEADER });
});

// GET /v1/nemesizer/person?wcaId=2009ZEMD01
nemesizerRoutes.get('/nemesizer/person', (c) => {
  const ds = requireReady();
  if ('error' in ds) return c.json({ error: ds.error }, ds.status);
  const wcaId = (c.req.query('wcaId') || '').toUpperCase();
  if (!wcaId) return c.json({ error: 'wcaId required' }, 400);
  const idx = ds.wcaIdIndex.get(wcaId);
  if (idx === undefined) return c.json({ error: 'person not found' }, 404);
  const p = ds.persons[idx];
  const ranks = ds.ranksByPerson[idx].map(r => ({
    event: NEMESIZER_EVENTS[r.ev],
    kind: r.kind,
    rank: r.rank,
    best: r.best,
  }));
  return c.json({
    wcaId: p.wcaId,
    name: p.name,
    iso2: p.countryIso2,
    continent: ds.continents[p.continentIdx] ?? '',
    nemesisCount: ds.counts.nemesisCount[idx],
    nemesizedCount: ds.counts.nemesizedCount[idx],
    ranks,
  }, 200, { 'Cache-Control': CACHE_HEADER });
});

// GET /v1/nemesizer/nemeses?wcaId=2009ZEMD01&view=myNem&scope=world&show=people
nemesizerRoutes.get('/nemesizer/nemeses', (c) => {
  const ds = requireReady();
  if ('error' in ds) return c.json({ error: ds.error }, ds.status);
  const wcaId = (c.req.query('wcaId') || '').toUpperCase();
  const view = (c.req.query('view') || 'myNem') as RelationView;
  const scope = (c.req.query('scope') || 'world') as 'world' | 'continent' | 'country';
  if (!wcaId) return c.json({ error: 'wcaId required' }, 400);
  if (!VALID_VIEWS.has(view)) return c.json({ error: 'invalid view' }, 400);
  if (!VALID_SCOPES.has(scope)) return c.json({ error: 'invalid scope' }, 400);
  const refIdx = ds.wcaIdIndex.get(wcaId);
  if (refIdx === undefined) return c.json({ error: 'person not found' }, 404);

  const raw = applyRelation(ds, refIdx, view);
  const scoped = filterByScope(ds, raw, scope, refIdx);

  // Tally country counts before truncating (so the CountriesTable on the
  // client is accurate even when results > MAX_RESULTS).
  const countryTally: Record<string, number> = {};
  for (const r of scoped) {
    const iso = ds.persons[r.personIdx].countryIso2;
    if (iso) countryTally[iso] = (countryTally[iso] ?? 0) + 1;
  }

  const truncated = scoped.length > MAX_RESULTS;
  const top = scoped.slice(0, MAX_RESULTS).map(r => {
    const p = ds.persons[r.personIdx];
    return {
      wcaId: p.wcaId,
      name: p.name,
      iso2: p.countryIso2,
      sharedEkCount: r.sharedEkCount,
      nemesisCount: ds.counts.nemesisCount[r.personIdx],
      nemesizedCount: ds.counts.nemesizedCount[r.personIdx],
    };
  });

  const refP = ds.persons[refIdx];
  return c.json({
    ref: {
      wcaId: refP.wcaId,
      name: refP.name,
      iso2: refP.countryIso2,
      continent: ds.continents[refP.continentIdx] ?? '',
    },
    view, scope,
    totalCount: scoped.length,
    truncated,
    persons: top,
    countryTally,
  }, 200, { 'Cache-Control': CACHE_HEADER });
});

// GET /v1/nemesizer/h2h?p1=2009ZEMD01&p2=2017HEND01
nemesizerRoutes.get('/nemesizer/h2h', (c) => {
  const ds = requireReady();
  if ('error' in ds) return c.json({ error: ds.error }, ds.status);
  const p1 = (c.req.query('p1') || '').toUpperCase();
  const p2 = (c.req.query('p2') || '').toUpperCase();
  if (!p1 || !p2) return c.json({ error: 'p1 and p2 required' }, 400);
  const i1 = ds.wcaIdIndex.get(p1);
  const i2 = ds.wcaIdIndex.get(p2);
  if (i1 === undefined) return c.json({ error: `${p1} not found` }, 404);
  if (i2 === undefined) return c.json({ error: `${p2} not found` }, 404);

  const rows: { event: string; kind: number; r1?: number; b1?: number; r2?: number; b2?: number }[] = [];
  for (let evIdx = 0; evIdx < NEMESIZER_EVENTS.length; evIdx++) {
    const ev = NEMESIZER_EVENTS[evIdx];
    for (const kind of [0, 1]) {
      if (ev === '333mbf' && kind === 1) continue;
      const ek = evIdx * 2 + kind;
      const r1 = ds.rankOfPerson[ek].get(i1);
      const r2 = ds.rankOfPerson[ek].get(i2);
      if (r1 === undefined && r2 === undefined) continue;
      const b1 = bestOf(ds, i1, evIdx, kind);
      const b2 = bestOf(ds, i2, evIdx, kind);
      rows.push({ event: ev, kind, r1, b1, r2, b2 });
    }
  }
  const p1Rec = ds.persons[i1];
  const p2Rec = ds.persons[i2];
  return c.json({
    p1: { wcaId: p1Rec.wcaId, name: p1Rec.name, iso2: p1Rec.countryIso2 },
    p2: { wcaId: p2Rec.wcaId, name: p2Rec.name, iso2: p2Rec.countryIso2 },
    rows,
  }, 200, { 'Cache-Control': CACHE_HEADER });
});

// GET /v1/nemesizer/whatif?wcaId=2009ZEMD01&view=myNem&overrides=0:5,2:50
nemesizerRoutes.get('/nemesizer/whatif', (c) => {
  const ds = requireReady();
  if ('error' in ds) return c.json({ error: ds.error }, ds.status);
  const wcaId = (c.req.query('wcaId') || '').toUpperCase();
  const view = (c.req.query('view') || 'myNem') as RelationView;
  if (!wcaId) return c.json({ error: 'wcaId required' }, 400);
  if (!VALID_VIEWS.has(view)) return c.json({ error: 'invalid view' }, 400);
  const refIdx = ds.wcaIdIndex.get(wcaId);
  if (refIdx === undefined) return c.json({ error: 'person not found' }, 404);

  const overridesRaw = c.req.query('overrides') || '';
  const override: RankOverride = new Map();
  if (overridesRaw) {
    for (const pair of overridesRaw.split(',')) {
      const [ekStr, rankStr] = pair.split(':');
      const ek = parseInt(ekStr, 10);
      const rank = parseInt(rankStr, 10);
      if (!Number.isInteger(ek) || ek < 0 || ek >= NEMESIZER_EVENTS.length * 2) continue;
      if (!Number.isFinite(rank)) continue;
      override.set(ek, rank);
    }
  }

  const orig = applyRelation(ds, refIdx, view);
  const next = applyRelation(ds, refIdx, view, override);

  const truncated = next.length > MAX_RESULTS;
  const top = next.slice(0, MAX_RESULTS).map(r => {
    const p = ds.persons[r.personIdx];
    return { wcaId: p.wcaId, name: p.name, iso2: p.countryIso2, sharedEkCount: r.sharedEkCount };
  });

  const refP = ds.persons[refIdx];
  // Current ranks (real, not overridden) for the What-if form.
  const ranks = ds.ranksByPerson[refIdx].map(r => ({
    event: NEMESIZER_EVENTS[r.ev],
    kind: r.kind,
    rank: r.rank,
    best: r.best,
  }));
  return c.json({
    ref: {
      wcaId: refP.wcaId,
      name: refP.name,
      iso2: refP.countryIso2,
      ranks,
    },
    view,
    origCount: orig.length,
    newCount: next.length,
    truncated,
    persons: top,
  }, 200, { 'Cache-Control': 'public, max-age=300' });
});

// GET /v1/nemesizer/stats?tab=most|few|biggest|people|countries
nemesizerRoutes.get('/nemesizer/stats', (c) => {
  const ds = requireReady();
  if ('error' in ds) return c.json({ error: ds.error }, ds.status);
  const tab = c.req.query('tab') || 'most';
  const N = ds.persons.length;

  if (tab === 'most' || tab === 'few') {
    const candidates: number[] = [];
    for (let i = 0; i < N; i++) {
      if (ds.ranksByPerson[i].length > 0) candidates.push(i);
    }
    const dir = tab === 'most' ? -1 : 1;
    candidates.sort((a, b) => dir * (ds.counts.nemesisCount[a] - ds.counts.nemesisCount[b]));
    const top = candidates.slice(0, MAX_RESULTS).map(i => {
      const p = ds.persons[i];
      return { wcaId: p.wcaId, name: p.name, iso2: p.countryIso2, nemesisCount: ds.counts.nemesisCount[i] };
    });
    return c.json({ tab, persons: top }, 200, { 'Cache-Control': CACHE_HEADER });
  }
  if (tab === 'biggest') {
    const idxs = Array.from({ length: N }, (_, i) => i);
    idxs.sort((a, b) => ds.counts.nemesizedCount[b] - ds.counts.nemesizedCount[a]);
    const top = idxs.slice(0, MAX_RESULTS).map(i => {
      const p = ds.persons[i];
      return { wcaId: p.wcaId, name: p.name, iso2: p.countryIso2, nemesizedCount: ds.counts.nemesizedCount[i] };
    });
    return c.json({ tab, persons: top }, 200, { 'Cache-Control': CACHE_HEADER });
  }
  if (tab === 'people') {
    const idxs = Array.from({ length: N }, (_, i) => i);
    idxs.sort((a, b) => ds.persons[a].wcaId.localeCompare(ds.persons[b].wcaId));
    const top = idxs.slice(0, MAX_RESULTS).map(i => {
      const p = ds.persons[i];
      return {
        wcaId: p.wcaId, name: p.name, iso2: p.countryIso2,
        nemesisCount: ds.counts.nemesisCount[i],
        nemesizedCount: ds.counts.nemesizedCount[i],
      };
    });
    return c.json({ tab, persons: top, truncated: N > MAX_RESULTS, totalCount: N }, 200, { 'Cache-Control': CACHE_HEADER });
  }
  if (tab === 'countries') {
    const tally = new Map<string, { sumNemesis: number; sumNemesized: number; n: number }>();
    for (let i = 0; i < N; i++) {
      const iso = ds.persons[i].countryIso2;
      if (!iso) continue;
      const cur = tally.get(iso) ?? { sumNemesis: 0, sumNemesized: 0, n: 0 };
      cur.sumNemesis += ds.counts.nemesisCount[i];
      cur.sumNemesized += ds.counts.nemesizedCount[i];
      cur.n += 1;
      tally.set(iso, cur);
    }
    const rows = Array.from(tally.entries())
      .sort((a, b) => b[1].sumNemesized - a[1].sumNemesized)
      .map(([iso, v]) => ({ iso2: iso, peopleCount: v.n, sumNemesis: v.sumNemesis, sumNemesized: v.sumNemesized }));
    return c.json({ tab, rows }, 200, { 'Cache-Control': CACHE_HEADER });
  }
  return c.json({ error: 'invalid tab' }, 400);
});

function bestOf(ds: NemesizerDataset, p: number, ev: number, kind: number): number | undefined {
  for (const r of ds.ranksByPerson[p]) {
    if (r.ev === ev && r.kind === kind) return r.best;
  }
  return undefined;
}
