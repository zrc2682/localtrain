#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "正在启动 localtrain ..."
export PORT=3008
npm run dev
