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
- [ ] Exact original question: 三阶魔方世界纪录. Answer single and average with holders, competition, date and data freshness.
- [ ] Conversation UI: follow-ups, examples, stop, retry, new conversation, sources, accessible desktop/mobile layout.
- [ ] Person profiles and PRs; resolve names without guessing WCA IDs.
- [ ] Current/historical rankings, geographic/event/type filters.
- [ ] Competitor comparisons and PR progression charts.
- [ ] Upcoming and historical competition discovery.
- [ ] Official competition scrambles by event/round.
- [ ] Published reconstructions and analysis from recorded move sequences.
- [ ] Site-wide public page search/read plus structured tutorial, glossary, regulation, algorithm and public forum content.
- [ ] Representative bilingual, follow-up, unavailable-data and adversarial-query acceptance suite.
- [ ] Deployment and real browser acceptance of the expanded assistant.

## Boundaries

API keys stay on the server. Public answers never receive admin/private records.
Every public question consumes one daily reservation even if the model needs
multiple bounded read operations. Model output is text, never executable SQL,
HTML, code or an arbitrary URL to fetch. Dates and result formatting use the
existing WCA contracts. Stored public data can lag official publication; show its
actual update time rather than implying live results.

Deployment evidence is recorded separately from local checks. Quota release:
`d55520764a`; expanded assistant work is not yet released.

## Originality requirement

The owner explicitly requested original example questions, wording, interface and implementation. CubeStats is only a capability benchmark. Public examples use CubeRoot-specific learning questions, different people and regions; no third-party source code or assets were copied. Feature breadth and correctness must be measured, not advertised as an unqualified superiority claim.

CubeStats was added to the production web directory under Competition & Stats (nav site 389), with an original bilingual description and https://cubestats.in/ as its destination. Browser search verification succeeded.

## Local acceptance evidence

- Original records query now reads the published records bundle, including ties and its update date. Real Qwen call returned both 3x3 records and a source table.
- Real model/data calls covered person profiles, rankings, comparisons (four PR charts), competition discovery, WC2023 official final scrambles, public reconstruction 761, glossary questions and a contextual PR follow-up.
- Fixed stale upcoming index filtering and model interpretation of long PR arrays; model now receives programmatically computed first/current/recent milestones while charts retain every strict PR point.
- Data-adapter fixtures cover record ties, invalid results, stale competitions, private reconstruction exclusion, typed tool bounds and raw PR values. Route fixtures cover persistent quota behavior, failures, malformed inputs and bounded tool loops.
- Desktop dialog/chart rendering inspected with a recorded real-model response. 390×844 layout inspected without horizontal overflow. This is separate from pending production browser acceptance.
- Source code/type checks and targeted frontend/backend tests pass; production build/index and deployed end-to-end checks remain pending below.
