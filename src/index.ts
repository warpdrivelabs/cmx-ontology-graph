/**
 * @cmx/ontology-graph —— 本体图（Object/Link ER 图）可视化编辑组件。公共出口。
 * 与 @cmx/decision-graph 平级。副作用：import 本模块即注册 <cmx-ontology-graph> 自定义元素（幂等）。
 */

export const VERSION = '1.0.0';

// ── 类型 ──
export type {
  NodeKind,
  Cardinality,
  TypeStatus,
  GraphProperty,
  GraphNode,
  GraphEdge,
  LayoutHint,
  OntologyGraphDef,
  NodeRect,
  LayoutResult,
} from './model/types.js';
export { CARDINALITY_LABEL, STATUS_LABEL } from './model/types.js';

// ── 模型 / 布局（纯逻辑，可单测/复用） ──
export { OntologyModel } from './model/OntologyModel.js';
export { layout, nodeHeight, DEFAULT_LAYOUT, PREVIEW_LAYOUT } from './layout/layout.js';
export type { LayoutConfig } from './layout/layout.js';

// ── 渲染 ──
export { renderSvg, graphCss } from './render/svg.js';

// ── 自定义元素 ──
export { CmxOntologyGraph, defineOntologyGraph } from './element/cmx-ontology-graph.js';

// 副作用注册（浏览器环境）。
import { defineOntologyGraph } from './element/cmx-ontology-graph.js';
defineOntologyGraph();
