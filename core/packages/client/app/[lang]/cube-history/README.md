# 三阶魔方发展史 / 3×3 Cube History

Native CubeRoot route: `/cube-history` (English), `/zh/cube-history` (Simplified Chinese).

## Research snapshot

Cutoff: **2026-10-07**. Prices and review pools describe that research snapshot.

| Measure | Current archive |
| --- | ---: |
| Individually addressable model / configuration / named-edition records | 937 |
| Brand / line labels, including historical trade names | 67 |
| Unique source URLs | 1248 |
| Records with source-linked real product photographs | 931 |
| Exact-model photographs / explicitly shared source photographs | 925 / 6 |
| Product-page user ratings with review counts and dates | 577 |
| Price observations retaining currency, region and version | 1290 |
| Records containing an original CNY quotation | 5 |
| Additional official family quotes with unspecified configuration | 7 |
| Records with an official date, including announcements | 31 |
| Records without a verified sorting year | 168 |
| Records without a verified price / identifiable item weight | 32 / 321 |

The first edition had 249 entries. Every original model ID is preserved so existing links continue to work. Heterogeneous family records now name a specific configuration and link their separately documented siblings through `familyId`. This record count includes distinct coatings and named commercial editions; it is not a count of unique mechanical designs or proof that every worldwide SKU has been recovered.

The second research pass cross-checked the 4,688-product public TheCubicle catalog, including discontinued listings, against manufacturer catalogs, other retailers, dated announcements and surviving historical records. TheCubicle catalog's product-type label was treated as a lead, with individual product evidence determining inclusion. Brand-specific handover notes are retained in each dataset's `coverageNotes`.

## GAN11–16 navigation

| Family | Independently addressable records | Query after either route |
| --- | ---: | --- |
| GAN11 | 15 | `?brand=GAN&family=gan11-m-pro` |
| GAN12 | 8 | `?brand=GAN&family=gan12` |
| GAN13 | 5 | `?brand=GAN&family=gan13` |
| GAN14 | 6 | `?brand=GAN&family=gan14` |
| GAN15 | 6 | `?brand=GAN&family=gan15` |
| GAN16 | 6 | `?brand=GAN&family=gan16` |

The ordinary GAN12 Leap retains its spring configuration; GAN13 FX retains fixed magnetic strength; GAN16 MAX-L retains its own 57 mm specification. Intelligent `ui` products retain their own family navigation. A 2026 retailer-named GAN12 ui MagLev V2 record explains that the commercial name alone does not prove a new mechanical generation.

## Structure

| File | Responsibility |
| --- | --- |
| `page.tsx` | Photo catalog, annual lineups, inline model records, timeline, comparison and source index |
| `cube-history.css` | Responsive layout using existing theme tokens and surface roles |
| `layout.tsx` | Existing metadata factory and Article structured data |
| `_data/types.ts` | Portable bilingual research contract, image attribution and merchant-rating scope |
| `_data/labels.ts` | Public bilingual vocabulary, cutoff and methodology |
| `_data/query.ts` | Search, intersecting filters, sorting, comparison and evidence references |
| `_data/catalog.ts` | Combines datasets and builds the source index |
| `_data/milestones.ts` | Thirteen evidence-linked narrative milestones from 1974 to 2026 |
| `_data/historical.json` | 128 records: origins, early Chinese DIY brands, early smart cubes, teaching and miniature products |
| `_data/historical-brands.json` | 80 records: MoreTry, Maru, Cyclone Boys, HaiTun, ESCube, HuDong, VIN and Cuber’s Home |
| `_data/historical-collectibles.json` | 136 records: Calvin’s Puzzle, Ziina, ZCube and TheCubicle picture and collectible lines |
| `_data/gan.json` | 166 records: GAN, Monster Go, Swift Block and Rubik’s × GAN |
| `_data/moyu-yj.json` | 105 root or standalone records: MoYu, MFJS, GuoGuan, YJ, HuaMeng and related smaller lines |
| `_data/moyu-yj-variants.json` | 109 individually documented family configurations and named editions |
| `_data/qiyi-other.json` | 118 records: DaYan, YuXin, ShengShou, DianSheng and MsCube |
| `_data/qiyi-xman.json` | 95 records: QiYi and X-Man Design |
| `../../../tests/cube-history.test.ts` | Dates, currencies, sources, photos, ratings, family relationships and query behavior |

Only `lib/page-meta.ts` is changed outside the route and its dedicated tests. The existing metadata-driven homepage search and sitemap discover the route. The implementation uses the site's TypeScript/Next.js architecture, existing shared controls and nuqs URL state; it adds no backend, dependency or standalone HTML application.

## Browsing and review

The default view is the photo catalog. Brand, calendar year, era, family, positioning, category, technology and evidence filters intersect. Search examines every record; the result bar states how many are currently rendered and provides a Show all action. Cards, the table, details and comparisons all display the source-linked product photo.

After selecting a brand, the annual-lineup section shows every year from that brand's earliest documented year through the cutoff, with columns for flagships, other positions and unclassified records. Empty years remain visible as evidence gaps. They do not establish that the manufacturer released nothing that year. Clicking a year retains the brand and clears the other filters.

Each record has a shareable `model` query parameter. Related versions can be selected inside the record. Up to four independently addressable models can be compared, and filtered data plus all referenced sources can be exported as JSON. The source view reports per-brand photo and date coverage.

## Evidence rules

1. Keep date precision and `release.basis` together. A retailer Added date, contemporary purchase report and manufacturer launch announcement establish different things. A day-level value is not automatically a worldwide launch date.
2. Concentrated old-store re-entry dates, including widely repeated 2018-09-11 and several older GAN listings on 2018-11-07, cannot replace independently documented earlier availability. The latter pattern does not establish a global migration rule for unrelated new products.
3. Every price retains currency, market, quote type, version, date and source. A retained shop price can be a clearance or unavailable offer. USD is not converted into a supposed historical Chinese MSRP. Official quotations whose configuration is unspecified are retained separately in `familyPrices`, shown as family context and excluded from exact-model price filters and direct price comparison.
4. Net weight is never filled from gross/package weight or Shopify shipping grams. Conflicting measurements retain version and source qualifications.
5. Distinct spring, MagLev, ball-core, adjustable-magnet, coating, size and named-edition products receive separate records when evidence supports the distinction. Ordinary colors and packaging quantities remain variants unless independently significant. Child models do not inherit their parent's date, price, dimensions or performance claims.
6. Each photograph uses a URL observed in its own public product metadata, original page or identified historical source. `image.match` distinguishes exact matches from photography shared by the source. Shared images are labeled in the interface. Missing or failed images have explicit text, never a generated or lookalike substitute. The decorative hero remains labeled a schematic.
7. Image authorship and rights remain with the linked source; source attribution does not create a new reuse license. Images are loaded from their cited hosts, with loading failure handled in the page. No product image is generated with AI.
8. Advertised magnet counts, corner-cutting and auto-alignment angles remain claims by their source. Editorial assessments and first-hand reports are labeled. There is no invented standardized score, measured failure rate or overall sales ranking.
9. Merchant user ratings retain the original product-page pool, review count and sampling date. The page may combine colors or configurations; review identities and sampling quality are not independently audited. These ratings are presented separately from the archive's assessment and are not cross-era performance measurements.
10. A `familyId` is a one-hop pointer to an existing root record, with no cycles. Every source reference, including photograph and rating references, resolves in the combined catalog. IDs remain stable across corrections.

## Inclusion boundaries and remaining gaps

The core catalog covers commercial six-face-turning 3×3 mechanisms, independent sold configurations and named factory editions, with separate categories for small sizes, smart cubes, teaching/accessibility and picture/collectible products. Mechanical core-magnet additions sold as finished Cuber’s Home products are distinguished from their stock bases.

Other orders, cuboids, mirror/fisher/gear transformations, unspecified cubes inside jars, bundles containing the same cube and pure shop lubrication/tensioning services are excluded. Stock-based Tingman/Olor/Tingboy setup products therefore do not add three new manufacturer models; the distinct Tingman Picture Cube remains included. The XiaWei Pineapple was explicitly retracted as an April Fools prank. Rubik’s Perplexus Fusion only permits the turning described in its maze mechanism and is excluded from standard six-face 3×3 records.

Historical regional Rubik’s batches, unlabelled OEM molds, incomplete early Chinese catalogs and many domestic launch prices still have evidence gaps. Unknown information stays null, with an explanation. Brand labels include independent brands, sub-brands and historical trading names; they should not be interpreted as a verified corporate ownership tree.

Records still without an identified product photograph:

| Stable ID | Model |
| --- | --- |
| alpha-v-feng | 国甲 封五（Alpha V Feng） |
| cube4you-3x3 | Cube4You 三阶（C4Y） |
| gan2 | GAN2 / Ganspuzzle II |
| gan1 | GAN1（早期型号，资料待补） |
| yj-guanlong-2021 | 冠龙 2021 新款（YJ8305） |
| yj-mini-pillowed-35mm | 枕形迷你三阶 35 mm（YJ8351） |

These gaps are visible in the public Missing photo filter. Smart-cube app compatibility and discontinued stock can change after the cutoff. Announcements, including AoLong V6 and any unconfirmed retail releases, remain clearly labeled.

### Early GAN photographic provenance

A bounded archival search recovered three actual early Gans product photographs from the [archived Lightake SKU 37517 listing](https://web.archive.org/web/20130226071558/http://lightake.com:80/detail.do/sku.3x3x3_PVC_Type_A_Gans_Puzzle_Magic_Cube_Black-37517). The original HTML called it “3x3x3 PVC Type A Gans Puzzle Magic Cube Black”. The [contemporary April 2011 discussion](https://www.speedsolving.com/threads/alpha-cc-selling-on-lightake.28393/) identifies a Gans cube and rejects an Alpha CC attribution, but does not establish the numbered model GAN1. The [600 × 600 complete-cube photograph](https://web.archive.org/web/20130213014231im_/http://img.lightake.com/image201004/sku_37517_1.jpg), [disassembly photograph](https://web.archive.org/web/20130213014225im_/http://img.lightake.com/image201004/sku_37517_6_small.jpg) and [piece photograph](https://web.archive.org/web/20130213014238im_/http://img.lightake.com/image201004/sku_37517_8_small.jpg) were recovered and visually inspected. They are preserved here as identification leads and deliberately not attached to GAN1 or GAN2.

The [May 2011 GAN2 discussion](https://bbs.mf8-china.com/forum.php?extra=&mod=viewthread&ordertype=2&tid=76704) supplies a contemporary research lead but did not yield a recoverable, independently identifiable photograph in this pass. The archive retains both missing-photo explanations rather than assigning later GAN product photography.

## Maintenance and verification

Add evidence-backed records and sources to the appropriate JSON file. Reuse the existing source ID for the same URL. When adding a brand, mechanism or public term, supply both language labels. Change a milestone only when its source supports the historical claim. Advance the cutoff only after revisiting time-sensitive fields.

Run from `core/` with the repository-pinned pnpm version:

```sh
pnpm --filter @cuberoot/client build:deps
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run tests/cube-history.test.ts tests/page-metadata-coverage.test.ts tests/component-reuse-guard.test.ts tests/site-material-guard.test.ts tests/url-state-no-raw-history.test.ts
```

PR CI checks the wider client suite and repository contracts; Vercel builds the preview for the exact branch commit. Research validation also checks photo HTTP status and content type, source resolution, valid date precision, positive currency-qualified prices, merchant-rating sample bounds, preserved original IDs and explicit independent GAN11–16 versions.

The revision has been served through the local Next.js route in Chinese and English, including a direct GAN12 model/family URL. Browser transport was unavailable during this revision, so desktop/mobile screenshots, real touch interaction and the four theme combinations still require review in the linked preview. Automated checks and HTTP responses do not substitute for that visual inspection.

## Publication

The work stays on the existing draft PR against `main`. The feature-branch Vercel URL provides the review copy; approval and merge remain separate. The existing main-branch deployment workflow publishes the route after merge. No account password or personal access token needs to be shared in chat.
