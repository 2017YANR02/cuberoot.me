#!/bin/zsh
cd "${0:A:h}" || exit 1
url='http://127.0.0.1:48720/'
if ! curl -fsS "${url}review.js" | grep -Fq 'function makeAss()'; then
  /usr/bin/python3 review_server.py &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null' EXIT
  for i in {1..50}; do
    curl -fsS "${url}review.js" 2>/dev/null | grep -Fq 'function makeAss()' && break
    kill -0 "$server_pid" 2>/dev/null || exit 1
    sleep .1
  done
fi
echo "在浏览器打开 $url"
open "$url"
if [[ -n "$server_pid" ]]; then wait "$server_pid"; fi
