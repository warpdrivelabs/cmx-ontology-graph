/**
 * 本体图自动布局 —— 纯函数。本体图非严格 DAG（关系可双向/自环），故不做拓扑分层，改用
 * **确定性网格布局**（按节点数开方铺格），再叠加手动拖拽提示（_layout）。稳定、无环假设、可覆盖。
 *
 * 富卡片高度随属性行数变化（对象类型卡内列关键属性）；接口节点固定矮胶囊。
 */

import type { GraphNode, LayoutResult, NodeRect, OntologyGraphDef } from '../model/types.js';

export interface LayoutConfig {
  /** 网格列间距（卡片中心距）。 */
  colGap: number;
  /** 网格行间距。 */
  rowGap: number;
  /** 卡片宽。 */
  nodeW: number;
  /** 卡片头部高（色条 + 标题）。 */
  headH: number;
  /** 每属性行高。 */
  rowH: number;
  /** 卡内最多显示属性行数（超出折叠 +N）。 */
  maxRows: number;
  /** 画布外边距。 */
  pad: number;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  colGap: 300,
  rowGap: 260,
  nodeW: 210,
  headH: 46,
  rowH: 22,
  maxRows: 6,
  pad: 40,
};
export const PREVIEW_LAYOUT: LayoutConfig = {
  colGap: 260,
  rowGap: 220,
  nodeW: 190,
  headH: 42,
  rowH: 20,
  maxRows: 4,
  pad: 30,
};

/** 卡片高度：对象类型 = 头 + min(属性数, maxRows)*行高 + 折叠行；接口 = 矮胶囊。 */
export function nodeHeight(n: GraphNode, cfg: LayoutConfig): number {
  if (n.kind === 'interface') return cfg.headH;
  const props = n.properties || [];
  const shown = Math.min(props.length, cfg.maxRows);
  const extra = props.length > cfg.maxRows ? cfg.rowH : 0;
  return cfg.headH + shown * cfg.rowH + extra + 8;
}

/** 计算布局：确定性网格 + 拖拽提示覆盖。 */
export function layout(
  def: OntologyGraphDef,
  cfg: LayoutConfig,
  hints?: Record<string, { x: number; y: number }>,
): LayoutResult {
  const nodes = def.nodes || [];
  const pos: Record<string, NodeRect> = {};
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  let maxX = 0;
  let maxY = 0;
  nodes.forEach((n, i) => {
    const gx = i % cols;
    const gy = Math.floor(i / cols);
    const h = nodeHeight(n, cfg);
    const def_x = cfg.pad + gx * cfg.colGap;
    const def_y = cfg.pad + gy * cfg.rowGap;
    const hint = hints ? hints[n.id] : undefined;
    const x = hint ? hint.x : def_x;
    const y = hint ? hint.y : def_y;
    pos[n.id] = { x, y, w: cfg.nodeW, h };
    maxX = Math.max(maxX, x + cfg.nodeW);
    maxY = Math.max(maxY, y + h);
  });
  return { pos, width: maxX + cfg.pad, height: maxY + cfg.pad };
}
