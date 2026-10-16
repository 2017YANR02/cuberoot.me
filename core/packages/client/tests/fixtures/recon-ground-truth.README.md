# Reconstruction ground truth

The administrator manages cases at `/recon/ground-truth`.

- Only manually confirmed, complete 3×3 solves enter the public export.
- `recon-ground-truth.json` is the deterministic API snapshot used by CI; do not edit it directly.
- Run `pnpm --filter @cuberoot/client test:recon-ground-truth` from `core/` to refresh the snapshot and test every confirmed case.
- Final truth contains only cube moves and semantic `// stage` labels. Timing, ellipses, action parentheses and arrows are removed.

## Real timer regressions and final rendering

The same command runs `recon-ground-truth-display.test.ts` only for explicitly
user-approved records in `recon-workbook/`. All 12 existing smart-cube samples
were moved to **pending confirmation** at the user's request on 2026-10-15.
Their recordings, saved answers and historical runs are preserved. These are
the user's reported timer shares, not synthetic recordings:

| Share | Reported regression |
| --- | --- |
| pQp3frgq9f8 | F2L wide turns, rotations, cross orientation |
| ialkciVVKAU | Shared recon diagrams, labels and indentation |
| QmqeMxJEBzA | Cross stays down at each F2L boundary, including slices |
| 7tpMkIMmGcQ | No F2L z; gyro/wide-turn notation order must remain equivalent |
| howVgKOze0g | No unnecessary final x rotation |
| e7zlMhlhjPg | COLL and other last-layer labels link to the exact library case |
| 6wrK7I3TuMk | R U' R' y U' L U' L': y must not move ahead of R' |
| jcc_J24wchw | Cross stays down even without resetting orientation |
| E1pU5e-WEho | Reframe repeated front/up triggers as side/up triggers |
| aesvQSa2hcQ | No trailing x z y x' after the solve |
| FL_vn97ZyzM | Extended-cross pair colors use chips, not (RB) text |
| oPAYPI4Qe-I | Rotation cascades, OLL(CP)-412 and the M-slice PLL-Z formula |

Some links refer to the same recording but preserve separate reported issues.
Fixtures retain only scramble, timed moves, duration, cube model and gyro data;
user/device names and unrelated session metadata are not included.
`libraries.json` freezes the public algorithm sets used on 2026-10-15, so a later
library edit cannot silently change the expected answer or make offline CI flaky.

The test executes the real gyro/reconstruction pipeline, library correction,
F2L display normalization, waste brackets, diagram selection, color chips and
`StepMoveList` DOM. It compares exact displayed rows and replays the **displayed**
moves to check cross-down boundaries and a solved final cube. Original recording
and reconstruction objects must remain unchanged. Only the VisualCube drawing
surface is stubbed; diagram view/state selection is real. These are DOM/semantic
checks, not browser screenshot or pixel-layout checks. The same gate includes
the existing shared `/recon` presentation, formula and rotation tests.

`displayRows` are saved candidate answers until the user confirms them. Never regenerate them just
to make a failing test green. Explain an intentional notation change, verify
equivalence and the reported requirement, then review the specific expected
rows in the diff. This local workbook is not uploaded to the administrator's
confirmed-candidate list by the check command.

## Explicit enrollment (smart cube samples)

New recordings default to pending; a passing test never enrolls a recording.
Only the user explicitly saying **“收录到回归测试”** authorizes enrollment.
After that instruction, review that specific recording and expected display, then
set its fixture approval to `status: approved`, `confirmedBy: user`,
`instruction: 收录到回归测试`, an ISO `confirmedAt`, and `contentHash`
from the existing `fixtureContentHash` helper in `recon-test-history.server.ts`.
The hash binds both the original recording and its saved expected display.
Changing either invalidates approval until the user reconfirms. Never infer
approval from past passes or write approval merely to turn the gate green.

Pending samples are skipped in final-display and case-specific rotation tests.
General program checks and the separate confirmed competition suite continue.
The page lists current admission independently of selected historical results;
zero active smart-cube samples is explicitly shown, never presented as proof
that all reconstructions are correct. Online admission reflects the latest
synchronized run; local admission reads the current fixtures directly.

## Commit gate

Normal commits need no manual test command. `pnpm install` in `core/` runs the
workspace `prepare` lifecycle to enable the existing `.githooks`. On a guarded
commit, Git automatically runs the entire suite if the current fingerprint has
no passing credential. Identical verified content is reused; any relevant edit
invalidates it. Failure blocks the commit and leaves the error in its output.

The automatic commit check uses the committed/local fixture snapshot offline;
it never fetches new baselines, rewrites fixtures, stages files or creates a
commit itself. To explicitly import newly confirmed manager cases and check
them, the existing command remains available from `core/`:

```sh
pnpm --filter @cuberoot/client test:recon-ground-truth
```

Both paths use the same runner and write the ignored
`.tmp/recon-ground-truth-pass.json` credential only after success.
Failures or input changes during the run produce no credential. Algorithm,
rendering, frozen library, fixture or test edits invalidate the old credential.
CI also discovers these tests through the existing client Vitest suite.

For an older checkout that already has dependencies, `pnpm run prepare` from
`core/` installs the hook without reinstalling anything. Installation skips CI
and source archives; an existing custom hooksPath is preserved and reported as
an error so it can be integrated explicitly. On Unix it also ensures the hook
is executable. The equivalent Git configuration, from the repository root, is:

```sh
git config --local core.hooksPath .githooks
```

The gate checks equality of guarded staged/working-tree files before testing
and again before allowing a commit. It does not auto-stage unrelated work.
Codex only preflights this consistency and hook installation; the actual test
run belongs to Git, outside the tool-hook timeout and independent of AI use.
The gate test exercises installation, automatic runs, cache reuse, test failure,
input changes during verification and preserved custom hooks in a temporary
repository. Hooks can be explicitly bypassed, so CI independently runs the real
tests; changes to the hooks themselves also trigger that existing CI job.

## Viewing retained runs

Open `/zh/recon/ground-truth` (administrator sign-in required). Its default
“智能魔方回归测试” view shows the twelve real recordings, run history, each
case's pass/fail/not-run state, captured expected/actual output and a direct
link to the corresponding timer share. “人工复盘样例” retains the original
competition-candidate manager. Results pre-dating this feature are not invented.

Before testing, the existing gate builds the shared package so Node consumers
verify the current source rather than stale dist exports. Build failure is saved
as a failed run and blocks the commit.

The existing gate stores each run atomically under the ignored
`.tmp/recon-ground-truth-runs/` directory, including failures and startup errors.
The current fingerprint warning prevents an older pass from looking current.
A missing or incomplete report fails the gate; an exited unfinished process is
shown as interrupted. A cached Git credential does not create a fictitious run.

Completed runs synchronize to the administrator-only `/v1/recon-ground-truth/runs`
API and the `recon_test_runs` table. Run UUIDs are immutable/idempotent. Local
uploads use `ADMIN_API_KEY` from the environment or ignored, private
`core/.env.recon-tests.local`; failed uploads keep their local queue and retry
on the next check. The local administrator page also retries the entire backlog
using its existing session. No credential or raw recording is embedded in reports.
The online page reads centralized history; the local page reads local history
and reports pending synchronization explicitly. Backend migration and deployment
must be released before online history/synchronization becomes available.

Client CI shard 1 invokes the same gate, retains the report directory as a
90-day artifact even on failure, and trusted main-branch runs upload through
existing deployment SSH access (API key stays on the server). Pull-request runs
retain artifacts without receiving deployment credentials. Upload failure is
visible in CI; artifact retention allows retry, without changing test results.
The shared database retains synchronized history without that artifact expiry.
