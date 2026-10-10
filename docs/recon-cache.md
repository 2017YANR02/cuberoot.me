# Reconstruction cache invalidation

Recon HTML and SEO data remain ISR-cached. The API owns write completion and
notifies each independent Next deployment after recon create/update/delete,
admin overlay save/delete, and alternative writes. The editor's server action
additionally clears its current origin (including local development).

The internal `POST /api/recon/revalidate` route accepts `{ "id": "2796" }` with
`Authorization: Bearer <RECON_REVALIDATE_SECRET>`. It immediately expires the
recon tag and the shared same-scramble tag, covering both languages, cosmetic
slugs, and related recon cards. It rejects missing credentials and invalid IDs.

## Release configuration

This configuration is required when releasing the change; a local commit does
not configure or invalidate production caches.

- Generate one random secret of at least 32 bytes. Set `RECON_REVALIDATE_SECRET`
  in the Hono runtime `/root/core-api/.env`, Vercel production environment, and
  `/etc/cuberoot-next.env` for the standalone systemd service. Never use a
  `NEXT_PUBLIC_` variable or commit the secret.
- In the Hono environment set `RECON_REVALIDATE_URLS` to a comma-separated list
  of the two HTTPS webhook URLs: the project's stable production `vercel.app`
  domain plus `https://next.cuberoot.me/api/recon/revalidate`. Use the actual
  Vercel project domain, not the geographically routed main domain: otherwise
  both notifications could reach the same cache. Do not use a preview URL.
- Deploy through the existing workflows after release authorization. Ensure
  the systemd unit is refreshed and both Next receivers are live before
  enabling the API sender. Vercel environment changes require a redeploy.
- Check an authenticated webhook response from each destination is
  `{ "revalidated": true }`, then read the changed recon from both destinations
  to verify fresh HTML. Requests without the secret must return 401.

Delivery waits for both destinations, with one retry and a three-second timeout
per attempt. Failure is logged as `[recon-cache] invalidation failed`; missing
configuration is also logged. Already saved database writes still succeed.
There is no persistent delivery queue: a prolonged outage may leave SSR/SEO
stale until another successful invalidation or the 24-hour ISR refresh.

The visible detail page also fetches uncached data on mount and window focus,
retains the first paint during transient errors, and discards stale content on
401/403/404. This catches missed notifications for browser viewers; it does not
purge cached HTML or replace the webhook for privacy changes and search engines.
The detail API returns `no-store`, including public and missing recons.

Direct SQL edits bypass API notifications; maintenance that changes recon rows
must explicitly notify both receivers after committing the data.

The same authenticated receiver also accepts `{ "kind": "forum", "id": "42" }`
to expire a forum thread's metadata, or `{ "kind": "forum" }` for moderation
that can affect several threads. Successful forum content writes notify both
deployments; views and reactions do not. The forum fallback ISR interval is
one hour. See [public-content-cache.md](public-content-cache.md) for the separate
revision-based public API response cache and its load/freshness boundaries.

The receiver also accepts `{ "kind": "alg" }` without an ID. Successful writes
under `/v1/alg/sets/*` expire the `alg-catalog` tag on both deployments. Puzzle
catalog HTML includes its SVG covers from `/v1/alg/sets/:puzzle/catalog?v=1`:
one first case and count per set, plus the catalog order. The catalog uses a
60-second ISR fallback; the browser conditionally revalidates the compact
snapshot on mount and return-to-page events, retaining covers during outages.
Direct SQL changes update the API revision but still need a webhook to expire
cached HTML immediately. This does not cache complete formula sets in the
catalog or change their detail-page loading contract.
