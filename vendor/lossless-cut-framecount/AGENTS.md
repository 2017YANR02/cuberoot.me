# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Commands

Package manager is **yarn 4** (see `packageManager` in `package.json`; do not use npm/pnpm).

- `yarn dev` — start Electron app in watch mode (`electron-vite dev -w`).
- `yarn start` — preview the last build (`electron-vite preview`).
- `yarn build` — generate icons + `electron-vite build` into `out/`.
- `yarn tsc` — typecheck all four composite projects via `tsc --build`.
- `yarn lint` — ESLint over `js/ts/jsx/tsx/mjs/mts`.
- `yarn test` — Vitest (watch). `yarn test run` for one-shot. Single file: `yarn test run path/to/file.test.ts`.
- `yarn check` — full CI gate: tsc + lint + tests + build + license check + i18n scan + dedupe check + docs.
- `yarn scan-i18n` — extract English strings to `locales/` via `i18next-cli`.
- `yarn pack-win` / `pack-mac` / `pack-linux` — produce installers via `electron-builder`.

### FFmpeg for dev
The dev app uses `ffmpeg`/`ffprobe` from `PATH`, *or* from a per-arch folder if you've fetched it: `yarn download-ffmpeg-<platform>-<arch>` (e.g. `yarn download-ffmpeg-win32-x64`). Production builds bundle the binaries from those folders into `process.resourcesPath`.

## Architecture

Electron app built with `electron-vite` + React 18. Four TS composite projects (`tsconfig.{web,main,node,common}.json`) referenced from the root `tsconfig.json`; each maps to one source area:

- `src/main/` — Electron main process. Entry `index.ts`. Owns BrowserWindow, native menu (`menu.ts`), config store (`configStore.ts`, electron-store), FFmpeg child processes (`ffmpeg.ts` — spawns via `execa`, tracks running processes in a Set for cancel), HTTP API (`httpServer.ts`, Express), update check, i18n init.
- `src/preload/index.ts` — exposes a `Proxy` on `window.electron` that forwards every method call to main via `ipcRenderer.invoke('__electron_rpc__', method, args)`. The RPC surface is the exported `RemoteRpcApi` type from `src/main/index.ts`.
- `src/renderer/src/` — React UI. Entry `index.tsx` → `App.tsx`. State lives in hooks (`hooks/useSegments`, `useFfmpegOperations`, `useUserSettingsRoot`, `useKeyboard`, `useWaveform`, `useKeyframes`, `useTimelineScroll`, …) wired together inside `App.tsx`; shared values flow through three contexts in `contexts.ts` (`UserSettingsContext`, `AppContext`, `SegColorsContext`).
- `src/common/` — types/utils shared between main and renderer (`types.ts`, `ffprobe.ts`, `userTypes.ts`, `constants.ts`).

### Main ↔ renderer bridge (two channels, both still in use)
1. **Modern RPC**: `window.electron.<method>(...)` → preload `Proxy` → `__electron_rpc__` IPC → handler registered in `src/main/index.ts`. Prefer this for new APIs.
2. **Legacy `@electron/remote`**: renderer does `window.require('@electron/remote').require('./index.js')` to pull *synchronous* refs to main exports (heavily used for the FFmpeg surface — see `src/renderer/src/ffmpeg.ts:20`). Being phased out; don't add new call sites if the RPC bridge will do.

`src/renderer/src/mainApi.ts` is the canonical import path for the RPC proxy in renderer code.

### FFmpeg pipeline
All FFmpeg/FFprobe invocations live in `src/main/ffmpeg.ts` (binary path resolution, arg escaping for Windows, progress parsing, abort via `AbortController`). Renderer side: `src/renderer/src/ffmpeg.ts` re-exports those via `@electron/remote`. High-level cut/export/concat/smartcut logic is in `src/renderer/src/hooks/useFfmpegOperations.ts` and `smartcut.ts`. EDL import/export (CSV, CUE, YouTube, DaVinci/FCP XML, MP4/MKV chapters, …) lives in `src/renderer/src/edlFormats.ts` + `edlStore.ts`.

### Expression language
The "select segments by expression" / "mutate segments by expression" feature runs user JS in a Vite-bundled web worker (`src/renderer/src/worker/evalWorker.ts`, called via `worker/eval.ts`). Treat that worker as the sandbox boundary — don't expose privileged APIs into it.

### i18n
`i18next` initialized in both main (`src/main/i18n.ts`) and renderer (`src/renderer/src/i18n.ts`). Strings live in `locales/<lang>/translation.json`; new English keys are extracted by `yarn scan-i18n` (config: `i18next.config.scan.ts`). Translations come from Weblate — never hand-edit non-English files (see `CONTRIBUTING.md`: rebase+merge the Weblate PR, never squash).

### Build/store nuances
- `electron-builder` configuration is inline in `package.json` under `build`. Targets per OS (mac DMG + MAS universal, win 7z + appx for x64/arm64, linux tar.bz2/AppImage/snap). The MAS and APPX artifacts intentionally use `*-DONT-USE-THIS-FILE.*` names so end users don't grab them from GitHub releases.
- `isMasBuild` (Mac App Store) imposes sandbox restrictions — file access requires the user-granted security-scoped bookmark; check this flag before touching arbitrary paths in renderer flows.

## Conventions specific to this repo

- **Module style**: `"type": "module"` in package.json. Main and common use Node ESM with `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` + `verbatimModuleSyntax` — meaning intra-package relative imports MUST include the `.ts`/`.js` extension explicitly (e.g. `import './logger.js'`). Renderer code does not (Vite resolves).
- **Strictest TS config** (`@tsconfig/strictest`) is in effect — expect `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.
- **Components**: PascalCase `.tsx` (often co-located with `.module.css`). Reusable primitives in `components/`, full-screen views directly under `src/renderer/src/`.
- **Hooks**: in `src/renderer/src/hooks/`, file named `use<Name>.ts(x)`, default export. Most app state is owned by one of these hooks and threaded into `App.tsx`.
- **Tests**: Vitest, files `*.test.ts` co-located with source. Snapshots in `src/renderer/src/__snapshots__/`.
- **Logging**: main uses Winston via `src/main/logger.ts` (`logger.info/error/...`). Renderer uses `console.*` (allowed by ESLint override).
- **Errors**: throw `UserFacingError` (`src/renderer/errors.ts`) for messages that should be shown verbatim to the user; everything else gets a generic toast.
- **Adding an IPC method**: add the handler in `src/main/index.ts` and include it in the exported `RemoteRpcApi` type — that's all renderer needs (the `Proxy` picks it up automatically and types flow through).

## Frame-count fork in CubeRoot

Maintain this source under `vendor/lossless-cut-framecount/` in the CubeRoot checkout. The original fork is archived at commit `c8e504c64ab570f1d4e9931311ed45911fbf4604`.

### Frame-count feature
- Core logic: `src/renderer/src/hooks/useFrameCount.ts` (+ `.test.ts`). Solves stored as cut segments tagged `framecount.*` → reuse timeline/.llc/export for free; don't add a separate store.
- UI: `src/renderer/src/components/FrameCountPanel.tsx`, wired in `App.tsx` next to SegmentList.
- Hotkey: `frameCountAdd` (default `KeyM`); `toggleMuted` rebound to `Shift+M`. Defaults live in `src/main/configStore.ts`. **Existing user configs do NOT auto-update** — if user reports "M does nothing", tell them to rebind in Settings → Keyboard shortcuts (don't suggest deleting config.json).
- Filename auto-fill: `parseSolveTimeFromFilename` truncates to centiseconds per WCA 9f (e.g. `0.688` → `0.68`). Don't round.
- User-facing doc: `docs/frame-count.md` (Chinese). Pointer from `FORK-NOTES.md`.

### Release workflow (Windows .exe → GitHub Release)
After any UI/i18n change the user wants shipped:
1. `yarn build`
2. `yarn electron-builder --win dir` — **use `dir`, not `7z`**. The `7z` target needs winCodeSign whose 7z extract fails on non-admin Windows due to macOS symlinks. `dir` produces `dist/win-unpacked/` which is what we ship.
3. Repack: `Compress-Archive -Path dist\win-unpacked\* -DestinationPath dist\LosslessCut-frame-count-win-x64.zip -Force` (~1 min).
4. For an authorized new release, publish a new versioned asset through CubeRoot and update the download target in `core/packages/client/lib/app-downloads.ts`. Keep existing release assets available.
5. Verify locale freshness in shipped artifact before upload: `dist/win-unpacked/resources/locales/zh_Hans/translation.json` should have a newer mtime than the previous zip.

### i18n changes
1. Edit source strings → `node node_modules/i18next-cli/dist/esm/cli.js -c i18next.config.scan.ts extract` (the `yarn scan-i18n` wrapper sometimes exits -1 silently — call the CLI directly).
2. Add the new keys to **both** `locales/zh_Hans/translation.json` and `locales/zh_Hant/translation.json` by hand. Additive-only edits don't conflict with Weblate.
3. Other locales: leave for Weblate.

### Dev environment quirks (this machine)
- Yarn isn't on PATH — run via `node .yarn/releases/yarn-4.11.0.cjs <cmd>` or `corepack yarn <cmd>`.
- FFmpeg in dev: hardcoded to `ffmpeg/win32-x64/lib/ffmpeg.exe` (NOT PATH). If missing, `yarn download-ffmpeg-win32-x64` or copy a static build there.
- Electron binary: if `node_modules/electron/dist/electron.exe` is missing after install (network interrupt), download `electron-v<ver>-win32-x64.zip` from `https://github.com/electron/electron/releases`, extract to `node_modules/electron/dist/`, and write `electron.exe` into `node_modules/electron/path.txt`.

### CI
The nested workflow files preserve the former standalone build configuration. GitHub Actions in CubeRoot reads workflows from the root only.
