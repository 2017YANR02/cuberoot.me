# Security review — 2026-10-27

Scope: the GitHub snapshot of 240 open Dependabot alerts, 18 JavaScript/TypeScript code-scanning alerts and one secret-scanning alert. Review started at `66c16ce5a9`; source/dependency changes are in `aba6c8195e9ef929f4ceb85a53f039f3c66274c9`.

The user requested local work without pushing. This task and its three agents performed no commit, push or remote alert dismissal. During the review a concurrent operation committed the shared working tree; a read-only `git ls-remote origin refs/heads/main` confirmed `aba6c8195e` was already on remote main. This document is a local follow-up. No deployment result or GitHub rescan closure is claimed here.

## Dependencies

Each alert's `vulnerable_version_range` was compared with all matching versions in its current manifest/lock. All **237 active dependency findings** are outside their affected ranges or their dependency has been removed. Three findings remain in the retired archive, as detailed below.

| Manifest / lock | Snapshot findings | Local disposition |
| --- | ---: | --- |
| `core/apps/api/package.json` | 4 | MCP SDK 1.32.0 |
| `core/apps/desktop/package.json` | 5 | Vite 8.1.6 |
| `core/apps/harmony/package.json` | 5 | Vite 8.1.6 |
| `core/apps/mobile/package.json` | 5 | Vite 8.1.6 |
| `core/packages/client/package.json` | 3 | Next 16.4.1 |
| `core/pnpm-lock.yaml` | 44 | Affected versions upgraded or removed |
| `research/reconer/pnpm-lock.yaml` | 7 | Vite 7.3.7, Vitest/mocker 4.1.12 |
| `research/reconer/hands/uv.lock` | 42 | Pillow 13.0.0, certifi 2026.10.23 |
| `research/reconer/vision/pyproject.toml` | 61 | torch 2.13.0, torchvision 0.28.0, Pillow 13.0.0 |
| `research/reconer/vision/uv.lock` | 61 | Same compatible Python dependency set |
| `core/packages/platform/package.json` | 3 | Retired archive; unchanged, proposed `not_used` |

Other core updates include DOMPurify 3.4.17, sanitize-html 2.18.1, a Zod 4.6.6 minimum (locked to 4.6.7), body-parser 2.4.0, fast-uri 3.1.9, happy-dom 21.0.4, ip-address 10.7.4, qs 6.16.1 and undici 7.30.1 / 8.12.2. The two undici majors remain separate. Updating sanitize-html removes the only deepmerge dependency, addressing #565 without pretending that deepmerge has an upstream patch.

Workspace overrides cover affected indirect versions, including indirect Zod copies. The continuous-corners peer resolves to the existing vendored tarball with its existing patch, avoiding a registry lookup for that private package. Research now explicitly uses pnpm 12.6.0 and keeps its Vite 7 override in the workspace configuration. These changes prevent reinstalling the listed affected versions through the present dependency ranges; they do not guarantee immunity from future advisories.

### Retained exceptions

- Dependabot **#395, #396, #397** concern the Next manifest in `core/packages/platform`. Its `AGENTS.md` says the directory is retired, excluded from the workspace, and must not be rewritten by AI. It is not built or deployed. The vulnerable archive manifest remains intact; `not_used` is the proposed remote disposition, not an applied dismissal.
- A supplementary core npm audit reports the previously reviewed **uuid buffer-bounds advisory (#115)** through Capacitor CLI → xcode 3.0.1 → uuid. Current `xcode/lib/pbxProject.js` imports uuid at line 22 and only calls `uuid.v4()` with no arguments at line 90. The affected v3/v5/v6 caller-supplied buffer operations are not used. The existing exception in `security-dependency-review-2026-10-07.md` therefore remains applicable. The package is not claimed to be patched. The supplementary audit has one moderate finding and zero high/critical findings.

## Code scanning

Fifteen findings have corresponding source changes; three were reviewed as false positives. No rule/path exclusions or remote dismissals were added. A scan of the changed source is still needed to establish GitHub's resulting alert state.

| Alerts | Source / disposition |
| --- | --- |
| #122, #121 | Stats/tools upstream logging uses a constant format argument and passes the URL separately. |
| #120, #108, #104, #103 | Training routes, Douyin routes and algorithm slugs use a shared linear trailing-character walk instead of an unanchored trailing-run regex. Existing leading-minus and legacy-slug behavior is preserved. |
| #118, #115 | Exported Pyraminx reference and Ivy move functions require bounded integer indices before nested array writes. |
| #117 | The WCA content assertion compares an extracted link destination exactly, instead of accepting a URL substring. |
| #116, #114 | WCA content and Mini Program template checks replace removed comments with a space to avoid joining surrounding delimiter fragments. |
| #110, #109 | Prime-mark typography uses replaceAll instead of replacing only the first apostrophe. This is display formatting, not an HTML sanitizer. |
| #107, #106 | The shared checkout resolver rebuilds destinations from literal Alipay/WeChat cashier endpoints plus the parsed search string. Existing protocol/host/path/credential/port restrictions remain; signed query encoding is preserved and fragments are omitted. Both validation and navigation use the same resolver. |
| #113, #112, #111 | False positives: private `PyraminxState.swap3` has 16 call sites, all passing fixed numeric face indices 0–3 and sticker indices 0–8. No user-controlled property name reaches these writes. The algorithm was left unchanged. |

## Secret scanning

**#6**, `tencent_wechat_api_app_id`, exactly matches the publicly documented WeChat contract-signing Mini Program identifier. The [official WeChat Pay integration documentation](https://pay.wechatpay.cn/doc/v3/partner/4017177420) instructs merchants to add that fixed identifier to their Mini Program configuration. It is an application identifier, not an AppSecret or signing credential. Only a boolean equality result was logged during verification; no secret value is reproduced here.

Proposed disposition: `false_positive`. No credential rotation, configuration deletion or remote dismissal was performed.

## Verification boundary

- Core: pnpm 12.6.0 lock update and `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline` completed.
- Research: pnpm 12.6.0 lock-only resolution completed; uv locks updated without installing model environments.
- Required generated outputs refreshed successfully with `pnpm --filter @cuberoot/shared build` and `pnpm --filter @cuberoot/miniprogram build` from `core/`.
- Alert-range comparison covered all 240 dependency findings: 237 active findings no longer match, three retired-manifest findings remain.
- No extra test suite, local Next build, research typecheck, model inference, training or benchmark was run. Builds do not establish end-user acceptance or production deployment success.
- The 3 archive findings, 3 code false positives and 1 public-AppID false positive still require deliberate remote disposition if the goal is an empty GitHub badge. This task did not modify remote alert states.

## Authorized push follow-up

The owner requested that all contributors' current changes be committed and pushed. The first Web build after the Next 16.4.1 update hit the upstream FFmpeg dynamic worker URL resolution incompatibility (Deploy Next 40632340116). A pnpm patch for @ffmpeg/ffmpeg 0.12.15 passes the explicitly supplied absolute classWorkerURL directly to Worker; the default statically bundled worker branch is unchanged. The existing POC already supplies an absolute same-origin worker URL. No downgrade or disabled build check was used. Upstream issue: https://github.com/ffmpegwasm/ffmpeg.wasm/issues/793. Production rebuild and receipt acceptance are separate evidence.
