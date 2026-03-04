#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../crates/irontide-core"
wasm-pack build --target web --release
