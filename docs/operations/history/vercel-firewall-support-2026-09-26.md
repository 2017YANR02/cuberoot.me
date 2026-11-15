# Vercel Firewall large-configuration write failure

Prepared support request; not yet sent. No token, CAPTCHA secret, or raw client IP list is included.

## Project and impact

- Team: `cube-root`
- Project: `cuberoot-me`, ID `prj_uTyIXz9tCTveCM46YooXnIWbCSLb`
- Date: 2026-09-26 UTC
- Existing incident controls and China mainland exemption must remain intact.
- 135,506 distinct source IPs have been recorded from two incident deny rules. The existing exact-IP rules cover 24,000 addresses. Remaining records must not be described as having a persistent 30-day exact-IP rule.

## Confirmed behavior

1. GET active configuration succeeds. Small PATCH updates and insertion of a one-IP rule succeed with the same credential.
2. Updating the thirteenth list rule to 1,500 IPs succeeds; 1,700 and 1,875 fail with HTTP 500 and `FIREWALL_INTERNAL_ERROR: Unexpected Internal Error`.
3. Inserting a separate 1,500-IP rule also fails. The project has fewer than 40 custom rules.
4. An anchored, exact-IP regular expression for 500 addresses succeeds and reads back as valid. A larger 10,000-address rule fails. No CIDR widening was used.
5. A full PUT, preserving all other controls and IDs, also fails. Its candidate includes all 135,506 IPs in 272 regex condition groups across 11 active list rules, retaining existing unused slots disabled. Total custom rules: 24. JSON body: 1,102,455 bytes.
6. After the failed PUT, active version remains 284 and non-managed rules are unchanged. The original timer was resumed and the 24,000-IP configuration retained.

## Request traces

| Request | HTTP | x-vercel-id |
| --- | --- | --- |
| PATCH insert one exact IP | 200 | `sfo1::59b7z-1790428392024-e5edbf194298` |
| PATCH two-IP regex | 200 | `sfo1::24gdv-1790428689475-294755be918d` |
| PATCH 500-IP regex | 200 | `sfo1::g95kb-1790429139234-64b5a7febfe0` |
| PATCH 10,000-IP regex | 500 | `sfo1::58qrf-1790429322461-a15b18931f5b` |
| PUT full compact configuration | 500 | `sfo1::kxvnc-1790430123727-5aa2bb2ea5a7` |

Endpoints: `PATCH /v1/security/firewall/config` and `PUT /v1/security/firewall/config`, scoped by projectId and teamId.

## Questions for Vercel

1. Please identify the server-side failure from these request IDs. Is there a configuration byte-size, compiled-expression, total-condition, or other limit not represented by the 40-rule limit?
2. What supported mechanism can enforce 30-day exact-source-IP denies at this scale on the existing plan, without enabling another paid service?
3. Rules accept `actionDuration: "30d"` and read back as valid, but observed persistent-action event end times are approximately 24 hours after their start times. Does this field represent actual ban expiration, and is the duration capped or interpreted differently?

No root cause beyond the reproducible large-configuration failure is asserted. A 24,000-IP operating budget is a temporary observed value, not a documented Vercel platform limit.
