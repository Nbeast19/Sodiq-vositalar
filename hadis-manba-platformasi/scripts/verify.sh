#!/bin/sh
# Barcha sinovlar: demo paketlar -> pytest -> Node (JS = Python) -> Playwright (12 ssenariy x 2 o'lcham).
# Ishga tushirish: sh scripts/verify.sh   (PYTHON=... bilan boshqa interpretator)
set -e
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
$PY scripts/build_demo.py
$PY -m pytest -q
node tests/web/core.node.test.js
NODE_PATH=${NODE_PATH:-$(npm root -g)} node tests/web/e2e.pw.js
echo "Hammasi o'tdi."
