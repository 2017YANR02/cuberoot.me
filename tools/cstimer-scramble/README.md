# cstimer-scramble (vendored)

Subset of [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) for use as a
scramble source in `/scramble/gen`. Loaded as a classic Web Worker by
`core/packages/client/src/utils/cstimerScramble.ts`.

- `lib/utillib.js` — defines `$`, `execMain`, `ISCSTIMER`, `DEBUG` (worker shim included)
- `lib/mathlib.js` — math primitives + IDA solver + prune table generator
- `scramble/scramble.js` — `scrMgr` factory (UI block is skipped in worker)
- `scramble/*.js` — per-puzzle scramble + register via `scrMgr.reg`
- `scrambler.worker.js` — our thin bridge: importScripts the above, postMessage API

Sync via `scripts/sync_cstimer_scramble.ps1` at repo root.

License: GPLv3 (see `LICENSE`).
