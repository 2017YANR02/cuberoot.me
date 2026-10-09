#!/bin/bash
# Read-only WCA extra API smoke check; TypeScript implementation is canonical.
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
core_dir="$(cd "$script_dir/../../.." && pwd)"
cd "$core_dir"
pnpm --filter @cuberoot/stats-build exec tsx src/bin/smoke_test_endpoints.ts "${1:-https://api.cuberoot.me}"
