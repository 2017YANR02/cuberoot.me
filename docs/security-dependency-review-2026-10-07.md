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


## Newly published Next.js advisories — follow-up

A later live Dependabot check found 17 newly reported records after the initial
remediation: #308–313 in the active client manifest, #319–324 in the workspace
lockfile, and #314–318 in the retired Platform manifest. The active records are
six advisories duplicated across manifest and lockfile, not twelve independent
vulnerabilities. GitHub identifies 16.3.8 as the first patched version for all
six; the official npm registry also confirms that version and its unchanged
Node.js requirement of >=20.9.0.

The active client is updated from Next.js 16.3.6 to 16.3.8, including its matching
`@next/env` and platform-specific SWC packages in the workspace lockfile. There
is no `eslint-config-next` or `@next/eslint-plugin-next` dependency in the active
workspace, so this patch does not introduce either package.

| Advisory | Issue | Active records | Retired record |
| --- | --- | --- | --- |
| GHSA-cjq9-62q9-8jv4 | Image Optimization SSRF | #308, #319 | #314 |
| GHSA-mcj8-r9mp-w47p | SSG/ISR cache poisoning, content substitution and denial of service | #309, #320 | #315 |
| GHSA-f87g-xv8r-7p7x | Metadata image-route information disclosure | #310, #321 | #316 |
| GHSA-39w2-rjm5-chcv | Development MCP information disclosure | #311, #322 | #317 |
| GHSA-4jqv-mc3x-m676 | Self-hosted SSG/ISR cache poisoning | #312, #323 | #318 |
| GHSA-3w37-wq28-93x7 | Draft Mode content leaking through pending cache fills | #313, #324 | — |

Records #314–318 are candidates for `not_used`, using the same evidence as the
earlier retired-Platform records: `core/pnpm-workspace.yaml` explicitly excludes
`packages/platform`; `core/packages/platform/AGENTS.md` labels it RETIRED and
prohibits building or deploying it; `.github/workflows/test.yml` excludes its
paths, and `deploy_next.yml` builds the active `@cuberoot/client`. The historical
manifest is preserved unchanged, and no retired application is re-enabled.

Local verification: the installed client reports Next.js 16.3.8, client
`typecheck` passes, and the lockfile diff contains only the Next.js version
replacement and corresponding integrity hashes (no unrelated dependency
resolution drift). No full test suite or local Next build was run for this
patch. Deployment and Dependabot closure require the follow-up commit to be
pushed and GitHub to rescan it.
