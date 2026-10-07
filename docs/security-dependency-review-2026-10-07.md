# Dependency security review — 2026-10-07

Scope: the 298 open Dependabot records present when security alerts were enabled.
These are dependency records, not 298 distinct exploitable vulnerabilities.
CodeQL source findings are a separate review and are not dismissed by this work.

## Remediation

Updated the active Web, API, installed-client and job dependencies and refreshed
the workspace lockfile. Next.js is at least 16.3.6, MapLibre at least 6.4.1,
Capacitor 8.5.3, and Vitest at least 4.1.11. SheetJS uses its official 0.20.3
distribution because the npm `xlsx` package no longer receives fixes.
MapLibre's v6 worker is copied from the installed package into a versioned public
directory during dev/build. Research tests also use the fixed Vitest release,
which removes the vulnerable Tinypool dependency.

The exact resolved versions are recorded in the respective lockfiles. Updating
Capacitor source and native projects does not upgrade already-installed apps:
Android/iOS must be rebuilt, distributed, and installed separately.

## Reviewed non-applicable findings

These findings retain their dependencies or historical files. Closing them as
`not_used` is based on the following current build/call paths, not their severity.
Reassess if those paths or supported platforms change.

| Alerts | Evidence |
| --- | --- |
| #61–72, retired Platform Next.js | `core/pnpm-workspace.yaml` excludes `packages/platform`; repository architecture rules mark it as a retired archive that is not built or deployed. The active Web client is upgraded. |
| #10–13, FMC historical child lock | `cargo locate-project --workspace --manifest-path core/apps/fmc-solver/cubelib/Cargo.toml` resolves to `core/apps/fmc-solver/Cargo.toml`. `deploy_fmc.yml` builds from that root workspace. Its actual lock already has crossbeam-channel 0.5.15, time 0.3.47, rand 0.9.4 and serde_with 3.21.0; the flagged child lock is not consumed. |
| #9, desktop glib | `cargo tree --target all -i glib` identifies the GTK/WebKit2GTK Linux chain. Locked offline inverse trees for aarch64-apple-darwin and x86_64-pc-windows-msvc contain no glib. Supported desktop products are macOS and Windows, not Linux. |
| #115, uuid buffer bounds | The only dependency path is Capacitor CLI → xcode → uuid. `xcode/lib/pbxProject.js` calls only `uuid.v4()` without arguments. The advisory concerns v3/v5/v6 with caller-provided output buffers, which this consumer does not use. |
| #287, braces stack exhaustion | The only path is alg-build → fast-glob → micromatch → braces. `core/jobs/alg-build/src/walkDocx.ts` uses the constant `**/*.docx` pattern and constant exclusions. The CLI source argument is resolved as the working directory, never used as a glob expression. No untrusted nested brace pattern reaches this dependency. |
| #295, sprintf-js precision | The paths are API/alg-build → mammoth → argparse → sprintf-js. Both applications call Mammoth's `convertToHtml` library API. Only Mammoth's unused CLI imports argparse; the library does not import argparse or sprintf-js. A runtime module-cache check after loading Mammoth confirmed neither was loaded. |

The last three dependency advisories still appear in a raw local `pnpm audit`;
they are documented exceptions, not patched packages. No global advisory-ignore
configuration was added. Research dependency audit has no remaining findings.
