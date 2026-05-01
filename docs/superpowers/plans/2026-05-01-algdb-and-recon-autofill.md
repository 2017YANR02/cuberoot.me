# /algdb library + Recon Submit auto-fill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/algdb` page housing the F2L / Advanced F2L / OLL / PLL alg libraries scraped from speedcubedb.com, then implement two cubedb.net-style auto-complete features in `/recon/submit`'s solution textarea: (1) comment label suggestions (`// 1st pair`, `// OLL`, …) after typing moves, and (2) state-aware alg suggestions after typing `// <stage>`.

**Architecture:**
- Static JSON data shipped at build time. One-shot TS scraper under `core/packages/scramble-stats-build/bin/scrape_speedcubedb.ts` fetches 4 pages with cheerio and writes `core/packages/shared/data/algdb_{f2l,adv_f2l,oll,pll}.json`. Mini cube preview rendered client-side from the sticker strings (no images fetched at runtime — stays self-contained).
- `/algdb` page: Bento-style grid of categories → drill-into-category page showing all cases with mini cube + alg list, mirroring speedcubedb's layout. New page lives at `core/packages/client/src/pages/algdb/`.
- Auto-fill: **comment popup** is filename-style fuzzy match against a static list of stage labels, biased by what's already in the text (don't suggest "// 1st pair" if it's already used). **Alg popup** uses cubing.js (already in deps) to apply the prefix moves to a solved cube, then for each candidate alg from the algdb library, applies it and scores against the post-stage target (e.g., for F2L: a slot becomes solved). Top-N by score.

**Tech stack:** TS, React 19, cubing.js (`Alg`, `KPuzzle`, 3x3x3 def), cheerio (new dev dep in scramble-stats-build), existing landing-page bento CSS, shared JSON data convention.

---

## File Structure

**New files:**
- `core/packages/scramble-stats-build/bin/scrape_speedcubedb.ts` — one-shot scraper, callable as `pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb`
- `core/packages/shared/data/algdb_f2l.json` — generated
- `core/packages/shared/data/algdb_adv_f2l.json` — generated
- `core/packages/shared/data/algdb_oll.json` — generated
- `core/packages/shared/data/algdb_pll.json` — generated
- `core/packages/shared/src/algdb.ts` — TS types + small loader (mirrors how `pll.json` is exposed)
- `core/packages/client/src/pages/algdb/AlgDbIndexPage.tsx` — `/algdb` landing
- `core/packages/client/src/pages/algdb/AlgDbCategoryPage.tsx` — `/algdb/:cat` (cat = `f2l | adv-f2l | oll | pll`)
- `core/packages/client/src/pages/algdb/MiniCube.tsx` — renders the sticker preview (F2L 45-char or OLL/PLL 5-face)
- `core/packages/client/src/pages/algdb/algdb.css`
- `core/packages/client/src/pages/recon/components/CommentSuggestPopup.tsx` — comment popup
- `core/packages/client/src/pages/recon/components/AlgSuggestPopup.tsx` — alg popup
- `core/packages/client/src/pages/recon/components/SuggestPopup.css` — shared popup styles
- `core/packages/client/src/utils/recon_autofill.ts` — popup state machine + caret-anchor calc + comment label registry
- `core/packages/client/src/utils/recon_alg_match.ts` — cubing.js sim + alg ranking against a target stage

**Modified files:**
- `core/packages/client/src/App.tsx` — add `/algdb` + `/algdb/:cat` lazy routes
- `core/packages/client/src/pages/LandingPage.tsx` — add `algdb` card (icon: `Library` from lucide), nameKey `algdb`
- `core/packages/client/src/pages/ReconSubmitPage.tsx` — wire two popups onto solution textarea
- `core/packages/client/src/pages/recon/AltSubmitPage.tsx` — same wiring (it has its own textarea, M in git status confirms shared evolution)
- `core/packages/scramble-stats-build/package.json` — add `cheerio`, `node-fetch` (or use built-in fetch on Node 22) and a `scrape:algdb` script
- `core/packages/shared/src/index.ts` — re-export new `algdb.ts`
- `core/packages/client/.../i18n/locales/en.json` + `zh.json` — strings for new page + popups (key prefix `algdb.*`)

**Deferred / out of scope** (NOT touched in this plan):
- Editing/curating the scraped algs (just take what speedcubedb has)
- Search inside the algdb pages (can add in a follow-up)
- Auto-fill in `AlgViewPage` / `ReconSubmitSketchPage` — only `/recon/submit` and `/recon/:parentId/alt`

---

## Task Breakdown

### Task 1: Set up scramble-stats-build deps + scaffold scraper

**Files:**
- Modify: `core/packages/scramble-stats-build/package.json`
- Create: `core/packages/scramble-stats-build/bin/scrape_speedcubedb.ts`

- [ ] **Step 1**: In `core/` run `pnpm --filter @cuberoot/scramble-stats-build add -D cheerio@^1.0.0`. This must run inside `core/` (per repo convention — pnpm root install creates wrong lockfile). Verify it appears in `core/packages/scramble-stats-build/package.json` under `devDependencies` and that the root `pnpm-lock.yaml` was updated (not a stray per-package lockfile).

- [ ] **Step 2**: Create `core/packages/scramble-stats-build/bin/scrape_speedcubedb.ts` with this content:

```ts
#!/usr/bin/env tsx
/**
 * One-shot scraper: speedcubedb.com → core/packages/shared/data/algdb_*.json
 *
 * Usage: pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb
 *
 * Re-runnable. ~4 page fetches (~5MB), 200ms apart, no auth, no rate limiting.
 * Run again to refresh data.
 */
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', '..', 'shared', 'data');

interface AlgEntry {
  alg: string;        // formatted alg string
  altId?: string;     // speedcubedb internal alt id (for stable ordering)
  ytId?: string;      // optional youtube tutorial id
}

interface CaseEntry {
  /** case name e.g. "F2L 1", "OLL 21", "Aa" */
  name: string;
  /** subgroup tag e.g. "Free Pairs", "Adj Swap" */
  subgroup: string;
  /** setup scramble (apply to solved → reach this case) */
  setup: string;
  /** standard / canonical alg (OLL/PLL only — F2L has no single canonical) */
  standard?: string;
  /** sticker preview data — F2L uses 45-char data-fl, OLL/PLL uses 5 faces */
  sticker:
    | { kind: 'f2l'; fl: string }
    | { kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string };
  /** alg list, indexed by orientation (0..3 for F2L, 0 only for OLL/PLL) */
  algs: AlgEntry[][];
}

interface AlgDb {
  scrapedAt: string;
  source: string;
  cases: CaseEntry[];
}

const URLS = {
  f2l:     'https://speedcubedb.com/a/3x3/F2L',
  adv_f2l: 'https://speedcubedb.com/a/3x3/AdvancedF2L',
  oll:     'https://speedcubedb.com/a/3x3/OLL',
  pll:     'https://speedcubedb.com/a/3x3/PLL',
} as const;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (CubeRoot algdb scraper)' },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

function extractCase($: cheerio.CheerioAPI, row: cheerio.Element, kind: 'f2l' | 'face'): CaseEntry {
  const $row = $(row);
  const name = $row.attr('data-alg') ?? '';
  const subgroup = $row.attr('data-subgroup') ?? '';
  const setup = $row.find('.setup-case').first().parent().text().replace(/^\s*setup:\s*/i, '').trim();
  const standardRaw = $row.find('.scdb-panel').first().text();
  const standard = standardRaw ? standardRaw.replace(/^\s*Standard Alg:\s*/i, '').trim() : undefined;

  // sticker
  let sticker: CaseEntry['sticker'];
  if (kind === 'f2l') {
    const fl = $row.find('.icube').first().attr('data-fl') ?? '';
    sticker = { kind: 'f2l', fl };
  } else {
    const $j = $row.find('.jcube').first();
    sticker = {
      kind: 'face',
      us: $j.attr('data-us') ?? '',
      ub: $j.attr('data-ub') ?? '',
      uf: $j.attr('data-uf') ?? '',
      ul: $j.attr('data-ul') ?? '',
      ur: $j.attr('data-ur') ?? '',
    };
  }

  // algs by orientation — F2L has multiple data-ori blocks; OLL/PLL just one
  const algs: AlgEntry[][] = [];
  const $oris = $row.find('[data-ori]');
  const oriCount = $oris.length;
  if (oriCount === 0) {
    algs.push([]);
  } else {
    $oris.each((_, ori) => {
      const list: AlgEntry[] = [];
      $(ori).find('.formatted-alg').each((__, el) => {
        const $el = $(el);
        const $li = $el.closest('li');
        const alg = $el.text().trim();
        if (!alg) return;
        const altId = $li.attr('data-altid') ?? undefined;
        // Find sibling .alg-details img.youtube
        const $details = $row.find(`#alg-${altId}`);
        const ytSrc = $details.find('img').attr('src') ?? '';
        const ytMatch = ytSrc.match(/\/vi\/([^/]+)\//);
        const ytId = ytMatch?.[1];
        list.push({ alg, altId, ytId });
      });
      algs.push(list);
    });
  }

  return { name, subgroup, setup, standard, sticker, algs };
}

async function scrape(category: keyof typeof URLS): Promise<AlgDb> {
  const url = URLS[category];
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const kind = (category === 'f2l' || category === 'adv_f2l') ? 'f2l' : 'face';
  const cases: CaseEntry[] = [];
  $('.singlealgorithm').each((_, row) => {
    cases.push(extractCase($, row, kind));
  });
  return { scrapedAt: new Date().toISOString(), source: url, cases };
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const cat of Object.keys(URLS) as Array<keyof typeof URLS>) {
    console.log(`scraping ${cat}…`);
    const db = await scrape(cat);
    const out = join(OUT_DIR, `algdb_${cat}.json`);
    writeFileSync(out, JSON.stringify(db, null, 2));
    console.log(`  → ${out} (${db.cases.length} cases)`);
    await sleep(200);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3**: Add a script entry in `core/packages/scramble-stats-build/package.json` `"scripts"`:
  ```json
  "scrape:algdb": "tsx bin/scrape_speedcubedb.ts"
  ```
  (verify `tsx` is already a dep of that package — if not, add it)

- [ ] **Step 4**: Run the scraper from `core/`:
  ```
  pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb
  ```
  Expected output: 4 lines, "scraping f2l… → algdb_f2l.json (41 cases)" etc. Counts should match: F2L 41, adv_f2l ~54, oll 57, pll 21. **If any count is off by more than ±2, stop and re-inspect the cheerio selectors against `.tmp/scd/*.html` (already cached) before continuing.**

- [ ] **Step 5**: Spot-check the output by reading `algdb_f2l.json` first 100 lines + searching for the F2L 1 entry. Confirm `name="F2L 1"`, `subgroup="Free Pairs"`, `setup` non-empty, `algs[0][0].alg="U R U' R'"`. If sample doesn't match, fix the selectors and re-run.

- [ ] **Step 6**: Commit. Files: 4 JSONs + scraper + package.json edits.
  ```
  git add core/packages/scramble-stats-build/bin/scrape_speedcubedb.ts core/packages/scramble-stats-build/package.json core/packages/shared/data/algdb_*.json core/pnpm-lock.yaml
  git commit -m "feat(algdb): scrape F2L/AdvF2L/OLL/PLL data from speedcubedb"
  ```

---

### Task 2: Shared types + loader

**Files:**
- Create: `core/packages/shared/src/algdb.ts`
- Modify: `core/packages/shared/src/index.ts`

- [ ] **Step 1**: Create `core/packages/shared/src/algdb.ts`:

```ts
/**
 * Static algorithm database — F2L / AdvancedF2L / OLL / PLL, scraped from
 * speedcubedb.com. Use the matching loader to import a category at runtime.
 *
 * Data is generated by `scramble-stats-build/bin/scrape_speedcubedb.ts`.
 */

export interface AlgdbEntry {
  alg: string;
  altId?: string;
  ytId?: string;
}

export type AlgdbSticker =
  | { kind: 'f2l'; fl: string }
  | { kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string };

export interface AlgdbCase {
  name: string;
  subgroup: string;
  setup: string;
  standard?: string;
  sticker: AlgdbSticker;
  algs: AlgdbEntry[][];
}

export interface AlgdbFile {
  scrapedAt: string;
  source: string;
  cases: AlgdbCase[];
}

export type AlgdbCategory = 'f2l' | 'adv_f2l' | 'oll' | 'pll';

/**
 * Lazy load — keeps the JSON out of the main bundle since each is 200KB+.
 * Returns the parsed AlgdbFile for the requested category.
 */
export async function loadAlgdb(cat: AlgdbCategory): Promise<AlgdbFile> {
  switch (cat) {
    case 'f2l':     return (await import('../data/algdb_f2l.json')).default as AlgdbFile;
    case 'adv_f2l': return (await import('../data/algdb_adv_f2l.json')).default as AlgdbFile;
    case 'oll':     return (await import('../data/algdb_oll.json')).default as AlgdbFile;
    case 'pll':     return (await import('../data/algdb_pll.json')).default as AlgdbFile;
  }
}
```

- [ ] **Step 2**: Re-export from `core/packages/shared/src/index.ts` (append):
  ```ts
  export * from './algdb';
  ```

- [ ] **Step 3**: Run typecheck from `core/`:
  ```
  pnpm --filter @cuberoot/client typecheck
  ```
  Expected: PASS. If `data/algdb_*.json` import path resolves, types pick up.

- [ ] **Step 4**: Commit.
  ```
  git add core/packages/shared/src/algdb.ts core/packages/shared/src/index.ts
  git commit -m "feat(shared): expose algdb loader + types"
  ```

---

### Task 3: MiniCube — render sticker preview

**Files:**
- Create: `core/packages/client/src/pages/algdb/MiniCube.tsx`

This component renders both kinds of stickers. F2L `data-fl` is 45 chars (3 layers down + 4 sides each 9 chars, ignoring U). OLL/PLL is the 5-face flat unfolded layout (top 3×3 + 4 side strips of 3 cells = top-row of each adjacent face). We draw with inline SVG — keeps it crisp at any size.

- [ ] **Step 1**: Decode the speedcubedb sticker formats by reading several entries from `algdb_f2l.json` and `algdb_oll.json` and confirming color codes. Map: `w`→white #FFF, `y`→#FFEB3B, `g`→#0F8 green, `b`→#1AF blue, `r`→#E22 red, `o`→#F90 orange, `l`→#444 (faint/ignored), `n`→#222 (none). Use the speedcubedb defaults — verify by opening one of the cached pages in a browser if uncertain.

- [ ] **Step 2**: Write `MiniCube.tsx`:

```tsx
import type { AlgdbSticker } from '@cuberoot/shared';

const COLORS: Record<string, string> = {
  w: '#FFFFFF', y: '#FCD13D', g: '#1FA64C', b: '#1A75F0',
  r: '#E0354B', o: '#FF8C1A',
  l: '#3A3A3A', n: '#1A1A1A',
};

interface Props {
  sticker: AlgdbSticker;
  size?: number; // px — square
}

/** F2L preview: top view of cube, U face hollowed out (we show D + 4 side top rings). */
function F2lPreview({ fl, size }: { fl: string; size: number }) {
  // fl is 45 chars: D 9 + R 9 + F 9 + L 9 + B 9 (verified order against speedcubedb data)
  // We render an isometric-ish 5-strip layout: side strips around a central D face.
  // (Exact layout to be tweaked while looking at speedcubedb side-by-side.)
  // ... see implementation in repo
  return /* svg */;
}

/** OLL/PLL preview: top view + 4 side-top strips. */
function OllPreview(props: { us: string; ub: string; uf: string; ul: string; ur: string; size: number }) {
  // us = top face 9 chars; ub/uf/ul/ur = 9 chars each but only first 3 (top row) are visible
  // ... see implementation in repo
  return /* svg */;
}

export function MiniCube({ sticker, size = 56 }: Props) {
  if (sticker.kind === 'f2l') return <F2lPreview fl={sticker.fl} size={size} />;
  return <OllPreview {...sticker} size={size} />;
}
```

- [ ] **Step 3**: Render an actual visual side-by-side check. Open `http://localhost:5173/algdb/oll` (after Task 4 wires the route), compare to https://speedcubedb.com/a/3x3/OLL — top-row colors of each side strip should match. Tweak.

- [ ] **Step 4**: Commit (lump with Task 4).

---

### Task 4: AlgDb pages + routes

**Files:**
- Create: `core/packages/client/src/pages/algdb/AlgDbIndexPage.tsx`
- Create: `core/packages/client/src/pages/algdb/AlgDbCategoryPage.tsx`
- Create: `core/packages/client/src/pages/algdb/algdb.css`
- Modify: `core/packages/client/src/App.tsx`
- Modify: `core/packages/client/src/pages/LandingPage.tsx`
- Modify: `core/packages/client/src/i18n/locales/en.json`, `zh.json`

- [ ] **Step 1**: AlgDbIndexPage — 4 big cards (F2L, Advanced F2L, OLL, PLL), each links to `/algdb/<cat>`. Visual style: copy the bento layout from `AlgIndexPage.tsx` (already exists for `/alg`) — Tier 1 hero cards, lucide icons (`Layers` for F2L, `Layers2` for AdvF2L, `Hexagon` for OLL, `Diamond` for PLL).

- [ ] **Step 2**: AlgDbCategoryPage — fetches `loadAlgdb(cat)` on mount, renders a vertical list. Each row = MiniCube + case name + subgroup chip + alg list (first 5 visible, expand to show all). Alg row has a copy-to-clipboard button.
  - Mobile: stack mini cube on top of alg list.
  - Each alg entry has small twisty-player on click (use cubing.js `<twisty-player>` web component, applied to setup → alg).

- [ ] **Step 3**: algdb.css — based on existing `alg.css` (already in `pages/alg/`). Reuse landing-page bento variables.

- [ ] **Step 4**: Wire routes in `App.tsx` after the existing `/alg` block:
  ```tsx
  const AlgDbIndexPage = lazy(() => import('./pages/algdb/AlgDbIndexPage'));
  const AlgDbCategoryPage = lazy(() => import('./pages/algdb/AlgDbCategoryPage'));
  // …
  <Route path="/algdb" element={<Suspense fallback={<div>Loading...</div>}><AlgDbIndexPage /></Suspense>} />
  <Route path="/algdb/:cat" element={<Suspense fallback={<div>Loading...</div>}><AlgDbCategoryPage /></Suspense>} />
  ```

- [ ] **Step 5**: LandingPage — add a CARDS entry. Place after existing `alg` card:
  ```tsx
  { id: 'algdb', href: '/algdb', internal: true, tier: 'standard', Icon: Library, nameKey: 'algdb' },
  ```
  Add to TEXTS: `algdb: { en: 'Alg DB', zh: '公式库' }`.
  (Note: keep the existing `alg` card; algdb is a separate library page.)

- [ ] **Step 6**: i18n — add `algdb.title`, `algdb.f2l`, `algdb.advF2l`, `algdb.oll`, `algdb.pll` to en.json and zh.json. Keys parallel.

- [ ] **Step 7**: Run dev server (already running per CLAUDE.md), open `http://localhost:5173/algdb`, click into each of the 4 categories, scroll. Compare against speedcubedb.com side-by-side. Stickers visible? Algs readable? OK.

- [ ] **Step 8**: Typecheck. Lint. Commit.

---

### Task 5: Comment auto-fill popup

**Files:**
- Create: `core/packages/client/src/pages/recon/components/CommentSuggestPopup.tsx`
- Create: `core/packages/client/src/pages/recon/components/SuggestPopup.css`
- Create: `core/packages/client/src/utils/recon_autofill.ts`
- Modify: `core/packages/client/src/pages/recon/ReconSubmitPage.tsx`
- Modify: `core/packages/client/src/pages/recon/AltSubmitPage.tsx`

- [ ] **Step 1**: Define stage label registry in `recon_autofill.ts`:

```ts
/**
 * Comment label suggestions for the recon submit textarea.
 * Order matters — earlier labels suggested first when no other signal.
 *
 * Variant strings include both "// 1st pair" generic and "// GR Pair" / "// Green Red Pair" specific.
 */
export const COMMENT_LABELS = {
  insp: ['insp'],
  cross: ['W cross', 'Y cross', 'cross'], // user picks color
  pair: [
    '1st pair', '2nd pair', '3rd pair', '4th pair',
    'GR Pair', 'GO Pair', 'BR Pair', 'BO Pair',
    'Green Red Pair', 'Green Orange Pair', 'Blue Red Pair', 'Blue Orange Pair',
  ],
  ll: ['OLL', 'PLL', 'OCLL', 'OLL(CP)', 'CMLL', 'COLL', 'EPLL', 'ZBLL', 'WV', 'SV', 'VLS', 'OLS'],
} as const;
```

- [ ] **Step 2**: Caret-anchor calc — given a textarea + current selection, compute the (left, top) of the caret in the parent container's coords. Use a hidden `<div>` mirror trick (well-documented technique; see references like `textarea-caret-position`). Returns `{ left: number; top: number; lineHeight: number }`.

- [ ] **Step 3**: CommentSuggestPopup — receives `anchor`, `query`, `excludeUsed`, `onSelect(label)`, `onDismiss`. Filters labels by:
  - if user typed `// gr ` (case-insensitive), filter to labels containing 'gr'
  - exclude labels already present in textarea (don't suggest // 1st pair if it's already used)
  - max 8 entries

  Triggering rule: when user is on a fresh line that already has at least 1 move and types ` //` (space-slash-slash), open popup. Or: typed `// ` and is on a line. Tab/Enter inserts; Esc closes; click outside closes.

- [ ] **Step 4**: SuggestPopup.css — fixed-positioned, dark theme matching cubedb's screenshot (dark grey bg, white text, "COMMENT" / "F2L" badge on left, Tab badge on first item).

- [ ] **Step 5**: Wire into ReconSubmitPage — track selectionStart on `onInput/onClick/onKeyUp`, recompute trigger condition, render `<CommentSuggestPopup>` portaled to root with caret-anchor pos. On select, splice the chosen label into the textarea at caret position and refire `setField('solution', …)`.

- [ ] **Step 6**: Same wiring in AltSubmitPage. Should be a single hook/component to avoid duplication — extract `useReconAutofill(textareaRef, value, onChange)` hook that returns whatever JSX the page should render.

- [ ] **Step 7**: Manual test in browser (dev server already running). Type a few moves, then `//`, popup appears. Tab → label inserted. Type `// 1st pair`, then a newline + moves, then `//` → "// 1st pair" is excluded.

- [ ] **Step 8**: Commit.

---

### Task 6: Alg auto-fill — the state-aware big one

**Files:**
- Create: `core/packages/client/src/utils/recon_alg_match.ts`
- Create: `core/packages/client/src/pages/recon/components/AlgSuggestPopup.tsx`
- Modify: `core/packages/client/src/utils/recon_autofill.ts` (extend hook)
- Modify: `core/packages/client/src/pages/recon/ReconSubmitPage.tsx` + `AltSubmitPage.tsx`

- [ ] **Step 1**: cubing.js sim helper — given a 3x3 puzzle and a sequence of moves (the prefix), return a KState.

```ts
import { Alg, KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

let kpuzzleP: Promise<KPuzzle> | null = null;
async function getKpuzzle() {
  if (!kpuzzleP) kpuzzleP = cube3x3x3.kpuzzle();
  return kpuzzleP;
}

export async function applyAlg(prefix: string): Promise<KState> {
  const kp = await getKpuzzle();
  return kp.algToTransformation(prefix).applyToState(kp.identityTransformation().toKState());
  // (exact API — adjust based on cubing.js version)
}
```

- [ ] **Step 2**: F2L scoring — for a candidate alg, apply (scramble + prefix + alg) and check whether one F2L slot newly became solved compared to (scramble + prefix). Score = number of newly-solved F2L pieces (corner+edge of one slot = 2 pieces; perfect F2L pair solve = 2). Higher = better.

- [ ] **Step 3**: OLL scoring — apply (scramble + prefix + alg), check whether U face is fully one color (top stickers all match) AND F2L is still solved. If yes, score = 1. We then sort top hits.

- [ ] **Step 4**: PLL scoring — similar, but also U layer pieces need to match adjacent center colors (modulo a final AUF). Score = 1 if cube becomes solvable by AUF only.

- [ ] **Step 5**: AlgSuggestPopup — given `prefix` (all moves before caret) + `wcaScramble` + `category` (inferred from the comment label: `// 1st pair` → f2l, `// OLL` → oll, `// PLL` → pll), score each candidate alg, show top 10 with mini cube preview of the post-prefix state.

- [ ] **Step 6**: Comment-to-category mapping. `// 1st pair`, `// 2nd pair`, `// GR pair`, `// Green Red Pair` → f2l. `// OLL`, `// OCLL`, `// COLL` → oll. `// PLL`, `// EPLL` → pll.

- [ ] **Step 7**: Triggering — popup opens when caret is on a line that has a `//` comment matching one of the alg-bearing labels AND the next line is blank (i.e., user is about to write the alg). Tab inserts; Esc dismisses.

- [ ] **Step 8**: Performance — F2L scoring across 41 cases × ~10 algs each = ~400 sims. Each sim is ~1ms with cubing.js, so 400ms is acceptable but make the popup async (show "ranking…" first, then fill). Cache by `(scramble, prefix)` so repeat opens are instant.

- [ ] **Step 9**: Verify against the user's test URL:
  ```
  https://cubedb.net/?puzzle=3x3&scramble=F_U2_R-_F2_L-_B2_D2_R_D2_U2_B_D_R-_U-_F2_L-_R2_F-&alg=...
  ```
  Reproduce the case in our /recon/submit, decode the alg URL, paste line-by-line, after each `// Nth pair` confirm popup ranks the actual chosen alg in top 5.

- [ ] **Step 10**: Test 5 more recons across different speedcubers (pick recent ones from `/recon`). Confirm popup behaves.

- [ ] **Step 11**: Commit.

---

### Task 7: Polish + final review

- [ ] **Step 1**: Mobile — popup must fit under caret on narrow screens (<480px). Test in browser dev tools mobile viewport.
- [ ] **Step 2**: i18n — both popups must respect zh/en mode. Comment labels are mostly proper-noun-like ("OLL", "PLL"); F2L pair names probably OK in English even in zh mode (cuber convention).
- [ ] **Step 3**: typecheck:ci — full clean build.
- [ ] **Step 4**: One final pass — open `/recon/submit` and `/algdb` in zh AND en, confirm no untranslated keys (check console for `i18next` warnings).
- [ ] **Step 5**: Commit final polish + push.

---

## Risks / Watch-outs

- **cubing.js bundle size**: it's already a dep (`reference_cubing_js.md` confirms) but the `cube3x3x3.kpuzzle()` lazy-load chain pulls ~80KB. That's already paid for by the TwistySection on this page, so no new cost.
- **scraping respectfulness**: 4 page fetches total, 200ms apart, with a clear UA. No issue.
- **AdvF2L count is 54, not 84** — verified in recon. Don't fail the build if it's 54 (the recon's "if off by ±2" gate must be widened to ±5 for adv_f2l, or just spot-check manually).
- **Sticker color decode**: speedcubedb's `l` (light grey) means "irrelevant for this case" — render as muted, don't pretend it's a real sticker.
- **Auto-fill popup vs virtual keyboard collision**: on mobile, the cube virtual keyboard sits below the textarea. Popup position must avoid it.
