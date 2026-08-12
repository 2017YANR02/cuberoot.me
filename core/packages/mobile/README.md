# CubeRoot Mobile

React + Vite + Capacitor 8 app shell. Android is the first native target; iOS can be added from macOS later without duplicating the React UI.

## Commands

Run these from `core/`:

```powershell
pnpm --filter @cuberoot/mobile dev
pnpm --filter @cuberoot/mobile typecheck
pnpm --filter @cuberoot/mobile build
pnpm --filter @cuberoot/mobile cap:sync
pnpm --filter @cuberoot/mobile android:open
```

`cap:sync` builds the web app and copies it into the native Android project. Run it after changing React code and before making a native build.

## Permanent identifiers

- App name: `CubeRoot`
- Release Android application ID: `me.cuberoot.app`
- Debug Android application ID: `me.cuberoot.app.debug`
- Web output: `dist/`

The debug suffix lets development builds coexist with the signed release app. Do not change the release application ID after the first Play Store release.

## Windows Android prerequisites

Install Android Studio 2025.2.1 or newer and an Android SDK platform. Capacitor 8 supports Android API 24 and newer; use the latest stable SDK for compiling and keep API 24 as the minimum runtime target.
