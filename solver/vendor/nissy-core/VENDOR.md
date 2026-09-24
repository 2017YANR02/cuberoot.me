# nissy-core source snapshot

Source: https://github.com/sebastianotronto/nissy-core
Commit: `1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88`
License: GPL-3.0-or-later; see `LICENSE` in this directory.

The source snapshot is used by `solver/native/generate_h48_h10.c` through
`solver/src/bin/table_generator.rs`. It is kept separate from the Rust solver
and from the older cube48opt9 Emscripten module. The generated 28.25 GiB table
is local and ignored by Git.

Local patch: `src/utils/wrapthread.h` treats `__APPLE__` like `__unix__` for
pthread selection. The upstream header checks `pthreads.h` (plural) in its
fallback branch, which macOS does not provide; without this patch the build
silently uses one thread even when compiled with `THREADS=18`.
`src/utils/sleep.h` likewise enables `nanosleep` on macOS. The upstream H48
progress estimate could schedule the next status line hours later when its
one-second velocity sample was slow; the local `gendata_h48.h`, cocsep, eoesep,
and distribution patches expose stage counters to the worker instead.
The CubeRoot worker now emits a nine-stage, in-place terminal status and an
atomic `h48h7.dat.progress.json` or `h48h10.dat.progress.json` status file about every ten seconds. The
vendored generation and distribution loops expose completed work where it is
measurable; stage ETA is deliberately omitted for nonlinear searches and final
disk synchronization. H10 uses the upstream mutex-protected table updates in
anonymous memory; after validation the local worker streams the table to disk.
`solver/native/h48_progress.c` owns status persistence and formatting.
The generator recompiles the worker when these headers or progress sources
change. An already running worker retains its original behavior.

Local H48 short-state progress: `h48map_nextkvpair` advances the cursor to
capacity when it returns the final occupied hash slot. The fixed upstream
snapshot's enumeration and worker loops skip that slot; its expected table
distribution follows the same boundary. Processing the extra slot produced an
H7 distribution mismatch in the 2026-09-24 full validation. Keep the upstream
boundary for byte-compatible generation. The local progress total accounts
for the skipped slot, and the main thread joins workers instead of waiting on
the upstream velocity estimate, so the display reaches completion without a
one-state-short busy wait.
