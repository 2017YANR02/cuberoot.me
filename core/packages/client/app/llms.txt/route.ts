// Served at /llms.txt — the llms.txt convention (llmstxt.org): a curated,
// markdown map of the site for assistants that fetch a page to answer with it.
//
// Deliberately hand-curated, NOT generated from the route table like
// app/sitemap.ts. A sitemap answers "what URLs exist"; this answers "which
// pages are worth reading and what is in them". Listing all 202 routes would
// bury the ~10 pages that carry real long-form content among tool shells.
//
// Kept in sync by hand. If you add a substantial content page (a /math topic, a
// regulation chapter, a long-form /dev piece), add it here too.
//
// force-static: pure string, no I/O — baked at build, served from CDN.
export const dynamic = 'force-static';

const BASE = 'https://cuberoot.me';

// Chinese lives at /zh/<same path>; stated once in the header rather than
// doubling every line below.
const BODY = `# CubeRoot

> A speedcubing toolkit and reference site: puzzle solvers, algorithm training,
> solve reconstructions, WCA competition statistics, and long-form writing on the
> mathematics and rules of twisty puzzles. Every page exists in English at the
> bare URL and in Simplified Chinese under /zh/ (e.g. ${BASE}/math/group and
> ${BASE}/zh/math/group).

Built and maintained independently; not affiliated with the World Cube
Association. WCA competition data is derived from the WCA's public export.

## Mathematics and theory

- [The Rubik's Cube, as a Group](${BASE}/math/group): a 60+ section course on
  group theory told through the cube — permutations, wreath and semidirect
  products, Sylow theorems, Burnside/Pólya counting, character tables, Cayley
  graphs, growth of groups. Each section has its own URL under
  ${BASE}/math/group/<section-slug> and its own interactive diagrams.
- [God's Number](${BASE}/math/god): the diameter of the cube group under
  half-turn and quarter-turn metrics, how the 20/26 results were proved, and the
  corresponding numbers for other WCA puzzles.
- [Demigod numbers](${BASE}/math/demigod): distance distributions short of the
  full diameter.
- [Probability](${BASE}/math/probability): skip chances, case distributions, and
  the combinatorics behind common speedcubing odds.
- [Last slot / last layer counts](${BASE}/math/lsll): how the LSLL case space
  decomposes and how large each family is.
- [Kernels and quotients](${BASE}/math/kernel),
  [unit distance](${BASE}/math/unit-distance): shorter standalone topics.

## WCA regulations, illustrated

- [Regulations hub](${BASE}/regulation): every article of the official WCA
  Regulations rewritten with diagrams and 3D examples, one page per article.
- [Full official text](${BASE}/regulation/full): the complete regulations
  verbatim, for citation.
- Per-article pages include [Notation](${BASE}/regulation/notation),
  [Scrambling](${BASE}/regulation/scrambling), [Events](${BASE}/regulation/events),
  [Solved state](${BASE}/regulation/solved-state),
  [Blindfolded](${BASE}/regulation/blindfolded),
  [Fewest Moves](${BASE}/regulation/fewest-moves),
  [Multi-Blind](${BASE}/regulation/multi-blind),
  [One-Handed](${BASE}/regulation/one-handed),
  [Competitors](${BASE}/regulation/competitors),
  [Officials](${BASE}/regulation/officials),
  [Incidents](${BASE}/regulation/incidents),
  [Defects](${BASE}/regulation/defects),
  [Environment](${BASE}/regulation/environment),
  [Head-to-head](${BASE}/regulation/head-to-head),
  [Puzzles](${BASE}/regulation/puzzles),
  [Speed solving](${BASE}/regulation/speed-solving).

## Solve reconstructions

- [Reconstruction index](${BASE}/recon): move-by-move reconstructions of
  competition solves, with scramble, solution, per-step timing and method
  breakdown. Individual solves live at ${BASE}/recon/<id>-<slug> and carry
  structured data for the video where one exists.

## Learning and reference

- [Why learn the cube](${BASE}/why-cube): a long-form piece for parents and
  newcomers on what solving actually trains.
- [Tutorials](${BASE}/tutorial): step-by-step guides, organised by category.
- [Glossary and wiki](${BASE}/wiki): speedcubing terminology, bilingual, with the
  Chinese terms as actually used by the community rather than literal
  translations.
- [Algorithm library](${BASE}/alg): F2L, OLL, PLL, COLL, ZBLL, CMLL and more, per
  puzzle, with trainers.

## Tools

- [Scramble analysis](${BASE}/scramble): optimal solvers, step difficulty
  statistics, pattern search, and per-event scramble distributions computed from
  the WCA's real scramble corpus.
- [Timer](${BASE}/timer): speedcubing timer with smart-cube support and solve
  analysis.
- [Simulator](${BASE}/sim): 3D simulators for 28 puzzle types.
- [WCA statistics](${BASE}/wca): rankings, records, sum-of-ranks, competition
  data and visualisations derived from the WCA export.
- [Score calculator](${BASE}/calc), [frame counter](${BASE}/frame-count),
  [mosaic builder](${BASE}/mosaic).

## Engineering notes

- [How this site is built](${BASE}/dev): architecture, the solver stack, the
  algorithms behind the analyzers (Kociemba, min2phase, IDA*), and notes on the
  languages and tools used.

## Notes for automated readers

- Sitemaps: ${BASE}/sitemap.xml (static pages) and ${BASE}/recon-sitemap.xml
  (reconstructions).
- English is the canonical bare URL; /zh/ is the Simplified Chinese alternate.
  hreflang is declared in HTTP Link headers and in the sitemaps.
- /wca/persons/* and /wca/comp/* are excluded in robots.txt: they are
  client-rendered shells over ~200k and ~17k URLs, so crawling them costs a
  request and returns no content. Query the WCA's own API for that data instead.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Browser 1h, CDN 1d — this changes only when content pages are added.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
