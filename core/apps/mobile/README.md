# CubeRoot Mobile

React + Vite + Capacitor 8 host. Android and iOS use the same React UI and shared business logic. CubeRoot's committed product target also includes HarmonyOS NEXT, Windows and macOS under the [five-platform single-source contract](../../../docs/cross-platform-app-contract.md); those platforms add thin hosts and must not fork this app's business UI.

Status: active native app. `src/`, `package.json`, `capacitor.config.ts`, `android/`, `ios/` and this README are its local implementation sources of truth; progress is recorded only in `docs/mobile-app-roadmap.md`, and the website is not this app's source tree.

The bundled Timer surface is local-first: timing, statistics, settings and history work from the packaged `dist/` without a network connection. Real competition scrambles use a bounded per-event online/cache hybrid (50 entries, seven-day TTL). For one of the 19 Timer events mapped to a real WCA pool, a cold offline miss is an explicit loading/error state and never silently substitutes a random scramble. For an event with no WCA mapping, the canonical Web behavior keeps “Real” selected but uses that same event's local provider; it must never fall back to 3×3. Tools and Account are explicit online surfaces that display the real website inside the shared three-tab shell; the remote website is not the app's automatic start screen and is never copied into Mobile source.

During inspection and an active solve, the shared mobile UI requests the standard screen wake lock and releases it immediately afterward. The official Capacitor Haptics plugin provides ready/stop feedback when supported; unsupported devices keep the timer functional without a second platform-specific timing implementation.

Android and iOS smart-cube access use a thin `@capacitor-community/bluetooth-le` transport. GAN v4 decryption, advertisement MAC extraction, lost-move recovery, device-clock reconciliation, cube-state tracking and timer transitions live in `@cuberoot/shared`; the App does not carry a second protocol or timing implementation. The verified first device pair is an OPPO Reno7 Pro 5G `PFDM00` on Android 13 / ColorOS 13.1 with a GAN 16 UI. Real notifications, parsed turns and a complete scramble-match → first-turn start → solved-state stop flow have passed on that pair; the first recorded hardware solve was `5.20`. On iOS, the native picker returns a CoreBluetooth UUID, so the adapter performs a bounded exact-device advertisement scan and passes manufacturer data to the same shared MAC extractor. That iOS source path has automated coverage, but support is not claimed until an iPhone + GAN device completes the hardware matrix.

## Maintenance rule

- The highest-level installed-client contract is `docs/cross-platform-app-contract.md`: Android, iOS, HarmonyOS NEXT, Windows, and macOS are one product backed by shared domain/UI code and thin platform hosts. This package remains the Android/iOS Capacitor host; it must not become a source dependency of future Harmony/Desktop apps.
- The three-surface contract is `docs/mobile-three-tab-contract.md`: all installed clients share Timer, Tools, and Account. Timer follows the dedicated parity tracker; Tools and Account display the real website instead of copying its cards, routes, or account UI into a host.
- Tools and Account keep separate website browsing contexts inside the shared React shell. Their system-back behavior uses the runtime-neutral `@cuberoot/shared/mobile-embed` message contract plus the website's no-UI `MobileEmbedBridge`; never replace that with Android-only or iOS-only route tables.
- The complete timer product must track the website `/timer` UI and behavior through `docs/mobile-timer-parity-tracker.md`, with `docs/mobile-timer-zero-omission-audit.md` as its mandatory adversarial inventory. Visual similarity alone is not completion: every visible control needs the same real interaction and state, and Web/Mobile shared React UI belongs in `@cuberoot/timer-ui` instead of being copied into this app.
- Keep framework-free timer, scramble, validation, statistics and serialization logic in `@cuberoot/shared` so the website and app import the same implementation.
- Keep mobile-owned code to the compact native workflow, IndexedDB adapter and native bridges.
- Fetch changing content through versioned APIs or static data instead of copying it into the app.
- Do not copy or independently reimplement the website inside this package; Tools and Account display its canonical online routes.
- Keep Web Bluetooth and Capacitor BLE as thin platform transports over the same shared protocol, state and clock modules.
- Every capability reachable on website `/timer` remains a parity obligation. A missing Mobile adapter/effect keeps the corresponding roadmap item incomplete; temporary capability guards must not be documented as acceptance, silently turn multiplayer into read-only one-player state, or make an omitted Stackmat entry count as complete.

## Five-platform target

The five target platforms deliberately use three host boundaries rather than five business implementations:

- `core/apps/mobile`: the existing Capacitor host for Android and iOS.
- `core/apps/harmony`: the planned ArkTS + ArkWeb host for HarmonyOS NEXT.
- `core/apps/desktop`: the planned single Tauri host for both Windows and macOS.

When the first non-Capacitor host is implemented, extract the shared three-surface React composition from this app into a real multi-consumer `@cuberoot/app-ui` package in the same change. Do not create an empty abstraction in advance, and do not let another app import `core/apps/mobile/src`, this app's CSS, or `dist`. Timer UI continues to migrate into `@cuberoot/timer-ui`; domain rules, schemas, protocols, and state machines with real cross-runtime consumers live in `@cuberoot/shared`. A single-host capability interface stays in its app until the same change introduces a second real consumer.

Harmony and Desktop hosts may implement only system adapters such as BLE transport, secure storage, auth/deep-link handoff, files, sharing, printing, wake lock, windowing, and lifecycle. A PWA remains a useful website entry, but it is not evidence that the committed Windows or macOS client target is complete.

## Commands

Run these from `core/`:

```powershell
pnpm --filter @cuberoot/mobile dev
pnpm --filter @cuberoot/mobile test
pnpm --filter @cuberoot/mobile typecheck
pnpm --filter @cuberoot/mobile build
pnpm --filter @cuberoot/mobile assets:android
pnpm --filter @cuberoot/mobile assets:ios
pnpm --filter @cuberoot/mobile cap:sync
pnpm --filter @cuberoot/mobile cap:sync:android
pnpm --filter @cuberoot/mobile cap:sync:ios
pnpm --filter @cuberoot/mobile android:open
pnpm --filter @cuberoot/mobile android:run
pnpm --filter @cuberoot/mobile ios:doctor
pnpm --filter @cuberoot/mobile ios:build
pnpm --filter @cuberoot/mobile ios:open
pnpm --filter @cuberoot/mobile ios:run
```

`cap:sync` remains the Android-compatible entry point. The platform-specific sync commands build the same web app and copy it into the selected native project. Run the matching command after changing React or shared code and before making a native build.

## Android emulator on macOS

An Android phone is not required for ordinary UI development. Use the official Android Studio AVD for installation, startup, layout, timing, persistence and basic lifecycle checks. From Android Studio, open **Tools > Device Manager**, start an available virtual device, then run this from `core/`:

```powershell
pnpm --filter @cuberoot/mobile android:run
```

For command-line diagnosis, discover the current SDK and AVD instead of assuming a machine-specific name or path:

```bash
"$ANDROID_HOME/emulator/emulator" -list-avds
adb devices
"$ANDROID_HOME/emulator/emulator" -avd <AVD_NAME> -gpu host
```

The first full boot can take more than two minutes. If `adb devices` temporarily reports `offline`, wait for the boot before reinstalling; if it remains stuck, restart ADB and cold-boot without loading a stale snapshot:

```bash
adb kill-server
adb start-server
"$ANDROID_HOME/emulator/emulator" -avd <AVD_NAME> -gpu host -no-snapshot-load
```

Read the emulator log before changing settings. On the current 16 GB development Mac, the API 36 AVD allocates about 2.5 GB itself and the GUI reported needing about 5 GB of host memory available; keeping 6–8 GB available is a practical target when Android Studio is also open. Close memory-heavy apps if the emulator falls back to slow software graphics. Do not use `-wipe-data` unless losing all data inside that AVD is explicitly acceptable.

An emulator does not close the physical-device gates. BLE smart-cube transport, real haptic feel, OEM permission behavior, background/power behavior, sharing and release installation still require an Android phone before their roadmap items can be checked off. The current OPPO + GAN 16 UI pair closes only the explicitly recorded BLE scan/connect/notify/move gates; disconnect, background and adverse-condition tests remain separate.

On macOS, run `ios:doctor` first, use `ios:build` for a repeatable unsigned Simulator build, and use `ios:open` for signing or device work in the checked-in Xcode project. If `ios:doctor` cannot find `simctl`, open Xcode > Settings > Locations > Command Line Tools and select the installed Xcode. A shell-scoped `DEVELOPER_DIR` or `sudo xcode-select --switch <Xcode.app>/Contents/Developer` is also valid; no personal Xcode path is stored in the repository. Keep Automatic Signing enabled and select the paid Apple Developer team locally; Xcode account state, signing credentials, provisioning profiles, DerivedData and `xcuserdata` must never be committed.

`assets:android` first regenerates the website/PWA icons, then derives every Android launcher density and the light/dark Android system splash. `assets:ios` derives the opaque App Store icon and light/dark launch images from the same brand source. The brand SVG and one locked `sharp` dependency are the only sources, so there is no second hand-maintained image set. CI reruns both generators and fails on tracked or untracked drift.

## Persistence

`src/data/timer-repository.ts` is the only mobile timer storage boundary. It writes schema-versioned `TimerStoreData` with a nested canonical `TimerDatabase` from `@cuberoot/shared/timer` to IndexedDB and serializes concurrent changes. Website database v1/v2/v3 and App envelope v1/v2 use the same decoder and migration chain. Import is limited to 10 MB, previews record counts, writes an atomic recovery copy, and offers one undo; invalid data never replaces the current valid database.

## Account authentication

Android and iOS use one authentication client in `src/auth/mobile-auth.ts`; do not add native login forms or a second account model. There are two distinct surfaces that must not be conflated:

- The bottom Account tab loads the canonical website `/account` or `/zh/account` without `auth=mobile`. It must expose the same provider set and account-management UI as the website, driven by the website's current provider configuration.
- The Account iframe delegates every interaction in the canonical website `LoginForm` to the system browser: email/phone/password use the first-party handoff, while WCA/Google/WeChat/QQ/Alipay preserve a provider marker and expose the website's full configured provider list. The browser returns a 90-second one-time ticket through the registered App callback. The ticket is bound to an App-generated PKCE S256 challenge and state; the verifier and long-lived JWT never enter the browser URL.

The API reuses `auth_web_session_tickets` with separate `web` and `mobile` purposes. Cross-runtime request, callback, session, and error validation lives in `@cuberoot/shared/auth/web-session`. The canonical session is stored through `@aparajita/capacitor-secure-storage` with iCloud synchronization disabled and `whenUnlockedThisDeviceOnly`; this maps to iOS Keychain and Android Keystore-backed encryption. Startup validates `/auth/me`, refreshes expiring tokens through `/auth/refresh`, retains the last valid session during a temporary offline failure, and clears it only after an explicit unauthorized response or sign-out.

Keep these boundaries:

- The website remains the only credential, identity-linking, profile, and account-deletion UI. The bottom Account tab displays that exact online page; Browser fallback may open the same page for actions that cannot run in an iframe.
- The Account tab must not use `auth=mobile`. A provider-less handoff deliberately sets `LoginForm` to `firstPartyOnly`; a provider-tagged handoff is allowed to expose the canonical SSO list only in the system Browser. The query remains a native PKCE ticket handoff detail, not the Account-tab URL.
- Rendering the full provider set is not functional completion. WCA refuses iframe embedding with `X-Frame-Options: SAMEORIGIN`, so source now delegates all Account login interactions to the system Browser and reuses the existing web/mobile one-time-ticket endpoints. Google and every configured social-provider app/callback flow still require real Android/iOS account tests.
- Source now synchronizes a restored native session into the Account iframe with a 90-second web-session ticket, propagates iframe logout/deletion back to secure storage, and propagates the App settings logout into the iframe. These are still separate storage contexts: deployment plus real-account E2E is required, a pre-existing iframe-only session is not adopted automatically, and logout performed directly in an external Browser cannot notify a sleeping App. Long-lived JWTs must never enter URLs or `postMessage`.
- The canonical Account tab intentionally exposes every provider the website exposes. Because this includes Google/WeChat-style primary-account login, iOS App Store release is blocked until the canonical website `LoginForm` and backend provide a verified equivalent login satisfying current Apple Guideline 4.8 (prefer Sign in with Apple), without building an iOS-only form or hiding providers to claim parity.
- Login does not imply cloud sync. Timer records, comments, and settings still remain local until the roadmap's merge, conflict, deletion, and multi-device sync design is implemented and tested.
- Release and debug callbacks are `me.cuberoot.app://auth/callback` and `me.cuberoot.app.debug://auth/callback`. Keep the shared allowlist, Android manifest, iOS URL types, and Capacitor application IDs aligned.

## Android release build

`package.json` is the single `versionName` source. Gradle derives `versionCode` as `major * 1,000,000 + minor * 1,000 + patch`; set `MOBILE_VERSION_CODE` only when Play requires a higher monotonic code without changing the public version.

Keep the real upload keystore and passwords outside the repository. From `core/apps/mobile/android/`, set all four variables together and require signing:

```powershell
$env:MOBILE_UPLOAD_KEYSTORE_FILE = 'C:\secure\cuberoot-upload.jks'
$env:MOBILE_UPLOAD_STORE_PASSWORD = '<from password manager>'
$env:MOBILE_UPLOAD_KEY_ALIAS = 'cuberoot-upload'
$env:MOBILE_UPLOAD_KEY_PASSWORD = '<from password manager>'
$env:MOBILE_REQUIRE_RELEASE_SIGNING = 'true'
./gradlew.bat clean assembleRelease bundleRelease --no-daemon --max-workers=14
```

The Play upload artifact is `app/build/outputs/bundle/release/app-release.aab`. CI uses a disposable key to prove that release signing works; it is not the production upload key. Enroll the real key in Play App Signing, back it up through the password-management process, and verify internal-track upgrade/rollback before production.

## Permanent identifiers

- App name: `CubeRoot`
- Release Android application ID: `me.cuberoot.app`
- Debug Android application ID: `me.cuberoot.app.debug`
- Web output: `dist/`

The debug suffix lets development builds coexist with the signed release app. Do not change the release application ID after the first Play Store release.

## Windows Android prerequisites

Install Android Studio 2025.2.1 or newer, JDK 21 and an Android SDK platform. Capacitor 8 compiles Android sources at Java 21; if the machine default is Java 8 or an unsupported newer JDK, point `JAVA_HOME` at JDK 21 for Gradle rather than changing the project source level. The Capacitor 8 project uses Android API 26 as its minimum runtime and currently targets API 36. External website/privacy links use the official Capacitor Browser plugin. The App does not request camera or microphone access. Smart-cube connection requests Android 12+ Nearby devices (`BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT`) only after the user taps Connect; scanning is declared `neverForLocation`. Android 11 and older retain the platform-required Bluetooth/location compatibility permissions capped at API 30.
