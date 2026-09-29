# CubeRoot site assistant

## Scope and evidence (2026-09-28)

The owner requested full-site natural-language answers and a conversation interface,
initially using Qwen 3.8 Flash, then requesting the official DeepSeek API on 2026-09-28. On 2026-09-28 the owner raised the target to a **site-wide limit of 1000 questions per Beijing day** (previously 100).
The reference is [CubeStats WCA Explorer](https://cubestats.in/wca). This is a
functional comparison, not authorization to copy unlicensed implementation code.

No matching public source repository or open-source license was found in the
reference site's About page or GitHub repository search. This does not establish
that its implementation is closed source.

### DeepSeek switch (local, 2026-09-28 America/Los_Angeles)

- API `.env` now selects `SITE_ASSISTANT_PROVIDER=deepseek`, reads the existing
  `DEEPSEEK_API_KEY`, and uses `DEEPSEEK_MODEL=deepseek-flash`. The key is sent only
  to the fixed official `https://api.deepseek.com` endpoint. A missing DeepSeek
  key disables the assistant instead of silently using a different provider.
- The [official request contract](https://api-docs.deepseek.com/api/create-chat-completion/)
  requires `thinking: { type: "disabled" }` for non-thinking mode. The assistant
  sends this field, retains JSON output and the existing bounded public-data tools.
  Bailian's separate `enable_thinking: false` is not sent to DeepSeek.
- Existing `SITE_ASSISTANT_API_KEY` / `SITE_ASSISTANT_BASE_URL` remain intact for
  the independent cube-agent comparison. Explicit `SITE_ASSISTANT_PROVIDER=bailian`
  selects the previous assistant configuration.
- Official `/models` returned HTTP 200 with `deepseek-flash` and `deepseek-v4-pro`;
  `/user/balance` returned HTTP 200 and `is_available: true` (not a claim of free use).
- Three local real-model/public-data smoke questions returned grounded answers
  with source tables: current 3x3 records **4.368 s**, reconstruction 2763
  **4.358 s**, top five record-breakers **3.561 s**. Seven model calls in total,
  all HTTP 200, all without reasoning content. These direct function tests did
  not use the production question ledger and are not browser/auth/load acceptance.
  Evidence: [DeepSeek smoke results](benchmarks/site-assistant-deepseek-2026-09-28-smoke.json).
- Targeted assistant tests: 33 passed; API typecheck passed. This change is prepared for a local commit only. Production environment and
  running service remain unchanged.
  Normal localhost Web requests still proxy to the production API unless the
  existing per-domain local API preview is explicitly enabled. The previous
  100-question Qwen benchmark must not be presented as DeepSeek acceptance.

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

The checked items below describe the earlier 100-question production release.
The new 1000-question migration and latency changes remain local and undeployed until explicitly released. See [response-time goals](site-assistant-performance.md).

The later access requirement is also local only: AI requires an authenticated
CubeRoot account with a currently linked real WCA ID, checked on the server before
quota reservation. It uses the existing account page and authentication header,
not a model decision or a client-supplied ID. The question API has no browser
CAPTCHA; other page/data protections remain. The 1000/day budget, account/IP burst
limits and concurrency protection remain; regular search stays available to guests.

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

- Later local-only performance work: [100 original questions](site-assistant-questions.md), two complete 100-question real-Qwen runs, five final targeted retests and browser checks. Latest per-question P50 4.31 s, P95 7.86 s, maximum 10.88 s; 73 data answers, 23 grounded scope clarifications and 4 documented data/grain gaps. See the [full report and preserved failures](site-assistant-benchmark-2026-09-28.md). This work remains undeployed; it does not change the earlier production release evidence below.

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
