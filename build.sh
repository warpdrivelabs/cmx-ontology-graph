#!/usr/bin/env bash
# 构建 @cmx/ontology-graph：tsc 出类型 + esbuild 打单文件 ESM。
# 工具链复用仓内隔离副本（离线环境无全局 tsc/esbuild），与 @cmx/decision-graph 同法。
set -euo pipefail
cd "$(dirname "$0")"

TSC="./.tsc-tool/node_modules/typescript/bin/tsc"
ESBUILD="../cmx-home-site/node_modules/.bin/esbuild"

echo "== tsc 类型检查 + 声明 =="
node "$TSC" -p tsconfig.build.json

echo "== esbuild 打包单文件 ESM =="
"$ESBUILD" src/index.ts --bundle --format=esm \
  --outfile=dist/cmx-ontology-graph.esm.js --platform=browser

echo "✅ 构建完成：dist/cmx-ontology-graph.esm.js ($(wc -c < dist/cmx-ontology-graph.esm.js) 字节)"
