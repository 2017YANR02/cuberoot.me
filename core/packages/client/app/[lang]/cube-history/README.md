# 三阶魔方发展史 / 3×3 Cube History

Native CubeRoot route: `/cube-history` (English), `/zh/cube-history` (Simplified Chinese).

## Research snapshot

Evidence cutoff: **2026-10-07**. On 2026-10-08, the user narrowed the price scope to verified mainland-China launch prices; merchant review pools retain their original snapshot dates.

| Measure | Current archive |
| --- | ---: |
| Model groups in the catalog | 611 |
| Individually addressable model / configuration / named-edition records | 973 |
| Brand / line labels, including historical trade names | 68 |
| Unique source URLs | 1337 |
| Records with source-linked real product photographs | 968 |
| Exact-model photographs / explicitly shared source photographs | 961 / 7 |
| Product-page user ratings with review counts and dates | 578 |
| Verified mainland-China launch-price observations | 3 |
| Records with a verified mainland-China launch price | 3 |
| Records with an official date, including announcements | 31 |
| Records without a verified sorting year | 188 |
| Records without a verified China launch price / identifiable item weight | 970 / 321 |

The first edition had 249 entries. Original shared links remain usable. A manufacturer-confirmed duplicate, GuanLong 2021 / GuanLong V4, now resolves through an evidence-linked alias to one canonical record. Heterogeneous family records now name a specific configuration and link their separately documented siblings through `familyId`. This record count includes distinct coatings and named commercial editions; it is not a count of unique mechanical designs or proof that every worldwide SKU has been recovered.

The second research pass cross-checked the 4,688-product public TheCubicle catalog, including discontinued listings, against manufacturer catalogs, other retailers, dated announcements and surviving historical records. TheCubicle catalog's product-type label was treated as a lead, with individual product evidence determining inclusion. Brand-specific handover notes are retained in each dataset's `coverageNotes`.

The third pass adds 37 independently documented records, updates 96 existing records and merges one confirmed duplicate, moving from 937 to 973 records. It checks manufacturer terminology against further Tribox, Cubezz, Ziicube and historical sources. The MoYu/YJ pass reached all 38 pages of the relevant Cubezz category; the other-brand Cubezz pass reached pages 1–19 and 57 before repeated timeouts. These are explicit audited scopes, not claims that every source catalog was fully recovered. Source notes retain the remaining candidates and exclusions.

Corrections include the official GuanLong 2021 / V4 naming bridge, an earlier documentary date for ShengShou Legend S, Chinese Tornado aliases including 风四代, and independent Solar 3E / ME records. New historical context includes Cube4You Tile, Maze and Gas Assisted models plus the principal V-CUBE 3×3 branches. Source photograph recovery closes the ordinary Cube4You and YJ 35 mm pillow gaps. Subsequent targeted recovery also supplies the GAN356 X INFINITY and white fifth-anniversary GAN356 i photographs; the current gaps are listed below.

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
| `_data/historical.json` | 138 records: origins, early Chinese DIY brands, early smart cubes, teaching and miniature products |
| `_data/historical-brands.json` | 80 records: MoreTry, Maru, Cyclone Boys, HaiTun, ESCube, HuDong, VIN and Cuber’s Home |
| `_data/historical-collectibles.json` | 136 records: Calvin’s Puzzle, Ziina, ZCube and TheCubicle picture and collectible lines |
| `_data/gan.json` | 140 records: mechanical GAN, Monster Go, Swift Block and Rubik’s × GAN |
| `_data/gan-smart.json` | 32 smart GAN and related records, preserving their original model IDs |
| `_data/aliases.json` | Evidence-linked canonical redirects for merged duplicate records |
| `_data/moyu-yj.json` | 109 root or standalone records: MoYu, MFJS, GuoGuan, YJ, HuaMeng and related smaller lines |
| `_data/moyu-yj-variants.json` | 109 individually documented family configurations and named editions |
| `_data/qiyi-other.json` | 124 records: DaYan, YuXin, ShengShou, DianSheng and MsCube |
| `_data/qiyi-xman.json` | 97 records: QiYi and X-Man Design |
| `../../../tests/cube-history.test.ts` | Dates, China launch-price scope, sources, photos, ratings, family relationships and query behavior |

Outside the route and its dedicated tests, changes are limited to `lib/page-meta.ts` and attributed product photographs under `public/_assets/cube-history/`. The existing metadata-driven homepage search and sitemap discover the route. The implementation uses the site's TypeScript/Next.js architecture, existing shared controls and nuqs URL state; it adds no backend, dependency or standalone HTML application.

## Browsing and review

The default view is the photo catalog. Each documented model family occupies one card or table row, with a version selector for its matching configurations. The current 973 records form 611 model groups using the existing `familyId` relationships; all exact-version IDs and evidence remain independently addressable. Selecting a version updates the photograph, name, date, specifications, China launch price, detail target and comparison target together.

Filtering runs before grouping, so a search, year or flagship filter exposes only its matching versions; a chosen version that no longer matches falls back to the first current match. Pagination and result model counts operate on groups, while the version count and JSON export include all matching records.

Brand, calendar year, era, family, positioning, category, technology and evidence filters intersect. GAN, MoYu, QiYi and YJ lead both the image shortcuts and brand dropdown. Search is the primary entry; brand, family, year and position remain immediately visible, with secondary facets under More filters and individual active-filter removal. Search examines every record and defaults to model-name relevance; explicit chronological and natural model-name sorting remain available. Compact, full-width and bilingual queries retain generation-number boundaries and configuration names. The result bar distinguishes the complete match count from the currently rendered page, with Show all and Back to search actions below the results. Cards, the table, details and comparisons all display the source-linked product photo.

The prominent **Flagships only** switch below the search examples uses the existing `tier=flagship` URL state. It stays synchronized with the positioning dropdown and active-filter removal, preserves the other filters when toggled, and can be shared or reopened directly. It uses each record's own source-supported editorial positioning, including historical flagships and flagships whose year remains unknown; it does not inherit a parent model's positioning.

Photo credits show the linked publisher name without repeating the “Photo source” prefix beneath every image.

After selecting a brand, the annual-lineup section shows every year from that brand's earliest documented year through the cutoff, with columns for flagships, other positions and unclassified records. It remains a complete brand overview, independent of the catalog filters. Empty years remain visible as evidence gaps. They do not establish that the manufacturer released nothing that year. Clicking a year changes only the calendar-year filter, preserving the flagship selection, brand, search and other conditions.

Each record has a shareable `model` query parameter. Related versions can be selected inside the record. Up to four independently addressable models can be compared, and filtered data plus all referenced sources can be exported as JSON. The source view reports per-brand photo and date coverage.

## Evidence rules

1. Keep date precision and `release.basis` together. A retailer Added date, contemporary purchase report and manufacturer launch announcement establish different things. A day-level value is not automatically a worldwide launch date.
2. Concentrated old-store re-entry dates, including widely repeated 2018-09-11 and several older GAN listings on 2018-11-07, cannot replace independently documented earlier availability. The latter pattern does not establish a global migration rule for unrelated new products.
3. Record only verifiable mainland-China launch prices for the exact configuration, retaining CNY, CN, launch kind, date, variant and source. Official new-product preorder and introductory offers must be qualified in the note. Other markets, currency conversions, later retail/wholesale prices and configuration-unspecified family quotes are excluded from the data as well as the UI and exports. A missing price stays an empty array and is shown as “Launch price unverified”.
4. Net weight is never filled from gross/package weight or Shopify shipping grams. Conflicting measurements retain version and source qualifications.
5. Distinct spring, MagLev, ball-core, adjustable-magnet, coating, size and named-edition products receive separate records when evidence supports the distinction. Ordinary colors and packaging quantities remain variants unless independently significant. Child models do not inherit their parent's date, price, dimensions or performance claims.
6. Each photograph uses a URL observed in its own public product metadata, original page or identified historical source. `image.match` distinguishes exact matches from photography shared by the source. Shared images are labeled in the interface. Missing or failed images have explicit text, never a generated or lookalike substitute. The decorative hero remains labeled a schematic.
7. Image authorship and rights remain with the linked source; source attribution does not create a new reuse license. Images normally load from their cited hosts. An optional `image.assetPath` can serve an unchanged local copy while retaining the original `image.url` and source attribution, including in exported JSON. Local copies live under the existing cached `/_assets/` route and change filename when their contents change. Loading failures remain visible. No product image is generated with AI.
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
| cube4you-gas-assisted | Cube4You Gas Assisted 三阶 |
| gan2 | GAN2 / Ganspuzzle II |
| gan1 | GAN1（早期型号，资料待补） |
| gan354-m-infinity | GAN INFINITY 354 M 原厂定制 |

These gaps are visible in the public Missing photo filter. Smart-cube app compatibility and discontinued stock can change after the cutoff. Announcements, including AoLong V6 and any unconfirmed retail releases, remain clearly labeled.

### Early GAN photographic provenance

A bounded archival search recovered three actual early Gans product photographs from the [archived Lightake SKU 37517 listing](https://web.archive.org/web/20130226071558/http://lightake.com:80/detail.do/sku.3x3x3_PVC_Type_A_Gans_Puzzle_Magic_Cube_Black-37517). The original HTML called it “3x3x3 PVC Type A Gans Puzzle Magic Cube Black”. The [contemporary April 2011 discussion](https://www.speedsolving.com/threads/alpha-cc-selling-on-lightake.28393/) identifies a Gans cube and rejects an Alpha CC attribution, but does not establish the numbered model GAN1. The [600 × 600 complete-cube photograph](https://web.archive.org/web/20130213014231im_/http://img.lightake.com/image201004/sku_37517_1.jpg), [disassembly photograph](https://web.archive.org/web/20130213014225im_/http://img.lightake.com/image201004/sku_37517_6_small.jpg) and [piece photograph](https://web.archive.org/web/20130213014238im_/http://img.lightake.com/image201004/sku_37517_8_small.jpg) were recovered and visually inspected. They are preserved here as identification leads and deliberately not attached to GAN1 or GAN2.

The [May 2011 GAN2 discussion](https://bbs.mf8-china.com/forum.php?extra=&mod=viewthread&ordertype=2&tid=76704) supplies a contemporary research lead but did not yield a recoverable, independently identifiable photograph in this pass. The archive retains both missing-photo explanations rather than assigning later GAN product photography.

### GAN17 Jurassic World photograph recovery

On 2026-10-08, a targeted follow-up request to the previous Sina image URL returned HTTP 403. The [GlobalCube collaboration listing](https://globalcube.store/product/gan-x-jurassic-world-co-branded-magnetic-cube-series-gan17-magdrive%EF%BD%9Cgan356me/) supplies a separately named GAN17 product option and a poster explicitly identifying GAN17 MagDrive Jurassic World. The source-provided [700 × 1167 JPEG](https://globalcube.store/wp-content/uploads/2026/09/GAN17-3-700x1167.jpg) was downloaded, visually checked and preserved without alteration as `public/_assets/cube-history/gan17-jurassic-world-4662563b.jpg` (212,020 bytes; SHA-256 `4662563b8f261624c83d4e75a77d209277daf8f22c339b4aceea88a8fb0b733a`). Cards, details and comparisons serve that local copy to avoid another external image-host failure. A verified Taobao/Tmall direct listing was not recovered in this pass; the photograph is attributed to the actual inspected source. This photograph-only follow-up does not advance the price/review snapshot or turn the official announcement into a confirmed retail launch.

### Targeted missing-photo recovery and loading audit

The 2026-10-07 America/Los_Angeles follow-up (2026-10-08 UTC) prioritised Taobao/Tmall names and then cross-checked manufacturer pages, contemporary reviews and surviving shop archives. It recovered two previously missing photographs and repaired two failed external image links. The archive now has photographs for **968 of 973 records (99.5%)**, comprising 961 exact-model matches and seven explicitly shared source photographs. The five remaining gaps retain visible explanations; searching an incomplete public index does not establish that Taobao has no listing.

| Record | Recovery | Preserved local asset |
| --- | --- | --- |
| GAN356 X INFINITY | The [dedicated GAN product page](https://www.gancube.cn/ganinfinity356x/) supplies an identified black-exterior/purple-internal custom example. Orders can differ. | `gan356-x-infinity-691c34f3.png`, 418 × 411, 50,050 bytes |
| GAN356 i White 5th Anniversary | The [archived exact WizZon listing](https://web.archive.org/web/20240621224815id_/https://wizzon.com/product/gan-356-i-gan356i-white-5th-anniversary-limited-edition/) binds SKU TYPZ02058 to the main image through both HTML and Product JSON-LD. The [successful image replay](https://web.archive.org/web/20261004104651im_/https://wizzon.com/wp-content/uploads/TYPZ02058.jpg) preserves the original JPEG. Anniversary identity comes from the listing; the artwork itself says GAN356 i. | `gan356-i-5th-white-056a5726.jpg`, 1000 × 1000, 67,715 bytes |
| GAN356 ME Jurassic World | The existing officially identified photograph's Sina URL returned HTTP 403; its previously retrieved, visually checked original is now served locally. | `gan356-me-jurassic-world-271dbe5f.jpg`, 129,228 bytes |
| MoYu AoLong V6 | The existing official teaser photograph's Sina URL returned HTTP 403; its previously retrieved, visually checked original is now served locally. | `moyu-aolong-v6-8a87df87.jpg`, 94,476 bytes |

All four unchanged files live under `public/_assets/cube-history/`, use content-hash filenames and retain the original remote URL and source attribution in the data. Together with the previous GAN17 repair, five photos are served locally. Prices, ratings and release statuses were not advanced by this photo-only follow-up.

A fresh GET check of all **962 previously recorded unique source-image URLs** returned 960 image responses and the two Sina 403 responses described above. After these repairs and the two additions, the actual rendered set contains 959 distinct external image URLs covered by the successful check and five local image paths. This is a dated loading observation, not a guarantee of future external-host availability.

For the remaining gaps, the early Gans photographs still lack a reliable GAN1/GAN2 numbering link; ordinary GAN354 M pictures were excluded from the INFINITY record. Alpha V Feng now links to the [original MechaAkuma review](https://www.youtube.com/watch?v=CB5AxcdcMB8), whose description identifies Lightake SKU33524. The original [PestVic Gas Assisted review](https://www.youtube.com/watch?v=uhl_2Ljp3Lg) remains linked. Their observed thumbnail URLs returned HTML rather than inspectable images; final Lightake archive requests returned 503/429, so these candidates remain unassigned. Brand handover notes document the searches and exclusions.

## China launch-price scope

The 2026-10-08 price revision removes 1,335 nonqualifying price observations and seven configuration-unspecified family quotes. It retains the independently verified GAN17 mainland-China launch quote and adds two documented GAN15 introductory prices. All 973 model records, their release-date evidence, photographs, specifications and merchant review pools remain present. Price availability now covers **3 of 973 records**; the remaining **970** explicitly show “首发价待核实 / Launch price unverified”. Neither a later domestic selling price nor a converted overseas quote fills that gap.

| Exact record | China launch price | Price announcement date | Evidence |
| --- | ---: | --- | --- |
| GAN17 MagDrive | ¥439 | 2026-08-10 | [Official GAN launch announcement](https://www.sina.cn/news/detail/5330425766748694.html), explicitly identifying the launch price |
| GAN15 NewBlack UV | ¥399 | 2025-02-27 | [Official new-product preorder announcement archive](https://peachring.com/u/2191436202-GANCUBE/5138722586102604) and its [original preorder poster](https://wx2.sinaimg.cn/large/829ea9aagy1hyz4uelvhkj20xc8h1npn.jpg); UV configuration cross-checked against the [dedicated official product page](https://www.gancube.com/products/gancube-gan15-newblack-uv-coated) |
| GAN15 MagLev Zenith / 峰芒 winter edition | ¥449 | 2024-11-29 | [Official launch announcement archive](https://peachring.com/u/2191436202-GANCUBE/5106107678199756); the price is in the post text, while the attached poster confirms the named edition |

NewBlack is explicitly qualified as an official new-product **preorder** price. The quotation date is distinct from the model's existing retailer catalog-entry date; this price-only revision does not rewrite either model's release-date evidence. The Zenith announcement describes a Double 12 launch, and its price date records when that announcement was published.

The GAN price follow-up traversed 47 publicly exposed official-Weibo archive pages and checked original posters. Parallel MoYu/YJ and QiYi/other-brand reviews did not recover an additional exact-configuration domestic launch price with adequate evidence. Later official catalog prices, shop promotions, competition prizes, configuration-unspecified starting prices and aggregation-only claims were excluded. This bounded search documents the present evidence gap; it does not establish that no other launch prices were published.

Cards, details, timeline prose, comparison, the price-evidence filter and JSON export all use this single price scope. Sources that still substantiate product specifications, date evidence, photographs or ratings are retained even when a price from the same page has been removed.

## Maintenance and verification

Add evidence-backed records and sources to the appropriate JSON file. Reuse the existing source ID for the same URL. When adding a brand, mechanism or public term, supply both language labels. Change a milestone only when its source supports the historical claim. Advance the cutoff only after revisiting time-sensitive fields.

Run from `core/` with the repository-pinned pnpm version:

```sh
pnpm --filter @cuberoot/client build:deps
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run tests/cube-history.test.ts tests/page-metadata-coverage.test.ts tests/component-reuse-guard.test.ts tests/site-material-guard.test.ts tests/url-state-no-raw-history.test.ts
```

PR CI checks the wider client suite and repository contracts; Vercel builds the preview for the exact branch commit. Research validation also checks photo HTTP status and content type, source resolution, valid date precision, positive CNY/CN launch prices, merchant-rating sample bounds, original links through stable IDs or documented aliases, every full Chinese/English model name matching itself, precise MAX-L queries, natural numeric ordering and explicit independent GAN11–16 versions.

The revision has been served through the local Next.js route in Chinese and English, including a direct GAN12 model/family URL. Browser transport was unavailable during this revision, so desktop/mobile screenshots, real touch interaction and the four theme combinations still require review in the linked preview. Automated checks and HTTP responses do not substitute for that visual inspection.

## Homepage entry

The current homepage has a search entry for this route, generated from `PAGE_META`; it has no dedicated fixed homepage card. On the Chinese homepage, type “魔方发展史” or “型号图鉴” and click “三阶魔方发展史与型号图鉴” under the “页面” results. Enter submits an AI question in the current homepage search, so opening the route requires clicking its page result.

## Publication

The original archive was merged through PR #91. Follow-up changes use a separate review PR and feature-branch Vercel preview; merging a follow-up requires user approval. The existing main-branch deployment workflow publishes the route after merge. No account password or personal access token needs to be shared in chat.
