# Meeting scheduling

Local implementation; no push, migration on production, or deployment performed for this task.

## Behavior

- `/meet`: join by code/link, quick meeting, scheduled meetings grouped by the viewer's local date.
- Schedule title, start, duration, time zone and RRULE; daily/weekly/monthly/yearly/custom rules reuse the calendar engine and editor.
- Edit/cancel applies to the entire series. A cancelled schedule stops new token issuance; existing calls and already-issued short-lived credentials are not forcibly revoked.
- Lists are private to their creator. Copying an invitation shares the title, occurrence time and meeting link. Recipients use the existing authenticated code-based join flow.
- Prejoin defaults to camera off; microphone and camera choices still use LiveKit. Speaker volume can be disabled before joining and toggled during the meeting.
- Token requests time out after 20 seconds. Joining can be cancelled while pending, and late responses cannot enter an abandoned meeting. Meeting button sizing preserves the shared speaker switch's proportions.
- Past schedules are not attendance history. No recording or chat persistence was added.

## Backend and release boundary

Migration `0252_video_meetings.sql` adds `video_meet_codes` and `video_meetings`. The existing quick-code endpoint also needs this migration. The migration runner must apply it before the new API starts.

`GET/POST /v1/video/meet/plans` and `PATCH /v1/video/meet/plans/:id` use existing account authentication and `no-store`. Owner is always taken from the verified account. PostgreSQL advisory locking serializes quick/scheduled code allocation across workers. Existing four-digit codes remain compatible; scheduled and cancelled codes stay reserved to prevent old links from joining an unrelated scheduled room. The pool is finite (10,000 codes), with at most 100 saved schedules per owner; exhaustion returns an explicit error. Capacity and participant admission remain checked at actual join time, not reserved by scheduling.

The normal localhost server proxies `/v1` to production. Until this API and migration are deployed, the new schedule endpoints are unavailable there; refreshing cannot substitute for deployment. Do not deploy without authorization.

## Verification, 2026-09-28

- Shared build and client/server typecheck.
- 68 client tests, including recurrence/DST, input validation, meeting guards and dropdown viewport placement.
- 16 API tests, including three real PostgreSQL schedule integration cases: persistence, owner isolation, cancellation, invalid input and concurrent code allocation.
- Isolated local PostgreSQL 16 used for migration and integration validation; production targets PG13, and SQL uses PG13-compatible constructs. PG13 itself was not available on this Mac.
- Browser fixture used real Hono route and PostgreSQL data, with authentication and LiveKit mocked. Created, edited and cancelled a weekly schedule through the UI; cancellation removed all occurrences. No production appointments were written.
- Nine agenda viewports (320–1440px), seven form viewports, portrait/landscape, four theme combinations. Custom recurrence menu selected on a phone-width viewport after fixing the shared ListSelect's vertical placement.
- iOS/Android hardware, physical soft keyboards and real multi-party audio/video remain separate acceptance work.
- Follow-up: 13 meeting-code/request tests and client typecheck passed. Browser checks covered stalled-request timeout, cancellation and a successful real join with camera/microphone off; the test call was then ended.

Run integration tests against a disposable, migrated local database from `core/`:

```sh
MEET_TEST_DB_PORT=55439 MEET_TEST_DB_USER=eula pnpm --filter @cuberoot/server exec vitest run tests/video_meetings.test.ts
```

The test refuses its database-dependent cases unless `MEET_TEST_DB_PORT` is set. An optional `MEET_TEST_UI_PORT` opens a localhost-only browser fixture until `POST /__test/stop`; it is not a development authentication mechanism and must never serve production users. Browser request interception used during this task was removed after verification.
