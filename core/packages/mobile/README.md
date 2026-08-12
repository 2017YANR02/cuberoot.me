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
pnpm --filter @cuberoot/mobile cap:sync
pnpm --filter @cuberoot/mobile android:open
```

`cap:sync` builds the web app and copies it into the native Android project. Run it after changing React code and before making a native build.

## Persistence

`src/data/timer-repository.ts` is the only mobile timer storage boundary. It writes schema-versioned `TimerStoreData` from `@cuberoot/shared/timer` to IndexedDB and serializes concurrent changes. Invalid data is rejected without overwriting the existing database. JSON export/import uses the same shared decoder.

## Permanent identifiers

- App name: `CubeRoot`
- Release Android application ID: `me.cuberoot.app`
- Debug Android application ID: `me.cuberoot.app.debug`
- Web output: `dist/`

The debug suffix lets development builds coexist with the signed release app. Do not change the release application ID after the first Play Store release.

## Windows Android prerequisites

Install Android Studio 2025.2.1 or newer and an Android SDK platform. The InAppBrowser plugin requires Android API 26 or newer, so Android 8.0 is the minimum runtime target. Compile and target with the latest stable SDK.
