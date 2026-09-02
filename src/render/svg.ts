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

import type { GraphEdge, GraphNode, GraphProperty, LayoutResult, NodeRect, OntologyGraphDef } from '../model/types.js';
import { countRenderRows } from '../layout/layout.js';
import type { LayoutConfig } from '../layout/layout.js';
import { routeEdge, routeAnchored, toPath, polyMidpoint, polyMidpointOriented, type Pt, type Side } from '../layout/route.js';
import type { GroupLayoutResult, GroupBox } from '../layout/groupLayout.js';

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

/** 一个属性是否层块（复合子层）。 */
function propIsLevel(p: GraphProperty): boolean {
  return !!(p.isLevel || (p.children && p.children.length) || p.baseType === 'array' || p.baseType === 'struct');
}

/** 卡内一行的产物：文本/层头 + 该行左右锚点。递归下发 rowIdx（累计行号，用于定位 y）。 */
interface RowCtx {
  rx: number;
  rw: number;
  topY: number; // 第一行基线起点 = r.y + headH
  rowH: number;
  maxRows: number;
  pid: string;
  nodeId: string;
  hot: RenderState['hotPort'];
}
/** 单行 y 中点。 */
function rowMidY(ctx: RowCtx, rowIdx: number): number {
  return ctx.topY + rowIdx * ctx.rowH + ctx.rowH / 2;
}
/** 一属性行的左右锚点（复用原 og-port；nested 字段也可作连线端点）。 */
function rowPorts(ctx: RowCtx, propApi: string, rowIdx: number): string {
  const cy = rowMidY(ctx, rowIdx);
  const pa = esc(propApi);
  const hl = (side: string): string => (portHot(ctx.hot, ctx.nodeId, propApi, side) ? ' hot' : '');
  return (
    `<circle class="og-port${hl('L')}" data-port="${ctx.pid}" data-prop="${pa}" data-side="L" cx="${ctx.rx}" cy="${cy}" r="4.5"/>` +
    `<circle class="og-port${hl('R')}" data-port="${ctx.pid}" data-prop="${pa}" data-side="R" cx="${ctx.rx + ctx.rw}" cy="${cy}" r="4.5"/>`
  );
}
/** 标量属性行文本。 */
function scalarRow(ctx: RowCtx, p: GraphProperty, rowIdx: number, depth: number): string {
  const y = ctx.topY + rowIdx * ctx.rowH + ctx.rowH - 6;
  const x = ctx.rx + 14 + depth * 12;
  const glyph = propGlyph(p);
  const flags = (p.required ? '<tspan class="og-req">*</tspan>' : '') + (p.isIndexed ? ' <tspan class="og-idx">⚡</tspan>' : '');
  const sem = p.semanticType ? `<tspan class="og-sem"> ${esc(p.semanticType)}</tspan>` : '';
  const ty = p.baseType ? `<tspan class="og-ty">${esc(p.baseType)}</tspan>` : '';
  return `<text class="og-prow" x="${x}" y="${y}"><tspan class="og-pg">${glyph}</tspan> ${esc(p.apiName)}${flags} ${ty}${sem}</text>`;
}
/** 层块头行（缩进 + 层名 + array/struct 徽标 + 字段计数）；带浅色分隔条。 */
function levelHeader(ctx: RowCtx, p: GraphProperty, rowIdx: number, depth: number, innerRows: number): string {
  const yText = ctx.topY + rowIdx * ctx.rowH + ctx.rowH - 6;
  const x = ctx.rx + 12 + depth * 12;
  const kids = (p.children || []).length;
  const kind = p.baseType === 'struct' ? 'struct' : 'array';
  const label = p.entityName || p.displayName || p.apiName;
  // 层块背景条：覆盖层头 + 其内所有行，左缘一条竖色条示意"隶属"。
  const bandY = ctx.topY + rowIdx * ctx.rowH + 2;
  const bandH = (1 + innerRows) * ctx.rowH - 3;
  const bandX = ctx.rx + 6 + depth * 12;
  const bandW = ctx.rw - (6 + depth * 12) - 6;
  const band = `<rect class="og-level-band" x="${bandX}" y="${bandY}" width="${Math.max(bandW, 20)}" height="${bandH}" rx="6"/><rect class="og-level-bar" x="${bandX}" y="${bandY}" width="3" height="${bandH}" rx="1.5"/>`;
  const head = `<text class="og-level-hd" x="${x}" y="${yText}">▾ ${esc(label)} <tspan class="og-level-kind">${kind}·${kids}</tspan> <tspan class="og-level-api">${esc(p.apiName)}</tspan></text>`;
  return band + head;
}
/** 递归渲染属性块：返回 {body, nextIdx}。scalars 顶层截断 maxRows；层块整块展开。 */
function renderProps(ctx: RowCtx, props: GraphProperty[], depth: number, startIdx: number): { body: string; ports: string; nextIdx: number } {
  const scalars = props.filter((p) => !propIsLevel(p));
  const levels = props.filter((p) => propIsLevel(p));
  let idx = startIdx;
  let body = '';
  let ports = '';
  const shownScalars = depth === 0 ? scalars.slice(0, ctx.maxRows) : scalars;
  const extra = depth === 0 ? scalars.length - shownScalars.length : 0;
  for (const p of shownScalars) {
    body += scalarRow(ctx, p, idx, depth);
    ports += rowPorts(ctx, p.apiName, idx);
    idx += 1;
  }
  if (extra > 0) {
    const y = ctx.topY + idx * ctx.rowH + ctx.rowH - 6;
    body += `<text class="og-more" x="${ctx.rx + 14 + depth * 12}" y="${y}">+${extra} more</text>`;
    idx += 1;
  }
  for (const lv of levels) {
    const inner = countRenderRows(lv.children || [], ctx.maxRows);
    body += levelHeader(ctx, lv, idx, depth, inner);
    ports += rowPorts(ctx, lv.apiName, idx); // 层头本身也可作连线端点（整层引用）
    idx += 1;
    const sub = renderProps(ctx, lv.children || [], depth + 1, idx);
    body += sub.body;
    ports += sub.ports;
    idx = sub.nextIdx;
  }
  return { body, ports, nextIdx: idx };
}

/** 一个对象类型富卡片（支持业务单据的嵌套层块）。 */
function objectCard(n: GraphNode, r: NodeRect, cfg: LayoutConfig, sel: boolean, hot: RenderState['hotPort']): string {
  const color = n.color || 'var(--og-node-bar)';
  const props = n.properties || [];
  const ctx: RowCtx = { rx: r.x, rw: r.w, topY: r.y + cfg.headH, rowH: cfg.rowH, maxRows: cfg.maxRows, pid: esc(n.id), nodeId: n.id, hot };
  const rendered = renderProps(ctx, props, 0, 0);
  // 顶部色条裁剪到卡片圆角矩形，使左上/右上角随卡片圆角闭合（否则色条方角溢出圆角描边，观感"未闭合"）。
  const clipId = `og-clip-${n.id.replace(/[^\w-]/g, '_')}`;
  return `<g class="og-node og-object ${statusClass(n)} ${sel ? 'sel' : ''}" data-node="${esc(n.id)}">
    <clipPath id="${clipId}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/></clipPath>
    <rect class="og-card" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>
    <rect class="og-bar" x="${r.x}" y="${r.y}" width="${r.w}" height="6" fill="${esc(color)}" clip-path="url(#${clipId})"/>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 26}">${esc(n.displayName || n.id)}</text>
    <text class="og-api" x="${r.x + 14}" y="${r.y + 40}">${esc(n.id)}</text>
    <line class="og-hr" x1="${r.x}" y1="${r.y + cfg.headH}" x2="${r.x + r.w}" y2="${r.y + cfg.headH}"/>
    ${rendered.body}${rendered.ports}
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
/** 属性 apiName → 卡内累计渲染行号（镜像 renderProps 的行序；层块头 + 递归子行）。找不到返回 -1。 */
function renderRowIndexOf(props: GraphProperty[], propApi: string, maxRows: number, depth: number, startIdx: number): number {
  const scalars = props.filter((p) => !propIsLevel(p));
  const levels = props.filter((p) => propIsLevel(p));
  let idx = startIdx;
  const shown = depth === 0 ? scalars.slice(0, maxRows) : scalars;
  for (const p of shown) {
    if (p.apiName === propApi) return idx;
    idx += 1;
  }
  if (depth === 0 && scalars.length > shown.length) idx += 1; // +N more 行
  for (const lv of levels) {
    if (lv.apiName === propApi) return idx;
    idx += 1;
    const found = renderRowIndexOf(lv.children || [], propApi, maxRows, depth + 1, idx);
    if (found >= 0) return found;
    idx += countRenderRows(lv.children || [], maxRows);
  }
  return -1;
}
/** 属性行在卡内的锚点（facing side + 属性行竖直中点）；属性不在渲染行内则返回 null（调用方回退侧中点）。 */
function propAnchor(rect: NodeRect, node: GraphNode | undefined, cfg: LayoutConfig, propApi: string | null, side: Side): Pt | null {
  if (!propApi || !node || !node.properties) return null;
  const idx = renderRowIndexOf(node.properties, propApi, cfg.maxRows, 0, 0);
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
  const mid = polyMidpointOriented(pts);
  const mx = Math.round(mid.x);
  const my = Math.round(mid.y);
  const labelText = `${esc(label)}${role}`;
  // 纵向段：标签绕中点旋转 -90° 沿线竖排（偏到线左侧留缝）；横向段：线上方水平。
  const labelEl = mid.vertical
    ? `<text class="og-elabel" x="${mx - 7}" y="${my}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${mx - 7} ${my})">${labelText}</text>`
    : `<text class="og-elabel" x="${mx}" y="${my - 6}" text-anchor="middle">${labelText}</text>`;
  const route = pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
  return `<g data-edge="${esc(e.apiName)}" data-route="${route}">
    <path class="${cls} og-hit" d="${d}"/>
    <path class="${cls}" d="${d}" marker-end="url(#og-arrow)"/>
    ${segLines(pts, e.apiName)}
    ${labelEl}
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

/** 顶级域 → 稳定色（hash → hue）。 */
function domainColor(seg: string): string {
  let h = 0;
  for (let i = 0; i < seg.length; i++) h = (h * 31 + seg.charCodeAt(i)) % 360;
  return `hsl(${h},60%,60%)`;
}
/** 分组容器（收起小盒 / 展开容器头）。 */
function groupContainer(b: GroupBox): string {
  const col = domainColor((b.key.split('/')[0] as string) || b.key);
  const label = esc(b.label);
  const badge = `<g class="og-grp-badge"><rect x="${b.rect.x + b.rect.w - 44}" y="${b.rect.y + 7}" width="32" height="17" rx="8.5"/><text x="${b.rect.x + b.rect.w - 28}" y="${b.rect.y + 19}" text-anchor="middle">${b.count}</text></g>`;
  if (b.collapsed) {
    return `<g class="og-grp og-grp-collapsed" data-group-toggle="${esc(b.key)}" style="--gc:${col}">
      <rect class="og-grp-box" x="${b.rect.x}" y="${b.rect.y}" width="${b.rect.w}" height="${b.rect.h}" rx="12"/>
      <rect class="og-grp-bar" x="${b.rect.x}" y="${b.rect.y + 8}" width="5" height="${b.rect.h - 16}" rx="2.5"/>
      <text class="og-grp-caret" x="${b.rect.x + 18}" y="${b.rect.y + b.rect.h / 2 + 5}">▸</text>
      <text class="og-grp-label" x="${b.rect.x + 36}" y="${b.rect.y + b.rect.h / 2 - 3}">${label}</text>
      <text class="og-grp-key" x="${b.rect.x + 36}" y="${b.rect.y + b.rect.h / 2 + 13}">${esc(b.key)}</text>
      ${badge}
    </g>`;
  }
  return `<g class="og-grp og-grp-open" style="--gc:${col}">
    <rect class="og-grp-region" x="${b.rect.x}" y="${b.rect.y}" width="${b.rect.w}" height="${b.rect.h}" rx="12"/>
    <g data-group-toggle="${esc(b.key)}">
      <rect class="og-grp-head" x="${b.rect.x}" y="${b.rect.y}" width="${b.rect.w}" height="28" rx="12"/>
      <text class="og-grp-caret" x="${b.rect.x + 16}" y="${b.rect.y + 19}">▾</text>
      <text class="og-grp-label" x="${b.rect.x + 32}" y="${b.rect.y + 19}">${label}</text>
      ${badge}
    </g>
  </g>`;
}
/** 归约后的桥接连接线（盒↔盒 / 卡↔盒）——正交避让布线（绕开其余可见盒/卡）+ 计数，不再直线穿越。 */
function bundledEdge(a: NodeRect, b: NodeRect, count: number, others: NodeRect[]): string {
  const pts = routeEdge(a, b, others);
  const d = toPath(pts);
  const mid = polyMidpoint(pts);
  const mx = Math.round(mid.x);
  const my = Math.round(mid.y);
  const cnt = count > 1 ? `<g class="og-bundle-cnt"><rect x="${mx - 11}" y="${my - 9}" width="22" height="16" rx="8"/><text x="${mx}" y="${my + 3}" text-anchor="middle">${count}</text></g>` : '';
  return `<path class="og-bundle" d="${d}" marker-end="url(#og-arrow)"/>${cnt}`;
}

/** 分域折叠渲染：容器盒 + 可见叶卡 + 归约后的边。可见节点数受"已展开"约束，而非对象总数。 */
export function renderGrouped(def: OntologyGraphDef, gl: GroupLayoutResult, cfg: LayoutConfig, st: RenderState): string {
  const nodeById = new Map(def.nodes.map((n) => [n.id, n]));
  const containers = gl.boxes.map(groupContainer).join('');
  const cards = def.nodes
    .map((n) => {
      const r = gl.pos[n.id];
      if (!r) return '';
      const sel = st.selectedNodeId === n.id;
      return n.kind === 'interface' ? interfaceCard(n, r, sel, st.hotPort) : objectCard(n, r, cfg, sel, st.hotPort);
    })
    .join('');
  // 避让障碍集 = 可见叶卡 + 收起容器盒（展开容器区不作实心障碍，其内叶卡才是障碍）。
  const cardRects = Object.keys(gl.pos).map((id) => gl.pos[id] as NodeRect);
  const collapsedBoxRects = gl.boxes.filter((b) => b.collapsed).map((b) => b.rect);
  const obstacleRects = [...cardRects, ...collapsedBoxRects];
  const bundles = new Map<string, { a: string; b: string; count: number }>();
  let fineEdges = '';
  for (const e of def.edges || []) {
    const aK = gl.resolveKey(e.source);
    const bK = gl.resolveKey(e.target);
    if (aK === bK) continue; // 收起容器内部边 → 隐藏
    if (aK === e.source && bK === e.target) {
      const from = gl.pos[e.source];
      const to = gl.pos[e.target];
      if (!from || !to) continue;
      const others = obstacleRects.filter((r) => r !== from && r !== to);
      const manualRoute = def._edgeRoutes ? def._edgeRoutes[e.apiName] : undefined;
      fineEdges += edgePath(e, from, to, nodeById.get(e.source), nodeById.get(e.target), cfg, others, manualRoute, st.selectedEdgeApiName === e.apiName);
    } else {
      const k = [aK, bK].sort().join('|');
      const cur = bundles.get(k);
      if (cur) cur.count++;
      else bundles.set(k, { a: aK, b: bK, count: 1 });
    }
  }
  let bundleEdges = '';
  for (const b of bundles.values()) {
    const ra = gl.rectOf(b.a);
    const rb = gl.rectOf(b.b);
    if (ra && rb) {
      const others = obstacleRects.filter((r) => r !== ra && r !== rb);
      bundleEdges += bundledEdge(ra, rb, b.count, others);
    }
  }
  const w = Math.max(gl.width, 400);
  const h = Math.max(gl.height, 300);
  return `<svg class="og-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="og-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M2,2.2 L10.5,6 L2,9.8 L4.8,6 Z" class="og-mk"/>
      </marker>
    </defs>
    <g class="og-groups">${containers}</g>
    <g class="og-edges">${bundleEdges}${fineEdges}</g>
    <g class="og-nodes">${cards}</g>
  </svg>`;
}

/** 组件样式（走 --og-* 令牌，:host 锚定门户 --sap* → light/dark 随门户主题自动翻，零 JS；裸 hex 仅独立部署无 UI5 时降级）。 */
export function graphCss(): string {
  return `
  :host{
    display:block;width:100%;height:100%;
    /* 设计令牌层：全部派生自门户 --sap* 主题令牌（UI5 在 :root 重定义 --sap*，作为继承属性穿透 shadow 边界 → 自动翻，零 JS）。
       裸 hex 为 light-first 降级（独立部署无 UI5 运行时时命中）。科技感强调色走 color-mix 派生。 */
    --og-bg:var(--sapBackgroundColor,#f5f6f7);
    --og-node:var(--sapList_Background,#ffffff);
    --og-node2:var(--sapList_Hover_Background,#eef3fb);
    --og-node-bar:var(--sapHighlightColor,#0a6ed1);
    --og-fg:var(--sapTextColor,#1c2530);
    --og-muted:var(--sapContent_LabelColor,#5a6b7b);
    --og-border:var(--sapList_BorderColor,#c9ced4);
    --og-accent:var(--sapHighlightColor,#0a6ed1);
    --og-accent2:color-mix(in srgb,var(--sapHighlightColor,#0a6ed1) 55%,#8b5cf6);
    --og-edge:var(--sapContent_LabelColor,#5a6b7b);
    --og-iface:color-mix(in srgb,var(--sapHighlightColor,#0a6ed1) 8%,var(--sapList_Background,#fff));
    --og-ok:var(--sapPositiveColor,#178a5a);
    --og-warn:var(--sapCriticalColor,#c26a00);
    --og-err:var(--sapNegativeColor,#d1394a);
    --og-mono:var(--sapContent_MonospaceFontFamily,ui-monospace,Menlo,Consolas,monospace);
    color-scheme:light dark;
  }
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
  /* 业务单据层块（头/行/明细：单卡内嵌套分层） */
  .og-level-band{fill:color-mix(in srgb,var(--og-accent,#22d3ee) 7%,transparent);stroke:color-mix(in srgb,var(--og-accent,#22d3ee) 22%,transparent);stroke-width:1}
  .og-level-bar{fill:var(--og-accent2,#8b5cf6)}
  .og-level-hd{fill:var(--og-fg,#e6ecf5);font-size:11px;font-weight:700}
  .og-level-kind{fill:var(--og-accent2,#a78bfa);font-size:9.5px;font-weight:600}
  .og-level-api{fill:var(--og-muted,#64748b);font-size:9px;font-family:var(--og-mono,ui-monospace,Menlo,monospace)}
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
  /* 分域折叠容器 */
  .og-grp{cursor:pointer}
  .og-grp-box{fill:var(--og-node,#121a2e);stroke:var(--gc,#22d3ee);stroke-width:1.4}
  .og-grp-collapsed:hover .og-grp-box{fill:var(--og-node2,#17223c);stroke-width:2}
  .og-grp-bar{fill:var(--gc,#22d3ee)}
  .og-grp-caret{fill:var(--gc,#22d3ee);font-size:12px}
  .og-grp-label{fill:var(--og-fg,#e6ecf5);font-size:13.5px;font-weight:700}
  .og-grp-key{fill:var(--og-muted,#94a3b8);font-size:10px;font-family:var(--og-mono,ui-monospace,Menlo,monospace)}
  .og-grp-badge rect{fill:color-mix(in srgb,var(--gc,#22d3ee) 22%,transparent);stroke:var(--gc,#22d3ee);stroke-width:.8}
  .og-grp-badge text{fill:var(--gc,#22d3ee);font-size:11px;font-weight:700}
  .og-grp-region{fill:color-mix(in srgb,var(--gc,#22d3ee) 6%,transparent);stroke:var(--gc,#22d3ee);stroke-width:1.1;stroke-dasharray:3 4}
  .og-grp-head{fill:color-mix(in srgb,var(--gc,#22d3ee) 14%,transparent)}
  .og-grp-open>g[data-group-toggle]:hover .og-grp-head{fill:color-mix(in srgb,var(--gc,#22d3ee) 26%,transparent)}
  .og-bundle{stroke:var(--og-edge,#64748b);stroke-width:1.8;fill:none;opacity:.85}
  .og-bundle-cnt rect{fill:var(--og-bg,#0b1020);stroke:var(--og-edge,#64748b);stroke-width:.8}
  .og-bundle-cnt text{fill:var(--og-muted,#94a3b8);font-size:10.5px;font-weight:700}
  `;
}
