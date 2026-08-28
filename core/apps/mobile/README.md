# CubeRoot Mobile

React + Vite + Capacitor 8 app. Android and iOS use the same React UI and shared business logic.

Status: active native app. `package.json`, `capacitor.config.ts`, `android/` and this README are its local sources of truth; the website is not its source tree.

The bundled app is local-first: timing, statistics, settings and history work from the packaged `dist/` without a network connection. Real competition scrambles use a bounded online/cache hybrid (50 entries, seven-day TTL); a cold offline launch falls back to the shared local scramble generator instead of bundling the 1.3 million-entry corpus. The full website is an explicit secondary link, never the app's runtime or automatic start screen.

During inspection and an active solve, the shared mobile UI requests the standard screen wake lock and releases it immediately afterward. The official Capacitor Haptics plugin provides ready/stop feedback when supported; unsupported devices keep the timer functional without a second platform-specific timing implementation.

## Maintenance rule

- Keep framework-free timer, scramble, validation, statistics and serialization logic in `@cuberoot/shared` so the website and app import the same implementation.
- Keep mobile-owned code to the compact native workflow, IndexedDB adapter and native bridges.
- Fetch changing content through versioned APIs or static data instead of copying it into the app.
- Do not reproduce the full website inside this package.

## Commands

Run these from `core/`:

```powershell
pnpm --filter @cuberoot/mobile dev
pnpm --filter @cuberoot/mobile test
pnpm --filter @cuberoot/mobile typecheck
pnpm --filter @cuberoot/mobile build
pnpm --filter @cuberoot/mobile assets:android
pnpm --filter @cuberoot/mobile cap:sync
pnpm --filter @cuberoot/mobile cap:sync:android
pnpm --filter @cuberoot/mobile cap:sync:ios
pnpm --filter @cuberoot/mobile android:open
pnpm --filter @cuberoot/mobile ios:doctor
pnpm --filter @cuberoot/mobile ios:build
pnpm --filter @cuberoot/mobile ios:open
pnpm --filter @cuberoot/mobile ios:run
```

`cap:sync` remains the Android-compatible entry point. The platform-specific sync commands build the same web app and copy it into the selected native project. Run the matching command after changing React or shared code and before making a native build.

On macOS, run `ios:doctor` first, use `ios:build` for a repeatable unsigned Simulator build, and use `ios:open` for signing or device work in the checked-in Xcode project. If `ios:doctor` cannot find `simctl`, open Xcode > Settings > Locations > Command Line Tools and select the installed Xcode. A shell-scoped `DEVELOPER_DIR` or `sudo xcode-select --switch <Xcode.app>/Contents/Developer` is also valid; no personal Xcode path is stored in the repository. Keep Automatic Signing enabled and select the paid Apple Developer team locally; Xcode account state, signing credentials, provisioning profiles, DerivedData and `xcuserdata` must never be committed.

`assets:android` first regenerates the website/PWA icons, then derives every Android launcher density and the light/dark Android system splash. The brand SVG and one locked `sharp` dependency are the only sources, so there is no second hand-maintained image set. CI reruns the generator and fails on tracked or untracked drift.

## Persistence

`src/data/timer-repository.ts` is the only mobile timer storage boundary. It writes schema-versioned `TimerStoreData` with a nested canonical `TimerDatabase` from `@cuberoot/shared/timer` to IndexedDB and serializes concurrent changes. Website database v1/v2/v3 and App envelope v1/v2 use the same decoder and migration chain. Import is limited to 10 MB, previews record counts, writes an atomic recovery copy, and offers one undo; invalid data never replaces the current valid database.

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

Install Android Studio 2025.2.1 or newer, JDK 21 and an Android SDK platform. Capacitor 8 compiles Android sources at Java 21; if the machine default is Java 8 or an unsupported newer JDK, point `JAVA_HOME` at JDK 21 for Gradle rather than changing the project source level. The Capacitor 8 project uses Android API 26 as its minimum runtime and currently targets API 36. External website/privacy links use the official Capacitor Browser plugin; the App does not request camera, microphone, location, or Bluetooth permissions until those features are implemented and tested.
