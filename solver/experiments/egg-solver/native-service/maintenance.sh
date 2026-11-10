#!/usr/bin/env bash
# Preserve production's exact pointer and restore admission after either outcome.
set -Eeuo pipefail
task=${1:?absolute task directory required}
phase=${2:?generate, benchmark, benchmark100 or cli100}
[[ "$task" = /root/egg-h8-* ]]
[[ "$phase" = generate || "$phase" = benchmark || "$phase" = benchmark100 || "$phase" = cli100 ]]
export PATH=/root/.nvm/versions/node/v24.14.0/bin:$PATH
root=/root/core-api
cd "$root"
exec 8>/run/lock/cuberoot-api-releases.lock
flock -n 8
exec 9>"$root/.cubeopt-native-deploy.lock"
flock -n 9
mkdir "$task/$phase-maintenance"
evidence="$task/$phase-maintenance"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({startedAt:new Date().toISOString(),pid:process.pid})+"\n",{flag:"wx"})' "$evidence/started.json"
enabled=$(node --env-file=.env -p 'process.env.CUBEOPT_SOLVE_ENABLED === "1" ? "1" : "0"')
warm=$(node --env-file=.env -p 'process.env.CUBEOPT_WARM_ON_BOOT === "1" ? "1" : "0"')
store=$(node --env-file=.env -p 'process.env.CUBEOPT_ARTIFACT_DIR')
cp "$store/current.json" "$evidence/original-current.json"
changed=0
worker=
quiet() {
  node --input-type=module - <<'JS'
import {readdirSync,readFileSync} from 'node:fs';
for(const p of readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{
 const a=readFileSync(`/proc/${p}/cmdline`,'utf8').split('\0');
 if(a[0]?.endsWith('/cube48opt-native')&&a[1]==='solve')process.exit(1);
 if(a[0]?.endsWith('/cuberoot-egg')&&['serve','generate'].includes(a[1]))process.exit(1);
 if(/^\/root\/egg-h8-[^/]+\/candidate\/solve$/.test(a[0]??''))process.exit(1);
 if(a.slice(0,4).some(x=>x.endsWith('/cubeopt/solve-daemon.mjs')))process.exit(1);
}catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e;}}
const r=await fetch('http://127.0.0.1:3001/v1/scramble/optimal-solve/ready',{signal:AbortSignal.timeout(5000)});
const s=await r.json();if(!r.ok||s.enabled!==false||s.ready!==false)process.exit(1);
JS
}
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  set +e
  if [[ -n "$worker" ]] && kill -0 "$worker" 2>/dev/null; then kill -TERM "$worker"; wait "$worker"; fi
  if [[ "$changed" = 1 ]]; then
    if ! quiet; then echo 'Worker still active; refusing to load another table.' >&2; exit 1; fi
    cmp "$store/current.json" "$evidence/original-current.json" || exit 1
    CUBEOPT_SOLVE_ENABLED="$enabled" CUBEOPT_WARM_ON_BOOT="$warm" pm2 reload core-api --update-env || exit 1
    restored=0
    for attempt in $(seq 1 90); do
      if curl -fsS --max-time 5 http://127.0.0.1:3001/v1/scramble/optimal-solve/ready > "$evidence/restored-state.json"; then
        if node -e 'const x=require(process.argv[1]);process.exit(x.enabled&&x.configured&&x.ready?0:1)' "$evidence/restored-state.json"; then restored=1; break; fi
      fi
      sleep 2
    done
    [[ "$restored" = 1 ]] || exit 1
  fi
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({code:Number(process.argv[2]),finishedAt:new Date().toISOString()})+"\n",{flag:"wx"})' "$evidence/exit.json" "$status"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
changed=1
CUBEOPT_SOLVE_ENABLED=0 CUBEOPT_WARM_ON_BOOT=0 pm2 reload core-api --update-env
settled=0
for attempt in $(seq 1 60); do if quiet; then settled=1; break; fi; sleep 2; done
[[ "$settled" = 1 ]]
if [[ "$phase" = generate ]]; then script=generate-guard.mjs
elif [[ "$phase" = cli100 ]]; then script=cli-benchmark.mjs
else script=benchmark.mjs; fi
CUBEOPT_BENCH_STORE="$store" node "$task/source/egg-solver/native-service/$script" "$task" &
worker=$!
wait "$worker"
worker=
