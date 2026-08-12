# CubeRoot Mobile

React + Vite + Capacitor 8 app shell. Android is the first native target; iOS can be added from macOS later without duplicating the React UI.

The bundled React screen is a startup and offline fallback. On a native device it opens the production site with Capacitor's InAppBrowser WebView, so normal website releases appear in the app without rebuilding the APK or future IPA. Native-only capabilities stay in this package.

## Maintenance rule

Do not recreate website pages, components, or business logic in this package. Reuse the live site by default. Mobile-owned code is limited to startup, offline fallback, and capabilities that require a native bridge; shared domain logic must be extracted to a shared package rather than copied.

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

Install Android Studio 2025.2.1 or newer and an Android SDK platform. The InAppBrowser plugin requires Android API 26 or newer, so Android 8.0 is the minimum runtime target. Compile and target with the latest stable SDK.
