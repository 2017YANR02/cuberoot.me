#!/usr/bin/env bash
# Invoked only by Deploy CubeOpt Native after the API adapter is deployed.
set -Eeuo pipefail
upload=${1:?upload directory required}
revision=${2:?source revision required}
release=${3:?release id required}
case "$revision" in ''|*[!0-9a-f]*) echo 'invalid source revision' >&2; exit 1;; esac
test "${#revision}" = 40
case "$release" in ''|*[!0-9a-f-]*) echo 'invalid release id' >&2; exit 1;; esac
root=/root/core-api
test "$upload" = "$root/artifacts/cubeopt/native-uploads/$release"
cd "$root"
exec 9>"$root/.cubeopt-native-deploy.lock"
flock -n 9 || { echo 'another native deployment is active' >&2; exit 1; }
store=$(node --env-file=.env -p 'process.env.CUBEOPT_ARTIFACT_DIR || ""')
test -n "$store"
test -f "$store/current.json"
test -f dist/cubeopt/prepare.mjs
test -f dist/cubeopt/promote.mjs
test -f dist/cubeopt/smoke.mjs
enabled=$(node --env-file=.env -p 'process.env.CUBEOPT_SOLVE_ENABLED === "1" ? "1" : "0"')
warm=$(node --env-file=.env -p 'process.env.CUBEOPT_WARM_ON_BOOT === "1" ? "1" : "0"')
threads=$(node --env-file=.env -p 'process.env.CUBEOPT_THREADS || "2"')
case "$threads" in 1|2|3|4) ;; *) echo 'native Opt8 supports 1 to 4 threads' >&2; exit 1;; esac
bundle="cubeopt-opt8-native-$release"
previous=$(node --input-type=module - "$store/current.json" <<'NODE'
import { readFileSync } from 'node:fs';
const pointer = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (pointer.schema !== 'cuberoot.cubeopt-current/v1' || !/^cubeopt-opt8-[A-Za-z0-9._-]+$/.test(pointer.bundle)) {
  throw new Error('a current Opt8 bundle is required');
}
console.log(pointer.bundle);
NODE
)
old_bundle="$store/bundles/$previous"
test -f "$old_bundle/cube48opt8.small.bin"
test -f "$old_bundle/h48prun31h8.dat"
cp "$store/current.json" "$upload/previous-current.json"

# Verify the uploaded bytes and their source commit before invoking any artifact
# tooling. The deployed API owns all manifest and protocol verification.
node --input-type=module - "$upload" "$revision" <<'NODE'
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [dir, revision] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(`${dir}/build.json`, 'utf8'));
const binary = readFileSync(`${dir}/cube48opt-native`);
if (meta.schema !== 'cuberoot.cubeopt-native-build/v1' || meta.revision !== revision
  || meta.target !== 'x86_64-unknown-linux-musl' || meta.rustflags !== '-C target-cpu=x86-64'
  || meta.features !== 'opt8-native-search,opt8-native-quarter,opt9-native-fixed-contexts,opt8-native-prefetch'
  || meta.binary.bytes !== binary.length
  || meta.binary.sha256 !== createHash('sha256').update(binary).digest('hex')) {
  throw new Error('uploaded native build does not match release metadata');
}
NODE
chmod 755 "$upload/cube48opt-native"
node --env-file=.env dist/cubeopt/prepare.mjs \
  --store "$store" --bundle "$bundle" --engine rust-native \
  --binary "$upload/cube48opt-native" --snapshot "$old_bundle/cube48opt8.small.bin" \
  --table "$old_bundle/h48prun31h8.dat" --link-table \
  --source-url https://github.com/2017YANR02/cuberoot.me \
  --source-revision "$revision" \
  --source-build-command 'node solver/experiments/cube48opt-rust/native-service/build.mjs'
# Fail before changing admission if an entry-point/build regression returned
# success without publishing the immutable candidate.
test -f "$store/bundles/$bundle/manifest.json"

admission_changed=0
pointer_changed=0
complete=0

reload_disabled() {
  CUBEOPT_SOLVE_ENABLED=0 CUBEOPT_WARM_ON_BOOT=0 pm2 reload core-api --update-env
}

reload_configured() {
  CUBEOPT_SOLVE_ENABLED="$enabled" CUBEOPT_WARM_ON_BOOT="$warm" pm2 reload core-api --update-env
}

wait_quiet() {
  # Match exact executable/daemon arguments, never kill an unrelated process.
  # PM2 shutdown and kernel memory reclamation finish asynchronously. Wait for
  # both before another large allocation; rollback needs only a stopped worker.
  local require_memory=${1:-0}
  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if node --input-type=module - "$require_memory" <<'NODE'
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
let found = false;
for (const pid of readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
  try {
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    if (args.some(arg => arg.endsWith('/cubeopt/solve-daemon.mjs'))
      || (basename(args[0] || '') === 'cube48opt-native' && args[1] === 'solve')) {
      found = true;
    }
  } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error; }
}
if (found) process.exit(1);
// A completed PM2 command alone does not prove all requests reached the new,
// disabled manager. Check the actual HTTP admission state before promotion.
try {
  const response = await fetch('http://127.0.0.1:3001/v1/scramble/optimal-solve/ready', { signal: AbortSignal.timeout(1_000) });
  const state = await response.json();
  if (!response.ok || state.enabled !== false || state.ready !== false) process.exit(1);
} catch { process.exit(1); }
const memory = readFileSync('/proc/meminfo', 'utf8');
const available = Number(memory.match(/^MemAvailable:\s+(\d+) kB$/m)?.[1]) * 1024;
const required = 7_782_727_680 + 512 * 1024 ** 2 + 2 * 1024 ** 3;
if (process.argv[2] === '1' && (!Number.isSafeInteger(available) || available < required)) process.exit(1);
console.log(JSON.stringify({ quiet: true, admissionDisabled: true, memAvailable: available, required }));
NODE
    then return 0; fi
    sleep 1
  done
  echo "CubeOpt shutdown/admission/memory preflight did not settle within 60 seconds (require_memory=$require_memory)" >&2
  return 1
}

health() {
  for _attempt in $(seq 1 15); do
    if curl -fsS http://127.0.0.1:3001/v1/health | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const x=JSON.parse(s);process.exit(x.status==="ok"?0:1)})'; then return 0; fi
    sleep 2
  done
  return 1
}

restore_pointer() {
  node --input-type=module - "$store" "$upload/previous-current.json" <<'NODE'
import { open, readFile, rename, unlink } from 'node:fs/promises';
const [store, previous] = process.argv.slice(2);
const temporary = `${store}/.rollback-${process.pid}.json`;
try {
  const handle = await open(temporary, 'wx');
  try { await handle.writeFile(await readFile(previous)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, `${store}/current.json`);
  const directory = await open(store, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
} finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
NODE
}

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$complete" = 1 ]; then exit "$status"; fi
  set +e
  if [ "$admission_changed" = 1 ]; then
    echo 'Native deployment failed; restoring previous CubeOpt pointer and admission' >&2
    reload_disabled
    quiet=0
    if wait_quiet; then quiet=1; fi
    restored=1
    if [ "$pointer_changed" = 1 ] && ! restore_pointer; then
      restored=0
      echo 'ERROR: failed to restore previous current.json' >&2
    fi
    if [ "$quiet" = 1 ] && [ "$restored" = 1 ]; then
      reload_configured || echo 'ERROR: failed to restore CubeOpt admission' >&2
    else
      echo 'ERROR: admission remains disabled because worker shutdown or pointer restoration failed' >&2
    fi
    health || echo 'ERROR: API did not recover its health check' >&2
    pm2 save
  fi
  test "$status" != 0 || status=1
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# A shared on-disk table still needs a full private resident copy in each
# process. Disable admission before stopping the old worker and running smoke.
admission_changed=1
reload_disabled
health
wait_quiet 1
pointer_changed=1
node --env-file=.env dist/cubeopt/promote.mjs --store "$store" --bundle "$bundle"
wait_quiet 1
node --env-file=.env dist/cubeopt/smoke.mjs --store "$store" --threads "$threads" \
  --boot-timeout-ms 300000 --solve-timeout-ms 180000
wait_quiet 1
reload_configured
health
if [ "$enabled" = 1 ] && [ "$warm" = 1 ]; then
  ready=0
  for _attempt in $(seq 1 180); do
    if curl -fsS http://127.0.0.1:3001/v1/scramble/optimal-solve/ready | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.exit(JSON.parse(s).ready===true?0:1))'; then ready=1; break; fi
    sleep 2
  done
  test "$ready" = 1 || { echo 'native daemon did not become ready' >&2; exit 1; }
fi
pm2 save
node --input-type=module - "$upload" "$bundle" "$previous" <<'NODE'
import { writeFileSync } from 'node:fs';
const [upload, bundle, previous] = process.argv.slice(2);
const receipt = { deployedAt: new Date().toISOString(), bundle, previous, engine: 'rust-native', smoke: 'passed' };
writeFileSync(`${upload}/deployment.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
NODE
complete=1
