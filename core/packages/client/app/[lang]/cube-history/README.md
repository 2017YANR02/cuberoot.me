# 三阶魔方发展史 / 3×3 Cube History

Native CubeRoot route: `/cube-history` (English), `/zh/cube-history` (Simplified Chinese).

## Research snapshot

Cutoff: **2026-10-07**.

- 249 commercial model or family entries across 27 brand/line labels.
- 439 distinct source URLs, including brand announcements, retailer catalogs, archived pages and first-hand reports.
- 333 price observations. Every quote retains currency, market, variant, time basis and its source.
- 12 entries have original CNY quotes; overseas USD quotes are not converted into supposed Chinese retail prices.
- 23 entries have official release-date evidence. Retailer dates and contemporary documentary dates remain explicitly distinct.
- 19 entries have no verified sorting year; 21 have no verified price; 77 have no identifiable item weight.
- 13 narrative milestones connect the 1974 prototype to the 2026 products.
- AoLong V6 remains announced, with unknown retail release date and price.

This is a substantial, expandable archive, **not a claim that every historical 3×3 SKU has been recovered**. Colors, coating options and bundles are usually grouped as variants. Mechanical changes and commercial naming are not perfectly interchangeable: MF3 and GuanLong Plus, for example, remain distinct commercial entries with an explicit naming caveat.

## Structure

| File | Responsibility |
| --- | --- |
| `page.tsx` | Timeline, searchable catalog, inline model records, comparison and source index |
| `cube-history.css` | Responsive layout using existing site theme tokens and surface roles |
| `layout.tsx` | Existing metadata factory and Article structured data |
| `_data/types.ts` | Portable research contract; unknown values stay null |
| `_data/labels.ts` | Public bilingual vocabulary, snapshot date and methodology |
| `_data/query.ts` | Pure search, filtering, sorting and comparison helpers |
| `_data/catalog.ts` | Combines the four data files and builds the source index |
| `_data/milestones.ts` | Evidence-linked narrative |
| `_data/historical.json` | Origins, early DIY/Alpha/Type C/Type D/Type F/HaiYan, FangShi, Cyclone Boys, GiiKER/GoCube/Rubik's, MoreTry/VIN/HaiTun |
| `_data/gan.json` | GAN, Monster Go, Swift Block and Rubik's × GAN |
| `_data/moyu-yj.json` | MoYu, MoFangJiaoShi, GuoGuan and YJ |
| `_data/qiyi-other.json` | QiYi, X-Man Design, DaYan, YuXin, ShengShou and DianSheng |
| `../../../tests/cube-history.test.ts` | Data/reference/date/currency and query-behavior regression coverage |

Only `lib/page-meta.ts` is changed outside the new route and its dedicated test. The existing metadata-driven homepage search and sitemap discover the route; no separate navigation registry, backend, database or dependency is introduced.

The page reuses HomeLink, AppLink, HeaderToggles, SearchInput, ClearButton, CompactSelect, PillToggle, useCopy, nuqs and the shared sticky-table styles. Data can be exported as JSON after filtering. A direct model link uses the `model` query parameter, and comparisons preserve up to four valid IDs.

## Evidence rules

1. A day-level date is not automatically an official launch. Keep `release.basis`, precision and the explanation with the date.
2. Contemporary buyer receipts establish existence by a date; they do not establish the first sale worldwide.
3. Old-store migration dates, especially the repeated 2018-09-11, are not used as historical launch dates.
4. A retailer's retained price may be a clearance or discontinued listing. It is not necessarily MSRP, a launch price, a live offer, or proof of inventory.
5. Item weight must not be filled from packaging/gross weight. Where genuine retailer measurements disagree, preserve the qualification instead of averaging them.
6. A technology filter means at least one documented version offers it. Do not apply a flagship mechanism to every family member.
7. Magnetic counts, corner-cutting angles and alignment angles remain advertised specifications unless a named test establishes otherwise. There is no invented score, universal speed ranking or implied first-hand testing by CubeRoot.
8. Original model photos are not included. The hero cube is explicitly labeled a schematic; it is not a product photograph.

## Known gaps

Earlier regional Rubik's batches, all early Chinese molds, some LanLan/QJ/LeFun lines, obscure discontinued brands, small sizes, teaching products and OEM rebadges still require original catalogs. Many historical Chinese transaction prices and exact worldwide launch dates are unavailable.

The data includes manufacturer/retailer descriptions and source-specific assessments, not a systematic aggregate of community reviews. A negative finding in one review is not a measured failure rate. Smart-cube app support can change after a review; check the dated source.

## Maintenance

Add or correct a source and its evidence-backed model entry in the relevant JSON file. Use a stable, unique model ID so shared links remain valid. Reuse an existing source ID for the same URL; keep the source kind faithful to the actual author.

For a new mechanism or brand, add both language labels. Update a narrative milestone only if the source supports the historical claim. Advance the snapshot date only after revisiting time-sensitive prices, availability and announcements.

Run from `core/`:

```sh
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run tests/cube-history.test.ts tests/page-metadata-coverage.test.ts
```

The existing pull-request CI also checks shared component reuse, URL-state conventions, theme/material contracts and the broader client regression suite.

Before merging, inspect the page at desktop and 390 px in the site's four theme combinations. Check filter labels, long model names, table scrolling, source links, four-model comparisons, exports, direct model links, and closing a record after selecting a comparison. A local browser/build was not available during preparation; CI results and any remaining visual checks are reported in the PR.

## Publication

The feature is delivered on a branch as a draft PR against `main`. Creating the PR does not publish to the main website. After approval and merge, the existing main-branch deployment workflows publish the route. No separate standalone HTML needs to be ported.
