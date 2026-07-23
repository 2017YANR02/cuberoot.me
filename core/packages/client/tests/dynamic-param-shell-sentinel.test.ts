// Guard (ratchet): a client-shell [param] page over an UNBOUNDED id space must not
// use the old on-demand model. It must ship as ONE prerendered static sentinel shell.
//
// Background — the 2026-07-10 "Function Invocations spike": /wca/comp/[slug] is a pure
// client shell (all data fetched in the browser; the server render is byte-identical
// for every slug) but used `dynamicParams = true` + empty generateStaticParams. Under
// that model Vercel renders a Function per *first-seen* slug, and it resets the ISR
// cache on every deploy — so a crawler / post-deploy sweep of the ~17k comp URLs burned
// one function render each. persons/colpi/recon-submit/forum had already been converted
// to the sentinel-shell pattern; comp + person + recon/person were the last three that
// hadn't. Fixed all three; this test stops any of them regressing and catches new ones.
//
// The sentinel pattern (see wca/persons/[wcaId]/page.tsx for the canonical example):
//   - page.tsx: `dynamicParams = false` + generateStaticParams returns exactly the "_"
//     sentinel (one prerendered static shell backs every id).
//   - next.config.ts beforeFiles: rewrite `/:lang(en|zh)/<route>/:id -> /<route>/_`.
//   - the client component reads the real id from window.location (useParams yields "_").
//
// This is a ratchet by allowlist. It scans every [param] page.tsx for the old on-demand
// model (`dynamicParams = true`) and asserts the set is EXACTLY the allowlist below.
//   - Convert comp/person/etc back to the old model -> not in allowlist -> RED (locks the fix).
//   - Add a NEW [param] page with the old model -> not in allowlist -> RED. If it's an
//     unbounded client shell, use the sentinel instead. If it's genuinely fine (see the
//     two allowed reasons), add it to ALLOWED_ON_DEMAND with a one-line reason.
//   - Remove/convert an allowlisted page -> stale entry -> RED, asking you to prune it.
//
// The old model is CORRECT and must stay for two kinds of page, hence the allowlist:
//   (a) real SEO pages that server-render meaningful per-id content, then ISR-cache it.
//   (b) BOUNDED id spaces (a small finite set) — even rendered on demand they top out at
//       a few hundred invocations ever, which is noise, not a spike.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const APP = join(ROOT, 'app');

// Paths relative to app/, POSIX slashes. Each MUST be either a real SEO page (renders
// per-id content server-side, ISR-cached) or a BOUNDED id space (can't spike). If your
// page is an unbounded pure client shell, DON'T add it here — use the sentinel shell.
const ALLOWED_ON_DEMAND: Record<string, string> = {
  // (a) real SEO — generateMetadata + server-rendered per-id content, ISR-cached:
  '[lang]/recon/[id]/page.tsx': 'SEO: generateMetadata + per-id server render, ISR-cached',
  '[lang]/forum/t/[id]/page.tsx': 'SEO: generateMetadata + per-id server render, ISR-cached (share cards)',
  '[lang]/wca/[statId]/page.tsx': 'bounded: ~80 fixed stat pages',
  // (b) bounded id spaces — small finite sets, top out at a few hundred invocations:
  '[lang]/math/group/[slug]/page.tsx': 'bounded: ~62 group-theory sections',
  '[lang]/tutorial/[slug]/page.tsx': 'bounded: fixed tutorial set',
  '[lang]/tutorial/c/[cat]/page.tsx': 'bounded: fixed tutorial categories',
  '[lang]/wca/prediction/333/[sectionId]/page.tsx': 'bounded: fixed prediction sections',
  // Grandfathered: unbounded-shaped (recon id) client shells, but only reachable as deep
  // sub-pages of an existing recon and the recon corpus is small today, so not a spike
  // vector yet. Convert to the sentinel shell if recon traffic grows.  [[revisit]]
  '[lang]/recon/[id]/alt/page.tsx': 'grandfathered: recon-id shape but tiny/deep space today',
  '[lang]/recon/[id]/alt/[altIdx]/page.tsx': 'grandfathered: recon-id shape but tiny/deep space today',
};

const DYNAMIC_PARAMS_TRUE = /export\s+const\s+dynamicParams\s*=\s*true\b/;

function allPageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allPageFiles(p));
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return relative(APP, p).split(sep).join('/');
}

describe('unbounded client-shell [param] pages use the sentinel shell (no on-demand per-id render)', () => {
  it('the set of on-demand [param] pages equals the allowlist', () => {
    const onDemand = allPageFiles(APP)
      .filter((p) => rel(p).includes('[') && DYNAMIC_PARAMS_TRUE.test(readFileSync(p, 'utf8')))
      .map(rel)
      .sort();

    const allowed = Object.keys(ALLOWED_ON_DEMAND).sort();

    const unexpected = onDemand.filter((f) => !(f in ALLOWED_ON_DEMAND));
    const stale = allowed.filter((f) => !onDemand.includes(f));

    expect(
      { unexpected, stale },
      [
        unexpected.length &&
          `New/regressed on-demand [param] page(s):\n  ${unexpected.join('\n  ')}\n` +
            `If it's an UNBOUNDED pure client shell, use the sentinel shell instead ` +
            `(dynamicParams=false + generateStaticParams -> ['_'] + a next.config rewrite; ` +
            `see wca/persons/[wcaId] / wca/comp/[slug]). If it's a real SEO page or a ` +
            `bounded id space, add it to ALLOWED_ON_DEMAND with a one-line reason.`,
        stale.length &&
          `Allowlisted page(s) no longer use dynamicParams=true — prune from ALLOWED_ON_DEMAND:\n  ${stale.join('\n  ')}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    ).toEqual({ unexpected: [], stale: [] });
  });
});
