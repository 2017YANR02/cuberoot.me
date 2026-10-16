/** Preview all legacy mirror pairs. After deploying the updated server, --apply
 * resyncs them via the existing endpoint, without editing individual originals.
 * Build/run commands are documented in docs/issue-40-alg-mirror-plan.md.
 */
import type { AlgCase } from '@cuberoot/shared/alg';
import { MIRROR_ALG_SYNC_SETS, regenerateMirrorAlgs } from '@cuberoot/shared/alg-mirror';

const apply = process.argv.includes('--apply');
const base = (process.env.ALG_API_BASE ?? 'https://api.cuberoot.me').replace(/\/$/, '');
if (apply && (!process.env.ADMIN_API_KEY || !process.env.ALG_API_BASE)) {
  throw new Error('--apply requires explicit ALG_API_BASE and ADMIN_API_KEY');
}
for (const key of MIRROR_ALG_SYNC_SETS) {
  const url = `${base}/v1/alg/sets/${key}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${key}: GET ${response.status}`);
  const { cases } = await response.json() as { cases: AlgCase[] };
  const byId = new Map(cases.map(c => [c.id, c]));
  const done = new Set<number>();
  let changedCases = 0;
  let generatedBefore = 0;
  let generatedAfter = 0;
  const notes: string[] = [];
  const links = cases.filter(c => c.mirrorCaseId != null)
    .map(c => ({ id: c.id, mirrorCaseId: c.mirrorCaseId! }));
  for (const c of cases) {
    if (done.has(c.id)) continue;
    const partner = c.mirrorCaseId == null ? null : byId.get(c.mirrorCaseId);
    if (c.mirrorCaseId != null && (!partner || partner.mirrorCaseId !== c.id)) {
      throw new Error(`${key}: broken mirror link for ${c.id}`);
    }
    done.add(c.id);
    if (partner) done.add(partner.id);
    const result = regenerateMirrorAlgs(c, partner ?? null);
    notes.push(...result.notes);
    const rerun = result.algsById.size ? regenerateMirrorAlgs(
      { ...c, algs: result.algsById.get(c.id)! },
      partner ? { ...partner, algs: result.algsById.get(partner.id)! } : null,
    ) : result;
    for (const [id, algs] of result.algsById) {
      const before = byId.get(id)!.algs;
      const comparable = (v: typeof algs) => v.map(rows => rows.map(e => [e.alg, e.gen ?? null,
        e.src ? [e.src.id, e.src.ori, e.src.i] : null]));
      if (JSON.stringify(comparable(before)) !== JSON.stringify(comparable(algs))) changedCases++;
      generatedBefore += before.flat().filter(e => e.gen).length;
      generatedAfter += algs.flat().filter(e => e.gen).length;
      if (JSON.stringify(rerun.algsById.get(id)) !== JSON.stringify(algs)) {
        throw new Error(`${key}: non-idempotent regeneration for ${id}`);
      }
    }
  }
  console.log(JSON.stringify({ set: key, cases: cases.length, linkedCases: links.length,
    changedCases, generatedBefore, generatedAfter, notes, mode: apply ? 'apply' : 'preview' }));
  if (notes.length) throw new Error('Resolve preview notes before applying');
  if (apply) {
    // Complete current link map; unchanged links also trigger regeneration.
    const saved = await fetch(`${url}/mirror-links`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY! },
      body: JSON.stringify({ links }),
    });
    if (!saved.ok) throw new Error(`${key}: sync failed (${saved.status})`);
    const report = await saved.json() as { notes?: string[] };
    console.log(JSON.stringify({ set: key, report }));
    if (report.notes?.length) throw new Error(`${key}: sync reported unresolved cases`);
  }
}
