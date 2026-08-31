/**
 * 本体图 SVG 渲染 —— 纯函数，产出 SVG 字符串。富卡片（对象类型）+ 基数边 + 接口虚线挂接。
 *
 * 视觉编码（对齐前端定义 UX 方案 §4.1）：
 * - 对象类型 = 圆角矩形卡：顶部 color 色条 + displayName + apiName(mono 小字)；卡内属性行
 *   （主键 ◇ 置顶、标题 ⌾、必填 *、索引 ⚡、语义类型徽标）；超 maxRows 折叠 "+N"。
 * - 状态描边：experimental 琥珀虚线 / active 绿实线 / deprecated 灰。
 * - 关系边 = 有向连线：端点基数符号（1 一端 / 鸦爪 多端）；线中标签 = displayName + 角色。
 * - 接口 = 矮胶囊节点 + «interface»；实现边 = 紫色虚线。
 * - 令牌：走 --og-* CSS 变量（宿主锚 --sap*，双主题），裸色仅作兜底。
 */

import type { GraphEdge, GraphNode, LayoutResult, NodeRect, OntologyGraphDef } from '../model/types.js';
import { nodeHeight } from '../layout/layout.js';
import type { LayoutConfig } from '../layout/layout.js';
import { routeEdge, routeAnchored, toPath, polyMidpoint, type Pt, type Side } from '../layout/route.js';

export interface RenderState {
  selectedNodeId: string | null;
  selectedEdgeApiName: string | null;
  readonly: boolean;
  maxRows: number;
  /** 连线拖拽中，光标下高亮的锚点（状态驱动，随每次重绘生效）。 */
  hotPort: { node: string; prop: string | null; side: string | null } | null;
}

/** 该锚点是否为当前高亮锚点。 */
function portHot(hot: RenderState['hotPort'], node: string, prop: string | null, side: string): boolean {
  return !!hot && hot.node === node && (hot.prop || null) === (prop || null) && hot.side === side;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** 属性行图元前缀。 */
function propGlyph(p: { isPrimaryKey?: boolean; isTitle?: boolean }): string {
  if (p.isPrimaryKey) return '◇';
  if (p.isTitle) return '⌾';
  return '·';
}

function statusClass(n: GraphNode): string {
  return `og-st-${n.status || 'experimental'}`;
}

/** 一个对象类型富卡片。 */
function objectCard(n: GraphNode, r: NodeRect, cfg: LayoutConfig, sel: boolean, hot: RenderState['hotPort']): string {
  const color = n.color || 'var(--og-node-bar)';
  const props = n.properties || [];
  const shown = props.slice(0, cfg.maxRows);
  const extra = props.length - shown.length;
  const rows = shown
    .map((p, i) => {
      const y = r.y + cfg.headH + i * cfg.rowH + cfg.rowH - 6;
      const glyph = propGlyph(p);
      const flags =
        (p.required ? '<tspan class="og-req">*</tspan>' : '') +
        (p.isIndexed ? ' <tspan class="og-idx">⚡</tspan>' : '');
      const sem = p.semanticType ? `<tspan class="og-sem"> ${esc(p.semanticType)}</tspan>` : '';
      const ty = p.baseType ? `<tspan class="og-ty">${esc(p.baseType)}</tspan>` : '';
      return `<text class="og-prow" x="${r.x + 14}" y="${y}"><tspan class="og-pg">${glyph}</tspan> ${esc(p.apiName)}${flags} ${ty}${sem}</text>`;
    })
    .join('');
  const more = extra > 0 ? `<text class="og-more" x="${r.x + 14}" y="${r.y + r.h - 8}">+${extra} more</text>` : '';
  // 每属性行在左右边框各一个连接锚点（拖拽建关系 → 属性到属性）。只读态 CSS 隐藏；默认淡出，悬停卡片/连线态浮现。
  const pid = esc(n.id);
  const ports = shown
    .map((p, i) => {
      const cy = r.y + cfg.headH + i * cfg.rowH + cfg.rowH / 2;
      const pa = esc(p.apiName);
      const hl = (side: string): string => (portHot(hot, n.id, p.apiName, side) ? ' hot' : '');
      return (
        `<circle class="og-port${hl('L')}" data-port="${pid}" data-prop="${pa}" data-side="L" cx="${r.x}" cy="${cy}" r="4.5"/>` +
        `<circle class="og-port${hl('R')}" data-port="${pid}" data-prop="${pa}" data-side="R" cx="${r.x + r.w}" cy="${cy}" r="4.5"/>`
      );
    })
    .join('');
  // 顶部色条裁剪到卡片圆角矩形，使左上/右上角随卡片圆角闭合（否则色条方角溢出圆角描边，观感"未闭合"）。
  const clipId = `og-clip-${n.id.replace(/[^\w-]/g, '_')}`;
  return `<g class="og-node og-object ${statusClass(n)} ${sel ? 'sel' : ''}" data-node="${esc(n.id)}">
    <clipPath id="${clipId}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/></clipPath>
    <rect class="og-card" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>
    <rect class="og-bar" x="${r.x}" y="${r.y}" width="${r.w}" height="6" fill="${esc(color)}" clip-path="url(#${clipId})"/>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 26}">${esc(n.displayName || n.id)}</text>
    <text class="og-api" x="${r.x + 14}" y="${r.y + 40}">${esc(n.id)}</text>
    <line class="og-hr" x1="${r.x}" y1="${r.y + cfg.headH}" x2="${r.x + r.w}" y2="${r.y + cfg.headH}"/>
    ${rows}${more}${ports}
  </g>`;
}

/** 一个接口矮胶囊节点（四向连接锚点：上/下/左/右）。 */
function interfaceCard(n: GraphNode, r: NodeRect, sel: boolean, hot: RenderState['hotPort']): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const nid = esc(n.id);
  const hl = (side: string): string => (portHot(hot, n.id, null, side) ? ' hot' : '');
  const ports =
    `<circle class="og-port${hl('T')}" data-port="${nid}" data-side="T" cx="${cx}" cy="${r.y}" r="4.5"/>` +
    `<circle class="og-port${hl('B')}" data-port="${nid}" data-side="B" cx="${cx}" cy="${r.y + r.h}" r="4.5"/>` +
    `<circle class="og-port${hl('L')}" data-port="${nid}" data-side="L" cx="${r.x}" cy="${cy}" r="4.5"/>` +
    `<circle class="og-port${hl('R')}" data-port="${nid}" data-side="R" cx="${r.x + r.w}" cy="${cy}" r="4.5"/>`;
  return `<g class="og-node og-interface ${sel ? 'sel' : ''}" data-node="${esc(n.id)}">
    <rect class="og-ifcard" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.h / 2}"/>
    <text class="og-iftag" x="${r.x + 14}" y="${r.y + 18}">«interface»</text>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 36}">${esc(n.displayName || n.id)}</text>
    ${ports}
  </g>`;
}

/** 节点主键属性 apiName。 */
function primaryKeyProp(n: GraphNode | undefined): string | null {
  const p = n && n.properties ? n.properties.find((x) => x.isPrimaryKey) : undefined;
  return p ? p.apiName : null;
}
/** 归一（小写、去分隔符；保留字母数字与中日韩）。 */
function normName(s: string | undefined): string {
  return (s || '').toLowerCase().replace(/[\s_\-./:\\|()\[\]{}·（）【】]+/g, '');
}
/** 猜源侧外键属性：属性 apiName 与目标（显示名/apiName/关系名）名称含入匹配，排除源自身主键。 */
function fkProp(src: GraphNode | undefined, e: GraphEdge, tgt: GraphNode | undefined): string | null {
  if (!src || !src.properties) return null;
  const targets = [tgt ? tgt.displayName : undefined, tgt ? tgt.id : undefined, e.roleA, e.displayName]
    .map(normName)
    .filter((s) => s.length >= 2);
  if (targets.length === 0) return null;
  const pk = primaryKeyProp(src);
  let best: { name: string; score: number } | null = null;
  for (const p of src.properties) {
    if (p.apiName === pk) continue;
    const c = normName(p.apiName);
    if (c.length < 2) continue;
    for (const t of targets) {
      if (c === t || c.includes(t) || t.includes(c)) {
        const score = Math.min(c.length, t.length);
        if (best === null || score > best.score) best = { name: p.apiName, score };
      }
    }
  }
  return best ? best.name : null;
}
/** 属性行在卡内的锚点（facing side + 属性行竖直中点）；属性不在展示行内则返回 null（调用方回退侧中点）。 */
function propAnchor(rect: NodeRect, node: GraphNode | undefined, cfg: LayoutConfig, propApi: string | null, side: Side): Pt | null {
  if (!propApi || !node || !node.properties) return null;
  const idx = node.properties.slice(0, cfg.maxRows).findIndex((p) => p.apiName === propApi);
  if (idx < 0) return null;
  const y = Math.round(rect.y + cfg.headH + idx * cfg.rowH + cfg.rowH / 2);
  const x = side === 'R' ? Math.round(rect.x + rect.w) : Math.round(rect.x);
  return { x, y };
}
/** 卡片侧边中点（无属性锚点时兜底）。 */
function sideMid(rect: NodeRect, side: Side): Pt {
  return { x: side === 'R' ? Math.round(rect.x + rect.w) : Math.round(rect.x), y: Math.round(rect.y + rect.h / 2) };
}
/** 面向对方的水平侧（属性行只有左右锚点有意义）。 */
function horizSide(self: NodeRect, other: NodeRect): Side {
  return other.x + other.w / 2 >= self.x + self.w / 2 ? 'R' : 'L';
}

/** 两点近似相等（判手动布线端点是否仍贴合当前锚点）。 */
function nearPt(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5;
}
/** 内部可拖拽线段（两端都非锚点 = 索引 1..len-3）的透明命中线；水平段上下拖、垂直段左右拖。 */
function segLines(pts: Pt[], apiName: string): string {
  let out = '';
  for (let i = 1; i <= pts.length - 3; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const orient = a.y === b.y ? 'H' : a.x === b.x ? 'V' : '';
    if (!orient) continue;
    out += `<line class="og-seg og-seg-${orient}" data-edge-seg="${esc(apiName)}" data-seg-i="${i}" data-orient="${orient}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }
  return out;
}

/** 关系边：属性到属性锚点 + 正交避让布线（可被手动布线覆盖）+ 圆角 + 可拖拽内部线段。 */
function edgePath(
  e: GraphEdge,
  from: NodeRect,
  to: NodeRect,
  srcNode: GraphNode | undefined,
  tgtNode: GraphNode | undefined,
  cfg: LayoutConfig,
  others: NodeRect[],
  manualRoute: Pt[] | undefined,
  sel: boolean,
): string {
  if (e.isInterfaceLink) {
    const d = toPath(routeEdge(from, to, others)); // 接口挂接：几何朝向侧
    return `<path class="og-edge og-iflink" d="${d}"/>`;
  }
  const sSide = horizSide(from, to);
  const tSide = horizSide(to, from);
  const srcProp = e.sourceProperty ?? fkProp(srcNode, e, tgtNode) ?? primaryKeyProp(srcNode);
  const tgtProp = e.targetProperty ?? primaryKeyProp(tgtNode);
  const pa = propAnchor(from, srcNode, cfg, srcProp, sSide) ?? sideMid(from, sSide);
  const pb = propAnchor(to, tgtNode, cfg, tgtProp, tSide) ?? sideMid(to, tSide);
  // 手动布线仍贴合当前锚点（节点未移动）→ 用之；否则自动布线（节点移动后锚点变化即回退，锚点随节点）。
  const useManual = !!manualRoute && manualRoute.length >= 2 && nearPt(manualRoute[0]!, pa) && nearPt(manualRoute[manualRoute.length - 1]!, pb);
  const pts = useManual ? manualRoute! : routeAnchored(pa, sSide, pb, tSide, from, to, others);
  const d = toPath(pts);
  const cls = `og-edge og-link${sel ? ' sel' : ''}`;
  const label = e.displayName || e.apiName;
  const role = e.roleA ? ` · ${esc(e.roleA)}` : '';
  const mid = polyMidpoint(pts);
  const route = pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
  return `<g data-edge="${esc(e.apiName)}" data-route="${route}">
    <path class="${cls} og-hit" d="${d}"/>
    <path class="${cls}" d="${d}" marker-end="url(#og-arrow)"/>
    ${segLines(pts, e.apiName)}
    <text class="og-elabel" x="${Math.round(mid.x)}" y="${Math.round(mid.y) - 6}" text-anchor="middle">${esc(label)}${role}</text>
  </g>`;
}

export function renderSvg(def: OntologyGraphDef, lay: LayoutResult, cfg: LayoutConfig, st: RenderState): string {
  const nodeById = new Map(def.nodes.map((n) => [n.id, n]));
  const edges = (def.edges || [])
    .map((e) => {
      const from = lay.pos[e.source];
      const to = lay.pos[e.target];
      if (!from || !to) return '';
      const others = def.nodes
        .filter((n) => n.id !== e.source && n.id !== e.target)
        .map((n) => lay.pos[n.id])
        .filter((r): r is NodeRect => !!r);
      const manualRoute = def._edgeRoutes ? def._edgeRoutes[e.apiName] : undefined;
      return edgePath(e, from, to, nodeById.get(e.source), nodeById.get(e.target), cfg, others, manualRoute, st.selectedEdgeApiName === e.apiName);
    })
    .join('');
  const nodes = def.nodes
    .map((n) => {
      const r = lay.pos[n.id];
      if (!r) return '';
      const sel = st.selectedNodeId === n.id;
      return n.kind === 'interface' ? interfaceCard(n, r, sel, st.hotPort) : objectCard(n, r, cfg, sel, st.hotPort);
    })
    .join('');
  const w = Math.max(lay.width, 400);
  const h = Math.max(lay.height, 300);
  return `<svg class="og-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="og-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M2,2.2 L10.5,6 L2,9.8 L4.8,6 Z" class="og-mk"/>
      </marker>
    </defs>
    <g class="og-edges">${edges}</g>
    <g class="og-nodes">${nodes}</g>
  </svg>`;
}

/** 组件样式（走 --og-* 令牌，宿主锚 --sap*；裸色兜底）。 */
export function graphCss(): string {
  return `
  :host{display:block;width:100%;height:100%}
  .og-canvas{position:relative;width:100%;height:100%;overflow:auto;background:var(--og-bg,#0b1020)}
  .og-svg{display:block}
  .og-empty{padding:40px;text-align:center;color:var(--og-muted,#94a3b8);font-size:13px}
  /* 卡片 */
  .og-card{fill:var(--og-node,#121a2e);stroke:var(--og-border,#243049);stroke-width:1.2}
  .og-node.sel .og-card,.og-node.sel .og-ifcard{stroke:var(--og-accent,#22d3ee);stroke-width:2}
  .og-st-experimental .og-card{stroke-dasharray:5 3;stroke:var(--og-warn,#f59e0b)}
  .og-st-active .og-card{stroke:var(--og-ok,#22c55e)}
  .og-st-deprecated .og-card{stroke:var(--og-muted,#64748b)}
  .og-hr{stroke:var(--og-border,#243049);stroke-width:1}
  .og-title{fill:var(--og-fg,#e6ecf5);font-size:13px;font-weight:700}
  .og-api{fill:var(--og-muted,#94a3b8);font-size:10.5px;font-family:var(--og-mono,ui-monospace,Menlo,monospace)}
  .og-prow{fill:var(--og-fg,#cbd5e1);font-size:11.5px}
  .og-pg{fill:var(--og-accent,#22d3ee)}
  .og-ty{fill:var(--og-muted,#94a3b8);font-size:10px}
  .og-sem{fill:var(--og-accent2,#6366f1);font-size:10px}
  .og-req{fill:var(--og-err,#ef4444);font-weight:700}
  .og-idx{fill:var(--og-warn,#f59e0b)}
  .og-more{fill:var(--og-muted,#64748b);font-size:10.5px;font-style:italic}
  .og-port{fill:var(--og-accent,#22d3ee);stroke:var(--og-node,#121a2e);stroke-width:1.5;cursor:crosshair;opacity:.6;transition:opacity .12s ease, r .12s ease}
  .og-port:hover{opacity:1;r:6.5}
  .og-port.hot{opacity:1;r:8;fill:var(--og-ok,#22c55e);stroke:var(--og-node,#121a2e);stroke-width:2;filter:drop-shadow(0 0 4px var(--og-ok,#22c55e))}
  .og-canvas.og-readonly .og-port{display:none}
  /* 接口 */
  .og-ifcard{fill:var(--og-iface,#1e1b3a);stroke:var(--og-accent2,#8b5cf6);stroke-dasharray:4 3;stroke-width:1.2}
  .og-iftag{fill:var(--og-accent2,#a78bfa);font-size:10px;font-style:italic}
  /* 边 */
  .og-edge{fill:none}
  .og-link{stroke:var(--og-edge,#64748b);stroke-width:1.6}
  .og-link.sel{stroke:var(--og-accent,#22d3ee);stroke-width:2.4}
  .og-hit{stroke:transparent;stroke-width:12;cursor:pointer}
  .og-seg{stroke:transparent;stroke-width:12;fill:none}
  .og-seg-H{cursor:ns-resize}
  .og-seg-V{cursor:ew-resize}
  .og-seg-H:hover,.og-seg-V:hover{stroke:var(--og-accent,#22d3ee);opacity:.35}
  .og-iflink{stroke:var(--og-accent2,#8b5cf6);stroke-width:1.3;stroke-dasharray:4 3;opacity:.7}
  .og-mk{fill:var(--og-edge,#64748b);stroke:none}
  .og-elabel{fill:var(--og-muted,#94a3b8);font-size:10.5px}
  .og-rubber{stroke:var(--og-accent,#22d3ee);stroke-width:1.8;stroke-dasharray:5 4;fill:none}
  `;
}
