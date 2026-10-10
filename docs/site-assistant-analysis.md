# Assistant on-demand analysis

The assistant can calculate new answers from public data instead of requiring a precomputed statistic for every question. Existing specialized tools remain the preferred path when they answer the exact question.

## Data and query contract

`analysis_schema` exposes the reviewed projections and the structured query grammar. `analysis_query` accepts a relational plan, not SQL or executable code. The server validates relation/column names and compiles bound parameters. It supports filtering, joins, distinct counts, grouping, conditional expressions, arithmetic, medians, window functions and up to three untruncated intermediate queries. Only the final result has a row limit.

Sources: official imported WCA round results and attempts, competition metadata, current competitor identity/country, country metadata, public reconstructions, published formula cases and non-deleted glossary entries. WCA dates are competition start dates. Current nationality is not historical nationality. WCA encodings, absent attempts, DNF/DNS, join multiplicity and result units are documented in the schema tool. No private account, payment, registration, private/unlisted reconstruction or training-history data is exposed.

The projection contract lives in `site_assistant_analysis.ts`; the PostgreSQL views and grants are in migration `0267` and snapshot `schema_assistant.pg.sql`. The latter depends on the existing WCA mirror schemas, unlike the core-only `schema.pg.sql`. Integration tests compare every advertised column to the real view. Statistics importers retain live relation OIDs (`pg-refresh.ts`), preserving these views and permissions.

## Execution boundary

- `cuberoot_assistant_reader` is a fixed NOLOGIN role, granted SELECT only on `assistant_public` projections. The API sets this role inside a fresh read-only transaction. Filtered views use `security_barrier`.
- PostgreSQL role creation is privileged and separate from schema migrations. Deploy Core runs the fixed `ops/bin/provision-assistant-reader.sql` as the PostgreSQL administrator, grants membership to the existing API role, then applies normal migrations before switching the API release. The application role is not given CREATEROLE or administrator rights.
- Each analysis uses an independent connection, with at most two analyses per API process and no queued analysis workload. Statement timeout: 4 seconds; lock timeout: 500 ms; connection/transaction wall deadline: 6.5 seconds; work memory: 4 MB; query parallel workers: zero. Plans costing over 1,000,000 are rejected. These are bounded interactive queries, not an unrestricted offline compute service.
- Only fixed operators/functions can be compiled. No raw SQL, recursive CTEs, arbitrary joins, files, URLs, network calls, role changes or writes are accepted from the model. All literal values are parameters. Output is capped at 100 rows plus a truncation probe, 500 characters per cell and about 9,000 characters of row data.
- WCA ID literals must already be resolved from the visitor, supplied conversation identity or a person lookup. Imported WCA analyses require import metadata. Errors produce non-evidence and sanitized correction guidance; timeouts, missing imports and empty sets must never be represented as zero counts. Cancellation terminates the independent query connection.

These mechanisms are enforced by code and PostgreSQL, rather than relying on the model prompt. PostgreSQL's [read-only transaction contract](https://www.postgresql.org/docs/13/sql-set-transaction.html) and [execution settings](https://www.postgresql.org/docs/13/runtime-config-client.html) define the database boundary.

## Verification and operation

Run targeted compiler/assistant tests and `site_assistant_analysis_pg.test.ts` against a dedicated empty local database named `assistant_analysis_test` with `ASSISTANT_ANALYSIS_PG_TEST=1` and `DB_HOST=127.0.0.1`. CI performs the same integration test on PostgreSQL 13. Never point fixtures at the application DB.

A real model acceptance run must include different computations without adding per-question code: monthly deduplicated attendance, a filtered success/DNF ratio, aggregation over public reconstructions or formula cases, and a multi-stage comparison. Compare results with independent public-source calculations or hand-verified fixtures. Check public HTTPS behavior after deployment separately from local model runs.

To disable analysis during an incident, revoke the reader role's USAGE on `assistant_public` through a reviewed migration; specialized tools still work and analysis fails closed. Code rollback can leave these read-only views installed; no private data has been copied or business tables rewritten. Extending scope requires review of projections, units, ACLs and integration fixtures. Arbitrary code execution, private data and live external-source research are not part of this interface.

### 2026-10-10 pre-release evidence

The configured `deepseek-flash` provider executed this implementation against an isolated PostgreSQL fixture through a temporary loopback SSH tunnel. It produced deduplicated monthly counts of 1 and 1, an attempt DNF ratio of 1/18, a public-reconstruction median of 4.5 seconds from one sample (private/unlisted rows excluded), and a staged monthly difference of 0 with the first predecessor left NULL. The first run exposed round-versus-attempt confusion and unhelpful errors for unsupported functions; schema semantics and repair messages were corrected, then both affected cases passed. The multi-stage run also recovered from malformed model JSON using the existing bounded repair round. These are fixture/model checks, not production data acceptance.
