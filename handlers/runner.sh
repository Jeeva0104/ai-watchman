#!/bin/bash
# AI Watchman hook runner - triggers CLI to send events

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
input=$(cat)
echo "$input" | node "$SCRIPT_DIR/cli.mjs" ingest > /dev/null 2>&1 &
exit 0