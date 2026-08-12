# CubeRoot Mobile

React + Vite + Capacitor 8 app. Android is the first native target; iOS can be added from macOS later without duplicating the React UI.

The bundled app is local-first: timing, scrambles, statistics, settings and history work from the packaged `dist/` without a network connection. The full website is an explicit secondary link, never the app's runtime or automatic start screen.

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
pnpm --filter @cuberoot/mobile android:open
```

`cap:sync` builds the web app and copies it into the native Android project. Run it after changing React code and before making a native build.

`assets:android` first regenerates the website/PWA icons, then derives every Android launcher density and the light/dark Android system splash. The brand SVG and one locked `sharp` dependency are the only sources, so there is no second hand-maintained image set. CI reruns the generator and fails on tracked or untracked drift.

## Persistence

`src/data/timer-repository.ts` is the only mobile timer storage boundary. It writes schema-versioned `TimerStoreData` with a nested canonical `TimerDatabase` from `@cuberoot/shared/timer` to IndexedDB and serializes concurrent changes. Website database v1/v2/v3 and App envelope v1/v2 use the same decoder and migration chain. Import is limited to 10 MB, previews record counts, writes an atomic recovery copy, and offers one undo; invalid data never replaces the current valid database.

## Android release build

`package.json` is the single `versionName` source. Gradle derives `versionCode` as `major * 1,000,000 + minor * 1,000 + patch`; set `MOBILE_VERSION_CODE` only when Play requires a higher monotonic code without changing the public version.

Keep the real upload keystore and passwords outside the repository. From `core/packages/mobile/android/`, set all four variables together and require signing:

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

Install Android Studio 2025.2.1 or newer and an Android SDK platform. The Capacitor 8 project uses Android API 26 as its minimum runtime and currently targets API 36. External website/privacy links use the official Capacitor Browser plugin; the App does not request camera, microphone, location, or Bluetooth permissions until those features are implemented and tested.
