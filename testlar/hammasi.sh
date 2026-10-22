#!/bin/sh
# Hamma sinovlarni ishga tushirish: sh testlar/hammasi.sh
set -e
cd "$(dirname "$0")/.."
for t in hifz zettel anki kutubxona transkript; do node testlar/$t.test.js; done
# Hifz sanalari har xil vaqt mintaqalarida (yozgi vaqtga o'tish kunlari bilan)
for tz in Europe/Berlin America/New_York Asia/Tashkent Pacific/Auckland; do TZ=$tz node testlar/hifz.test.js > /dev/null; done
echo "Vaqt mintaqalari: o'tdi ✓"
npx http-server -p 8123 -s -c-1 . > /dev/null 2>&1 &
SERVER=$!
sleep 2
NODE_PATH=$(npm root -g) node testlar/brauzer.test.js || { kill $SERVER 2>/dev/null; exit 1; }
kill $SERVER 2>/dev/null || true
