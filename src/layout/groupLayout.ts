/**
 * 分域折叠布局 —— 把节点按 DAM 分组路径(groupPath)组织成**嵌套可折叠容器**（域▸应用▸模块▸对象卡）。
 * 递归布局：收起组 = 固定小盒；展开组 = 头 + 子（子组盒 或 叶卡）货架式打包 + bbox 自适应容器。
 *
 * 性能本质：默认(无 _groupCollapsed 条目)= 收起 → 整图只画少数域盒；只有展开到叶模块层才布局其对象卡。
 * 因此可见节点数受"已展开"约束，而非对象类型总数。边由 resolveKey 归约到最近可见祖先盒 → 跨容器边聚合。
 */

import type { GraphNode, NodeRect, OntologyGraphDef } from '../model/types.js';
import { nodeHeight, type LayoutConfig } from './layout.js';

export interface GroupBox {
  key: string;
  label: string;
  count: number;
  depth: number;
  collapsed: boolean;
  rect: NodeRect;
}
export interface GroupLayoutResult {
  boxes: GroupBox[]; // 绘制顺序：外层容器在前
  pos: Record<string, NodeRect>; // 可见叶节点 id → rect
  resolveKey: (nodeId: string) => string; // 节点 → 最近可见端点键（可见=节点 id，否则收起祖先盒 key）
  rectOf: (key: string) => NodeRect | undefined;
  width: number;
  height: number;
}

const PAD = 16;
const HEADER = 34;
const GAP = 26;
const BOX_W = 220;
const BOX_H = 62;

interface GTree {
  key: string;
  label: string;
  depth: number;
  subMap: Map<string, GTree>;
  subs: GTree[];
  leaves: GraphNode[];
}

function pathOf(n: GraphNode): string[] {
  return n.groupPath && n.groupPath.length ? n.groupPath : ['未分组'];
}
function newG(key: string, label: string, depth: number): GTree {
  return { key, label, depth, subMap: new Map(), subs: [], leaves: [] };
}
function buildTree(nodes: GraphNode[]): GTree {
  const root = newG('', 'ROOT', -1);
  for (const n of nodes) {
    const path = pathOf(n);
    let cur = root;
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join('/');
      let child = cur.subMap.get(key);
      if (!child) {
        child = newG(key, path[i]!, i);
        cur.subMap.set(key, child);
        cur.subs.push(child);
      }
      cur = child;
    }
    cur.leaves.push(n);
  }
  return root;
}
function countLeaves(g: GTree): number {
  let c = g.leaves.length;
  for (const s of g.subs) c += countLeaves(s);
  return c;
}
function isCollapsed(collapsed: Record<string, boolean>, key: string): boolean {
  return collapsed[key] ?? true; // 默认收起 → 纯钻取
}

/** 递归布局一个组，原点 (ox,oy)。返回容器 rect + 内含盒 + 叶节点位置。 */
function layoutGroup(g: GTree, ox: number, oy: number, cfg: LayoutConfig, collapsed: Record<string, boolean>): { rect: NodeRect; boxes: GroupBox[]; pos: Record<string, NodeRect> } {
  const count = countLeaves(g);
  const collapsedNow = isCollapsed(collapsed, g.key);
  if (collapsedNow) {
    const rect = { x: ox, y: oy, w: BOX_W, h: BOX_H };
    return { rect, boxes: [{ key: g.key, label: g.label, count, depth: g.depth, collapsed: true, rect }], pos: {} };
  }
  // 展开：货架式打包 子组(递归) + 叶卡
  type Child = { w: number; h: number } & ({ kind: 'leaf'; node: GraphNode } | { kind: 'group'; sub: { rect: NodeRect; boxes: GroupBox[]; pos: Record<string, NodeRect> } });
  const children: Child[] = [];
  for (const sub of g.subs) {
    const sl = layoutGroup(sub, 0, 0, cfg, collapsed);
    children.push({ w: sl.rect.w, h: sl.rect.h, kind: 'group', sub: sl });
  }
  for (const leaf of g.leaves) children.push({ w: cfg.nodeW, h: nodeHeight(leaf, cfg), kind: 'leaf', node: leaf });

  const boxes: GroupBox[] = [];
  const pos: Record<string, NodeRect> = {};
  const childX = ox + PAD;
  const childY = oy + HEADER;
  const cols = Math.max(1, Math.ceil(Math.sqrt(children.length)));
  let x = childX;
  let y = childY;
  let rowH = 0;
  let col = 0;
  let maxRight = childX + BOX_W; // 容器至少放得下标题
  let maxBottom = childY;
  for (const c of children) {
    if (c.kind === 'leaf') {
      pos[c.node.id] = { x, y, w: c.w, h: c.h };
    } else {
      const dx = x;
      const dy = y;
      for (const b of c.sub.boxes) boxes.push({ ...b, rect: { x: b.rect.x + dx, y: b.rect.y + dy, w: b.rect.w, h: b.rect.h } });
      for (const id in c.sub.pos) {
        const r = c.sub.pos[id]!;
        pos[id] = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
      }
    }
    maxRight = Math.max(maxRight, x + c.w);
    maxBottom = Math.max(maxBottom, y + c.h);
    rowH = Math.max(rowH, c.h);
    col++;
    x += c.w + GAP;
    if (col >= cols) {
      col = 0;
      x = childX;
      y += rowH + GAP;
      rowH = 0;
    }
  }
  const rect = { x: ox, y: oy, w: maxRight - ox + PAD, h: Math.max(maxBottom - oy + PAD, HEADER + PAD) };
  boxes.unshift({ key: g.key, label: g.label, count, depth: g.depth, collapsed: false, rect });
  return { rect, boxes, pos };
}

/** 顶层布局：所有顶级域组货架式铺开。 */
export function groupLayout(def: OntologyGraphDef, cfg: LayoutConfig, collapsed: Record<string, boolean>): GroupLayoutResult {
  const root = buildTree(def.nodes || []);
  const boxes: GroupBox[] = [];
  const pos: Record<string, NodeRect> = {};
  // 顶级组当作 root 的展开子（root 恒展开）
  const cols = Math.max(1, Math.ceil(Math.sqrt(root.subs.length)));
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  let col = 0;
  let maxRight = PAD;
  let maxBottom = PAD;
  for (const sub of root.subs) {
    const sl = layoutGroup(sub, x, y, cfg, collapsed);
    for (const b of sl.boxes) boxes.push(b);
    for (const id in sl.pos) pos[id] = sl.pos[id]!;
    maxRight = Math.max(maxRight, sl.rect.x + sl.rect.w);
    maxBottom = Math.max(maxBottom, sl.rect.y + sl.rect.h);
    rowH = Math.max(rowH, sl.rect.h);
    col++;
    x += sl.rect.w + GAP * 1.5;
    if (col >= cols) {
      col = 0;
      x = PAD;
      y += rowH + GAP * 1.5;
      rowH = 0;
    }
  }
  const boxByKey = new Map(boxes.map((b) => [b.key, b] as const));
  // 节点 → 路径前缀键；找第一个收起前缀 = 可见盒；全展开则节点自身。
  const nodePath = new Map<string, string[]>();
  for (const n of def.nodes || []) nodePath.set(n.id, pathOf(n));
  const resolveKey = (nodeId: string): string => {
    if (pos[nodeId]) return nodeId;
    const path = nodePath.get(nodeId) || ['未分组'];
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join('/');
      if (isCollapsed(collapsed, key)) return key;
    }
    return nodeId;
  };
  const rectOf = (key: string): NodeRect | undefined => pos[key] || (boxByKey.get(key) ? boxByKey.get(key)!.rect : undefined);
  return { boxes, pos, resolveKey, rectOf, width: maxRight + PAD, height: maxBottom + PAD };
}

/** 是否有意义地分组（≥2 个含叶的最深组）。否则宿主回退扁平图。 */
export function groupingActive(def: OntologyGraphDef): boolean {
  const keys = new Set<string>();
  for (const n of def.nodes || []) {
    const p = pathOf(n);
    keys.add(p.join('/'));
    if (keys.size >= 2) return true;
  }
  return false;
}

/** 所有分组键（工具栏「全部展开/收起」用）。 */
export function allGroupKeys(def: OntologyGraphDef): string[] {
  const keys = new Set<string>();
  for (const n of def.nodes || []) {
    const p = pathOf(n);
    for (let i = 0; i < p.length; i++) keys.add(p.slice(0, i + 1).join('/'));
  }
  return [...keys];
}
