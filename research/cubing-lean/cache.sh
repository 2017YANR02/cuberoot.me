#!/usr/bin/env bash
# Fetch just the Mathlib closures imported by this package.
set -euo pipefail
export MATHLIB_NO_CACHE_ON_UPDATE=1
cd "$(dirname "$0")"
find . -name .lake -prune -o -name '*.lean' -exec \
  sed -nE 's/^[[:space:]]*((public|meta)[[:space:]]+)*import[[:space:]]+(Mathlib([.][[:alnum:]_]+)*)([[:space:]].*)?$/\3/p' {} + |
  sort -u | xargs lake exe cache get
