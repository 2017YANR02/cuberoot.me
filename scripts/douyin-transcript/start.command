#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js LTS（包含 npm）：https://nodejs.org/en/download/'
  read -r -p '安装后重新打开此文件，按回车关闭……'
  exit 1
fi
node start.mjs "$@"
