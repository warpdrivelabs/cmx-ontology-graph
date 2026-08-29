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
import { nodeHeight } from '../layout/layout.js';
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
/** 属性行图元前缀。 */
function propGlyph(p) {
    if (p.isPrimaryKey)
        return '◇';
    if (p.isTitle)
        return '⌾';
    return '·';
}
function statusClass(n) {
    return `og-st-${n.status || 'experimental'}`;
}
/** 一个对象类型富卡片。 */
function objectCard(n, r, cfg, sel) {
    const color = n.color || 'var(--og-node-bar)';
    const props = n.properties || [];
    const shown = props.slice(0, cfg.maxRows);
    const extra = props.length - shown.length;
    const rows = shown
        .map((p, i) => {
        const y = r.y + cfg.headH + i * cfg.rowH + cfg.rowH - 6;
        const glyph = propGlyph(p);
        const flags = (p.required ? '<tspan class="og-req">*</tspan>' : '') +
            (p.isIndexed ? ' <tspan class="og-idx">⚡</tspan>' : '');
        const sem = p.semanticType ? `<tspan class="og-sem"> ${esc(p.semanticType)}</tspan>` : '';
        const ty = p.baseType ? `<tspan class="og-ty">${esc(p.baseType)}</tspan>` : '';
        return `<text class="og-prow" x="${r.x + 14}" y="${y}"><tspan class="og-pg">${glyph}</tspan> ${esc(p.apiName)}${flags} ${ty}${sem}</text>`;
    })
        .join('');
    const more = extra > 0 ? `<text class="og-more" x="${r.x + 14}" y="${r.y + r.h - 8}">+${extra} more</text>` : '';
    // 连接点（右缘小圆，供拉线；只读态不显）。
    const port = `<circle class="og-port" data-port="${esc(n.id)}" cx="${r.x + r.w}" cy="${r.y + cfg.headH / 2}" r="5"/>`;
    return `<g class="og-node og-object ${statusClass(n)} ${sel ? 'sel' : ''}" data-node="${esc(n.id)}">
    <rect class="og-card" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>
    <rect class="og-bar" x="${r.x}" y="${r.y}" width="${r.w}" height="6" rx="3" fill="${esc(color)}"/>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 26}">${esc(n.displayName || n.id)}</text>
    <text class="og-api" x="${r.x + 14}" y="${r.y + 40}">${esc(n.id)}</text>
    <line class="og-hr" x1="${r.x}" y1="${r.y + cfg.headH}" x2="${r.x + r.w}" y2="${r.y + cfg.headH}"/>
    ${rows}${more}${port}
  </g>`;
}
/** 一个接口矮胶囊节点。 */
function interfaceCard(n, r, sel) {
    return `<g class="og-node og-interface ${sel ? 'sel' : ''}" data-node="${esc(n.id)}">
    <rect class="og-ifcard" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.h / 2}"/>
    <text class="og-iftag" x="${r.x + 14}" y="${r.y + 18}">«interface»</text>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 36}">${esc(n.displayName || n.id)}</text>
  </g>`;
}
/** 基数端点标记（SVG marker id 引用）。返回 marker 定义 + 端点 class。 */
function edgePath(e, from, to, idx, sel) {
    // 从 source 右缘中点 → target 左缘中点（正交折线，简洁）。
    const x1 = from.x + from.w;
    const y1 = from.y + 23;
    const x2 = to.x;
    const y2 = to.y + 23;
    const midX = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
    if (e.isInterfaceLink) {
        return `<path class="og-edge og-iflink" d="${d}"/>`;
    }
    const cls = `og-edge og-link${sel ? ' sel' : ''}`;
    const marker = e.cardinality === 'manyToMany' ? 'url(#og-many)' : e.cardinality === 'oneToOne' ? 'url(#og-one)' : 'url(#og-many)';
    const label = e.displayName || e.apiName;
    const role = e.roleA ? ` · ${esc(e.roleA)}` : '';
    const lx = midX;
    const ly = (y1 + y2) / 2 - 6;
    return `<g data-edge="${esc(e.apiName)}">
    <path class="${cls} og-hit" d="${d}"/>
    <path class="${cls}" d="${d}" marker-end="${marker}"/>
    <text class="og-elabel" x="${lx}" y="${ly}" text-anchor="middle">${esc(label)}${role}</text>
  </g>`;
}
export function renderSvg(def, lay, cfg, st) {
    const nodeById = new Map(def.nodes.map((n) => [n.id, n]));
    const edges = (def.edges || [])
        .map((e, i) => {
        const from = lay.pos[e.source];
        const to = lay.pos[e.target];
        if (!from || !to)
            return '';
        return edgePath(e, from, to, i, st.selectedEdgeApiName === e.apiName);
    })
        .join('');
    const nodes = def.nodes
        .map((n) => {
        const r = lay.pos[n.id];
        if (!r)
            return '';
        const sel = st.selectedNodeId === n.id;
        return n.kind === 'interface' ? interfaceCard(n, r, sel) : objectCard(n, r, cfg, sel);
    })
        .join('');
    const w = Math.max(lay.width, 400);
    const h = Math.max(lay.height, 300);
    return `<svg class="og-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="og-many" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto">
        <path d="M1,1 L11,6 L1,11" fill="none" class="og-mk"/>
      </marker>
      <marker id="og-one" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto">
        <path d="M6,1 L6,11 M8,6 L11,6" fill="none" class="og-mk"/>
      </marker>
    </defs>
    <g class="og-edges">${edges}</g>
    <g class="og-nodes">${nodes}</g>
  </svg>`;
}
/** 组件样式（走 --og-* 令牌，宿主锚 --sap*；裸色兜底）。 */
export function graphCss() {
    return `
  :host{display:block}
  .og-canvas{position:relative;width:100%;height:100%;overflow:auto;background:var(--og-bg,#0b1020)}
  .og-svg{display:block;min-width:100%}
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
  .og-port{fill:var(--og-accent,#22d3ee);stroke:var(--og-node,#121a2e);stroke-width:1.5;cursor:crosshair;opacity:.55}
  .og-port:hover{opacity:1;r:6}
  /* 接口 */
  .og-ifcard{fill:var(--og-iface,#1e1b3a);stroke:var(--og-accent2,#8b5cf6);stroke-dasharray:4 3;stroke-width:1.2}
  .og-iftag{fill:var(--og-accent2,#a78bfa);font-size:10px;font-style:italic}
  /* 边 */
  .og-edge{fill:none}
  .og-link{stroke:var(--og-edge,#64748b);stroke-width:1.6}
  .og-link.sel{stroke:var(--og-accent,#22d3ee);stroke-width:2.4}
  .og-hit{stroke:transparent;stroke-width:12;cursor:pointer}
  .og-iflink{stroke:var(--og-accent2,#8b5cf6);stroke-width:1.3;stroke-dasharray:4 3;opacity:.7}
  .og-mk{stroke:var(--og-edge,#64748b);stroke-width:1.4}
  .og-elabel{fill:var(--og-muted,#94a3b8);font-size:10.5px}
  .og-rubber{stroke:var(--og-accent,#22d3ee);stroke-width:1.8;stroke-dasharray:5 4;fill:none}
  `;
}
//# sourceMappingURL=svg.js.map