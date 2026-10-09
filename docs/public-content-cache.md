# Editable public content freshness

Local implementation; production activation requires migration 0266 and API +
Web deployment. A local commit alone does not change production behavior.

## Request and write behavior

Reviewed public GETs now use `public, no-cache, must-revalidate`: algorithm sets
and ordering, navigation sites/topics/home ordering, sponsors/contributors,
operations commands, page notices, recon latest/today/same-scramble, creator
gallery captions, simulator masks/layout, and the published article list.
Browser callers request `cache: 'no-cache'`, including against previously cached
responses. Browsers can retain the payload but must validate it on every read.

Each covered request reads one domain revision by primary key from PG.
Statement triggers increment that revision in the same transaction as a data
write, including direct SQL. Rollbacks also roll back the revision. Each API
worker can reuse a generated JSON response only while its stored revision
matches. Unchanged content returns an ETag and bodyless 304 when the browser
supplies its validator. A committed change is visible on the next request that
begins after commit, across workers. Concurrent requests already in progress
may finish with their previous snapshot.

The worker stores at most 256 responses with a 32 MiB UTF-8 body budget and a
five-minute retention limit. This is a payload budget, not a bound on process
RSS or transient serialization allocations. Expiry triggers regeneration;
it does not allow five minutes of stale content after a committed edit.
Missing revisions or failed version queries fall back to fresh reads with
`no-store`. Non-success and empty payloads are not cached. Scheduled notices
always rerun their time filter, even when no one edited them.

Only reviewed viewer-independent routes participate. Sponsor admin views,
private article lists, article details (which include `canEdit`), accounts and
teacher data are excluded. Recon account links additionally invalidate when
an account is inserted/deleted or its identity mapping changes; routine profile
or session changes do not invalidate this domain.

Visible read effects refresh on return to the tab for the affected content
views. There is no periodic polling. Focus/visibility pairs are deduplicated;
active inputs, dialogs and explicitly active editors pause automatic refresh.
A page that stays open in the foreground does not receive pushed live updates.

## Load and limits

Compared with a browser cache hit, validation adds an HTTP request and one
indexed revision lookup. Compared with uncached reads it usually avoids full
list queries, JSON generation and payload transfer. Writes add one revision
update per affected statement and serialize writers within that content domain.
Cold misses are not coalesced. Actual CPU, database connections, latency and
bandwidth under production traffic still require post-release observation;
local regression tests are not a capacity benchmark.

Forum SEO invalidation reuses the protected recon webhook after successful
thread/post writes and moderation. Views and reactions do not notify Next.
Configure both independent Next destinations as described in
[recon-cache.md](recon-cache.md). Failed webhook delivery is logged and retried
once, without a persistent queue. It cannot guarantee immediate SEO freshness
during an outage; forum ISR remains a one-hour fallback. Direct SQL changes to
forum content require explicit notification after commit.

This does not turn source files or generated static assets into database
content. Local source edits still require deployment; local-only DB edits do
not synchronize to production. WCA statistics, immutable assets and legacy
static tutorial catalogs retain their separate publication/cache contracts.

## Local evidence

- Hono regression coverage: 100 unchanged conditional reads reuse one generated
  response, cross-worker edits, failed revision lookup, scheduled notices,
  private/admin exclusions, entry eviction and empty responses.
- React coverage: return events deduplicate, no background polling, editing
  pauses refresh. Forum coverage: mutation selection and protected tag routing.
- PG 13 transaction fixture: statement-level insert/update/delete/truncate
  invalidation and rollback, plus account identity mapping changes.
- Shared build and client/API typechecks. No production migration, webhook
  configuration, push or production traffic benchmark was performed.
