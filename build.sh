#!/usr/bin/env bash
# 构建 @cmx/ontology-graph：tsc 出类型 + esbuild 打单文件 ESM。
# 工具链由 package.json devDependencies 声明（typescript / esbuild / vitest），
# npm install 后走本仓 node_modules/.bin，不依赖任何兄弟仓副本。
set -euo pipefail
cd "$(dirname "$0")"

TSC="./node_modules/.bin/tsc"
ESBUILD="./node_modules/.bin/esbuild"

[ -x "$TSC" ] && [ -x "$ESBUILD" ] || { echo "✗ 缺 node_modules/.bin 工具，请先 npm install"; exit 1; }

echo "== tsc 类型检查 + 声明 =="
"$TSC" -p tsconfig.build.json

echo "== esbuild 打包单文件 ESM =="
"$ESBUILD" src/index.ts --bundle --format=esm \
  --outfile=dist/cmx-ontology-graph.esm.js --platform=browser

echo "✅ 构建完成：dist/cmx-ontology-graph.esm.js ($(wc -c < dist/cmx-ontology-graph.esm.js) 字节)"
