#!/usr/bin/env bash
# 把构建产物拷进本体平台前端 vendor 目录（供 :8097 独立与门户经 /api/native-pages 取）。
# 对标 @cmx/decision-graph 的 vendor 拷贝纪律：改组件源必须重跑 build.sh + 本脚本，否则本体平台用旧组件。
set -euo pipefail
cd "$(dirname "$0")"

SRC="dist/cmx-ontology-graph.esm.js"
DST="../../backend/cmx-container/assets/onto/web/ui-native/vendor/cmx-ontology-graph.js"

[ -f "$SRC" ] || { echo "✗ 缺 $SRC，请先 ./build.sh"; exit 1; }
mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
echo "✅ 已拷贝组件 → $DST ($(wc -c < "$DST") 字节)"
