# Google Play membership release setup

Source integration is not merchant activation, deployment, a signed build, or purchase acceptance.

## Product contract

- Package: `me.cuberoot.app`; native Google Play Billing Library 9.1.0.
- Subscription IDs: `me.cuberoot.app.membership.monthly` and `me.cuberoot.app.membership.yearly`.
- Each product must expose exactly one intended auto-renewing base plan with P1M or P1Y period respectively. The client selects the base plan (not trials/offers), displays its localized Play price, and launches that same offer token.
- Both plans grant the existing personal membership. Website, Apple and Google grants run concurrently; the effective membership view takes the latest expiry, preserving lifetime grants.
- Existing Play subscriptions use restore/manage rather than opening a second plan. In-app plan replacement UI is not provided in this first integration. Replacement tokens received from Play are reconciled safely.

## Owner / Console prerequisites

1. Complete the Google Payments merchant profile, verification, tax and payout details as requested by Console. The developer account alone is not a merchant account.
2. Create the two subscriptions and activate their base plans/prices/countries in Console. Prices must be an owner decision, not inferred from the Apple products.
3. In Google Cloud, enable Google Play Android Developer API and create a dedicated backend service account. Grant only the Play app permissions required to read purchases/subscriptions and manage orders/subscriptions. The owner must authorize access.
4. Store that account JSON on the API host outside Git with owner-only file permissions. Never place it in the APK/AAB, webpage, logs or chat.
5. Configure a Pub/Sub topic for this app's real-time developer notifications. Grant Google's Play notification publisher access to that topic. Configure an authenticated push subscription with a dedicated push service identity and the exact endpoint/audience below. Send Console's test notification and verify delivery before enabling purchases.

## Backend configuration (disabled by default)

Configured through the existing API secret-management process, not committed:

| Variable | Meaning |
| --- | --- |
| `GOOGLE_IAP_ENABLED` | `1` only after merchant/products, credentials and RTDN are ready |
| `GOOGLE_IAP_KEY_PATH` | Absolute path to backend service-account JSON |
| `GOOGLE_IAP_RTDN_AUDIENCE` | `https://api.cuberoot.me/v1/membership/google/notifications` |
| `GOOGLE_IAP_RTDN_SERVICE_ACCOUNT` | Exact verified email of the Pub/Sub authenticated-push identity |
| `GOOGLE_IAP_TEST_USER_IDS` | Comma-separated CubeRoot numeric UIDs allowed to receive membership from Play test purchases |

Deploy migration `0256_google_membership.sql` and the API/website through the existing GitHub Actions workflows. Configure Play license testers and the internal-test email list separately; a reviewer login is not automatically a license tester.

The backend always calls `purchases.subscriptionsv2.get`. Client/RTDN payloads are lookup hints only. It locks reconciliation, checks immutable ownership and replacement chains, commits the independent grant, then acknowledges with Google. Authenticated RTDN updates renewals/refunds while the app is closed; foreground/restore also reconciles stored tokens. A notification failure returns non-2xx for Pub/Sub retry. Configure dead-letter/retry monitoring in Cloud and monitor generic API reconciliation errors without logging purchase tokens.

Account merging moves all original random ownership identifiers in the existing transaction. Deletion tombstones the account reference, preserves necessary transaction evidence and blocks another account from claiming the old purchase. Deletion does not cancel store billing; users must cancel in Google Play.

## Signing and acceptance

Use a long-lived upload key kept outside the repository. Set the existing `MOBILE_UPLOAD_*` variables and `MOBILE_REQUIRE_RELEASE_SIGNING=true`; CI's one-day key is never a production key. Back up the keystore and password through the owner's password manager. Configure Play App Signing before first upload.

From `core/`, build shared and run `pnpm --filter @cuberoot/mobile cap:sync:android`. From the Android directory, use JDK 21 and run `./gradlew assembleRelease bundleRelease --no-daemon`. Record commit, version, SHA-256 hashes and certificate fingerprint; upload the AAB to internal testing and use the APK only for direct-install checks.

Required real Play acceptance: localized products; cancelled/pending/successful purchase; membership after restart; restore on another device with the same CubeRoot account; wrong-account refusal; renewal; cancellation retaining paid period; hold/grace; refund/revocation while app is closed; delayed/repeated notifications; account merge and deletion tombstone. Test with license testers to avoid unintended real charges. A compiled binary or mocked Google response does not close these gates.

Official references: [Billing integration](https://developer.android.com/google/play/billing/integrate), [subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions), [authenticated Pub/Sub](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [app signing](https://developer.android.com/studio/publish/app-signing).
