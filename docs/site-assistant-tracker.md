# CubeRoot site assistant

## Scope and evidence (2026-09-28)

The owner requested full-site natural-language answers and a conversation interface,
using Qwen 3.8 Flash, with a **site-wide limit of 100 questions per Beijing day**.
The reference is [CubeStats WCA Explorer](https://cubestats.in/wca). This is a
functional comparison, not authorization to copy unlicensed implementation code.

No matching public source repository or open-source license was found in the
reference site's About page or GitHub repository search. This does not establish
that its implementation is closed source.

### Verified references

| Product | Evidence | Implication for CubeRoot |
| --- | --- | --- |
| [CubeStats](https://cubestats.in/about) | About lists Next.js 16, React 19, TypeScript, LLM, Recharts, IndexedDB and WCA OAuth. Homepage describes Gemini/DeepSeek agents with live SQL queries. Browser tests returned records, comparison tables and four PR charts in a continuing conversation. | Query actual datasets, retain context, render structured results. Internal agent code remains unverified. |
| [CubeGPT](https://speedcubing.app/cubegpt) | Public page lists career progression, ranking history, comparisons and competition analysis. | Reuse existing CubeRoot person and competition pages as drill-down destinations. |
| [Perplexity](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search) | Official help describes multi-source answers and contextual follow-ups. | Attach evidence and preserve follow-up context. |
| [Google Notebook](https://support.google.com/gemininotebook/answer/16179559?hl=en) | Official help describes source-grounded chat and citations. | Distinguish unavailable evidence from an empty result. |
| [GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/chat-with-copilot/get-started-with-chat) | Official documentation describes grounding in actual repository context and follow-ups. | Connect domain tools instead of treating a directory as the content itself. |
| [Metabase Metabot](https://www.metabase.com/docs/latest/ai/metabot) | Official product documentation covers an analytics assistant and embedded AI chat. | Keep data selection and visualization based on verified query results. |

## Acceptance checklist

- [x] Durable 100-question quota: reserve before model calls, count failed/cancelled calls, reject when storage is unavailable, reset at Beijing midnight. Local PostgreSQL fixture: 130 concurrent reservations admit exactly 100, reconnect retains limit, midnight starts next day.
- [x] Bilingual quota-exhausted message; regular search remains available.
- [x] Exact original question: 三阶魔方世界纪录. Answer single and average with holders, competition, date and data freshness.
- [x] Conversation UI: follow-ups, examples, stop, retry, new conversation, sources, accessible desktop/mobile layout.
- [x] Person profiles and PRs; resolve names without guessing WCA IDs.
- [x] Current/historical rankings, geographic/event/type filters.
- [x] Competitor comparisons and PR progression charts.
- [x] Upcoming and historical competition discovery.
- [x] Official competition scrambles by event/round.
- [x] Published reconstructions and analysis from recorded move sequences.
- [x] Public page search/read, including guides, regulation and math prose, plus glossary, algorithm and public forum adapters.
- [x] Representative bilingual, follow-up, unavailable-data and adversarial-query acceptance suite.
- [x] Deployment and real browser acceptance of the expanded assistant.

## Boundaries

API keys stay on the server. Public answers never receive admin/private records.
Every public question consumes one daily reservation even if the model needs
multiple bounded read operations. Model output is text, never executable SQL,
HTML, code or an arbitrary URL to fetch. Dates and result formatting use the
existing WCA contracts. Stored public data can lag official publication; show its
actual update time rather than implying live results.

Deployment evidence is recorded separately from local checks. Quota release:
`d55520764a`; expanded assistant code and final frontend: `bf2c55ac9a`. See the deployment evidence below.

## Originality requirement

The owner explicitly requested original example questions, wording, interface and implementation. CubeStats is only a capability benchmark. Public examples use CubeRoot-specific learning questions, different people and regions; no third-party source code or assets were copied. Feature breadth and correctness must be measured, not advertised as an unqualified superiority claim.

CubeStats was added to the production web directory under Competition & Stats (nav site 389), with an original bilingual description and https://cubestats.in/ as its destination. Browser search verification succeeded.

## Local acceptance evidence

- Original records query now reads the published records bundle, including ties and its update date. Real Qwen call returned both 3x3 records and a source table.
- Real model/data calls covered person profiles, rankings, comparisons (four PR charts), competition discovery, WC2023 official final scrambles, public reconstruction 761, glossary questions and a contextual PR follow-up.
- Fixed stale upcoming index filtering and model interpretation of long PR arrays; model now receives programmatically computed first/current/recent milestones while charts retain every strict PR point.
- Data-adapter fixtures cover record ties, invalid results, stale competitions, private reconstruction exclusion, typed tool bounds and raw PR values. Route fixtures cover persistent quota behavior, failures, malformed inputs and bounded tool loops.
- Desktop dialog/chart rendering inspected with a recorded real-model response. 390×844 layout inspected without horizontal overflow. This is separate from pending production browser acceptance.
- Source code/type checks and targeted frontend/backend tests pass. Production build, content index and live browser checks are recorded below.

## Production acceptance (2026-09-28)

- Full Test workflow `36431064630` passed; Next deployment `36431064628` and Vercel deployment for `bf2c55ac9a` succeeded. Final API deployment `36431064705` also succeeded.
- Published index: 1,450 bilingual public page entries, 3.40 MB. 1,324 contain server-rendered text and/or the page’s public description; 126 are on-demand group-theory chapters (63 per language). This is a page-entry count, not 1,450 distinct topics or a claim that every interactive dataset is embedded in HTML. Restricted routes were absent.
- Browser on `https://cuberoot.me/zh`: original Geng progress question returned the correct person, PR table and two curves. A follow-up about his latest average returned Geng, 3.67 seconds, Jiajiang Open, 2026-07-25. The public competition record confirms that competition started and ended on that date.
- Fixed the discovered third-person/viewer confusion: a viewer ID is now supplied to the model only for explicit first-person requests. Model-generated person IDs require prior name resolution; output artifacts are restricted to the final cited sources.
- PLL training and group-theory questions returned actual page evidence and source links. Fixed overly broad header removal, which had stripped the teaching steps from the PLL guide. On-demand chapters are discovered from the existing sitemap and public link labels.
- Live English 2x2 records query returned HTTP 200, English prose, a source and a record table. Original Chinese 3x3 records were verified against the published dataset.
- Desktop, 390×844 layout and all four system/explicit light/dark combinations inspected. Mobile document and dialog widths were both 390 px; the conversation now sits above the floating pet. Viewport/media overrides were restored.
- New conversation, stop, close/reopen retention and retry after a failed request were exercised. Closing retains the current in-memory conversation; reloading does not persist it.
- The earlier CI reconstruction-label failures passed on an unchanged focused rerun and in the later full CI. No ground-truth expectations were weakened.

## Remaining boundaries

- Browser speech recognition has not been replaced with cloud ASR. Actual DJI microphone recognition and mobile speech still require hardware acceptance; text-assistant success is not evidence that voice input is fixed.
- The assistant uses bounded public read adapters and published statistical tables. It does not expose unrestricted SQL, private courses, admin content or arbitrary external-site crawling. Full feature parity or overall superiority over another product has not been established.
- Model prose can still misinterpret evidence. Tables/charts retain raw-source values; a PR series alone does not establish consistency, and its dates use competition start dates unless the source provides finer timing.
