#!/bin/bash
# 烟测 wca_stats_extra 6 个 API endpoint 是否正常返回 JSON.
# 用法: bash scripts/smoke_test_endpoints.sh [BASE]
# BASE 默认 https://api.cuberoot.me
set -euo pipefail

BASE="${1:-https://api.cuberoot.me}"
echo "== Testing $BASE/v1/wca/* =="
echo

check() {
  local name="$1"; shift
  local url="$1"; shift
  printf '%-22s ' "$name"
  if out=$(curl -s -m 10 -w '\n%{http_code}' "$url" 2>&1); then
    code=$(echo "$out" | tail -1)
    body=$(echo "$out" | head -n -1)
    if [ "$code" = "200" ]; then
      n=$(echo "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d.get("rows",[])) if "rows" in d else "ok")' 2>/dev/null || echo "?")
      echo "OK ($code, $n rows)"
    else
      echo "FAIL ($code): $(echo "$body" | head -c 80)"
    fi
  else
    echo "FAIL: $out"
  fi
}

check "grand-slam"      "$BASE/v1/wca/grand-slam"
check "grand-slam(333)" "$BASE/v1/wca/grand-slam?event=333"
check "all-results"     "$BASE/v1/wca/all-results?event=333&type=single"
check "all-results CN"  "$BASE/v1/wca/all-results?event=333&type=single&country=China"
check "year-results"    "$BASE/v1/wca/year-results?year=2025&event=333&type=single"
check "cohort-ranks"    "$BASE/v1/wca/cohort-ranks?cohort=2020&event=333&type=single"
check "success-rate"    "$BASE/v1/wca/success-rate?event=333bf"
check "all-events-done" "$BASE/v1/wca/all-events-done"
check "sum-of-ranks"    "$BASE/v1/wca/sum-of-ranks?type=single"
check "sum-of-ranks 5"  "$BASE/v1/wca/sum-of-ranks?type=single&events=333,222,444,555,666"
echo
echo "== Done =="
