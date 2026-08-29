// src/model/types.ts
var CARDINALITY_LABEL = {
  oneToOne: "1:1",
  oneToMany: "1:N",
  manyToMany: "N:M"
};
var STATUS_LABEL = {
  experimental: "\u8BD5\u9A8C",
  active: "\u6FC0\u6D3B",
  deprecated: "\u5E9F\u5F03"
};

// src/model/OntologyModel.ts
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
var OntologyModel = class _OntologyModel {
  def;
  constructor(def) {
    this.def = def ? clone(def) : _OntologyModel.skeleton();
    this.def.nodes = this.def.nodes || [];
    this.def.edges = this.def.edges || [];
    this.syncInterfaceLinks();
  }
  /** 空骨架。 */
  static skeleton(name) {
    const def = { nodes: [], edges: [] };
    if (name != null) def.name = name;
    return def;
  }
  getDef() {
    return clone(this.def);
  }
  setDef(def) {
    this.def = clone(def);
    this.def.nodes = this.def.nodes || [];
    this.def.edges = this.def.edges || [];
    this.syncInterfaceLinks();
  }
  get nodes() {
    return this.def.nodes;
  }
  get edges() {
    return this.def.edges;
  }
  node(id) {
    return this.def.nodes.find((n) => n.id === id);
  }
  /** 仅普通关系边（排除接口实现边）。 */
  get linkEdges() {
    return this.def.edges.filter((e) => !e.isInterfaceLink);
  }
  /** 加对象类型节点。返回 apiName（须唯一，调用方保证；重名则返回 null）。 */
  addObjectType(apiName, displayName) {
    if (!apiName || this.node(apiName)) return null;
    const n = { id: apiName, kind: "object", properties: [] };
    if (displayName != null) n.displayName = displayName;
    n.status = "experimental";
    this.def.nodes.push(n);
    return apiName;
  }
  /** 加接口节点。 */
  addInterface(apiName, displayName) {
    if (!apiName || this.node(apiName)) return null;
    const n = { id: apiName, kind: "interface" };
    if (displayName != null) n.displayName = displayName;
    this.def.nodes.push(n);
    return apiName;
  }
  /** 删节点 + 关联边 + 布局提示 + 其它节点对它的 implements 引用。 */
  delNode(id) {
    this.def.nodes = this.def.nodes.filter((n) => n.id !== id);
    this.def.edges = this.def.edges.filter((e) => e.source !== id && e.target !== id);
    for (const n of this.def.nodes) {
      if (n.implements) n.implements = n.implements.filter((x) => x !== id);
    }
    if (this.def._layout) delete this.def._layout[id];
    this.syncInterfaceLinks();
  }
  /** 加普通关系边。返回 null 成功，否则拒绝原因。apiName 须唯一。 */
  addLink(apiName, source, target, cardinality = "oneToMany", roleA, roleB) {
    if (!this.node(source) || !this.node(target)) return "\u5173\u7CFB\u4E24\u7AEF\u5BF9\u8C61\u7C7B\u578B\u987B\u5B58\u5728";
    if (this.def.edges.some((e2) => e2.apiName === apiName && !e2.isInterfaceLink))
      return `\u5173\u7CFB apiName\u300C${apiName}\u300D\u5DF2\u5B58\u5728`;
    const e = { apiName, source, target, cardinality };
    if (roleA != null) e.roleA = roleA;
    if (roleB != null) e.roleB = roleB;
    this.def.edges.push(e);
    return null;
  }
  /** 删普通关系边（按 apiName）。 */
  delLink(apiName) {
    this.def.edges = this.def.edges.filter((e) => e.isInterfaceLink || e.apiName !== apiName);
  }
  /** 设对象类型实现某接口（幂等），并同步接口实现边。 */
  setImplements(objectApiName, interfaceApiName, on) {
    const n = this.node(objectApiName);
    if (!n || n.kind !== "object") return;
    n.implements = n.implements || [];
    const has = n.implements.includes(interfaceApiName);
    if (on && !has) n.implements.push(interfaceApiName);
    if (!on && has) n.implements = n.implements.filter((x) => x !== interfaceApiName);
    this.syncInterfaceLinks();
  }
  /** 由各对象类型的 implements 重建接口实现边（虚线挂接）。 */
  syncInterfaceLinks() {
    this.def.edges = this.def.edges.filter((e) => !e.isInterfaceLink);
    for (const n of this.def.nodes) {
      if (n.kind !== "object" || !n.implements) continue;
      for (const iface of n.implements) {
        if (!this.node(iface)) continue;
        this.def.edges.push({
          apiName: `${n.id}__implements__${iface}`,
          source: n.id,
          target: iface,
          isInterfaceLink: true
        });
      }
    }
  }
  // ── 属性操作（对象类型卡内）──
  addProperty(objectApiName, prop) {
    const n = this.node(objectApiName);
    if (!n || n.kind !== "object") return;
    n.properties = n.properties || [];
    n.properties.push(prop);
  }
  setProperties(objectApiName, props) {
    const n = this.node(objectApiName);
    if (!n || n.kind !== "object") return;
    n.properties = props;
  }
  setNodeMeta(id, patch) {
    const n = this.node(id);
    if (n) Object.assign(n, patch);
  }
  // ── 布局提示 ──
  setLayoutHint(id, x, y) {
    this.def._layout = this.def._layout || {};
    this.def._layout[id] = { x, y };
  }
  layoutHints() {
    return this.def._layout;
  }
  clearLayoutHints() {
    delete this.def._layout;
  }
  /** 本地结构校验（镜像后端）。返回 null 或首个违规信息。 */
  validate() {
    const ids = /* @__PURE__ */ new Set();
    for (const n of this.def.nodes) {
      if (ids.has(n.id)) return `\u7C7B\u578B apiName \u91CD\u590D\uFF1A${n.id}`;
      ids.add(n.id);
    }
    for (const e of this.def.edges) {
      if (e.isInterfaceLink) continue;
      if (!ids.has(e.source) || !ids.has(e.target))
        return `\u5173\u7CFB\u300C${e.apiName}\u300D\u7AEF\u70B9\u4E0D\u5B58\u5728\uFF1A${e.source} \u2192 ${e.target}`;
    }
    for (const n of this.def.nodes) {
      if (n.kind !== "object") continue;
      const props = n.properties || [];
      const pkCount = props.filter((p) => p.isPrimaryKey).length;
      if (props.length && pkCount === 0) return `\u5BF9\u8C61\u7C7B\u578B\u300C${n.id}\u300D\u7F3A\u4E3B\u952E`;
    }
    return null;
  }
};

// src/layout/layout.ts
var DEFAULT_LAYOUT = {
  colGap: 300,
  rowGap: 260,
  nodeW: 210,
  headH: 46,
  rowH: 22,
  maxRows: 6,
  pad: 40
};
var PREVIEW_LAYOUT = {
  colGap: 260,
  rowGap: 220,
  nodeW: 190,
  headH: 42,
  rowH: 20,
  maxRows: 4,
  pad: 30
};
function nodeHeight(n, cfg) {
  if (n.kind === "interface") return cfg.headH;
  const props = n.properties || [];
  const shown = Math.min(props.length, cfg.maxRows);
  const extra = props.length > cfg.maxRows ? cfg.rowH : 0;
  return cfg.headH + shown * cfg.rowH + extra + 8;
}
function layout(def, cfg, hints) {
  const nodes = def.nodes || [];
  const pos = {};
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  let maxX = 0;
  let maxY = 0;
  nodes.forEach((n, i) => {
    const gx = i % cols;
    const gy = Math.floor(i / cols);
    const h = nodeHeight(n, cfg);
    const def_x = cfg.pad + gx * cfg.colGap;
    const def_y = cfg.pad + gy * cfg.rowGap;
    const hint = hints ? hints[n.id] : void 0;
    const x = hint ? hint.x : def_x;
    const y = hint ? hint.y : def_y;
    pos[n.id] = { x, y, w: cfg.nodeW, h };
    maxX = Math.max(maxX, x + cfg.nodeW);
    maxY = Math.max(maxY, y + h);
  });
  return { pos, width: maxX + cfg.pad, height: maxY + cfg.pad };
}

// src/render/svg.ts
function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}
function propGlyph(p) {
  if (p.isPrimaryKey) return "\u25C7";
  if (p.isTitle) return "\u233E";
  return "\xB7";
}
function statusClass(n) {
  return `og-st-${n.status || "experimental"}`;
}
function objectCard(n, r, cfg, sel) {
  const color = n.color || "var(--og-node-bar)";
  const props = n.properties || [];
  const shown = props.slice(0, cfg.maxRows);
  const extra = props.length - shown.length;
  const rows = shown.map((p, i) => {
    const y = r.y + cfg.headH + i * cfg.rowH + cfg.rowH - 6;
    const glyph = propGlyph(p);
    const flags = (p.required ? '<tspan class="og-req">*</tspan>' : "") + (p.isIndexed ? ' <tspan class="og-idx">\u26A1</tspan>' : "");
    const sem = p.semanticType ? `<tspan class="og-sem"> ${esc(p.semanticType)}</tspan>` : "";
    const ty = p.baseType ? `<tspan class="og-ty">${esc(p.baseType)}</tspan>` : "";
    return `<text class="og-prow" x="${r.x + 14}" y="${y}"><tspan class="og-pg">${glyph}</tspan> ${esc(p.apiName)}${flags} ${ty}${sem}</text>`;
  }).join("");
  const more = extra > 0 ? `<text class="og-more" x="${r.x + 14}" y="${r.y + r.h - 8}">+${extra} more</text>` : "";
  const port = `<circle class="og-port" data-port="${esc(n.id)}" cx="${r.x + r.w}" cy="${r.y + cfg.headH / 2}" r="5"/>`;
  return `<g class="og-node og-object ${statusClass(n)} ${sel ? "sel" : ""}" data-node="${esc(n.id)}">
    <rect class="og-card" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>
    <rect class="og-bar" x="${r.x}" y="${r.y}" width="${r.w}" height="6" rx="3" fill="${esc(color)}"/>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 26}">${esc(n.displayName || n.id)}</text>
    <text class="og-api" x="${r.x + 14}" y="${r.y + 40}">${esc(n.id)}</text>
    <line class="og-hr" x1="${r.x}" y1="${r.y + cfg.headH}" x2="${r.x + r.w}" y2="${r.y + cfg.headH}"/>
    ${rows}${more}${port}
  </g>`;
}
function interfaceCard(n, r, sel) {
  return `<g class="og-node og-interface ${sel ? "sel" : ""}" data-node="${esc(n.id)}">
    <rect class="og-ifcard" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.h / 2}"/>
    <text class="og-iftag" x="${r.x + 14}" y="${r.y + 18}">\xABinterface\xBB</text>
    <text class="og-title" x="${r.x + 14}" y="${r.y + 36}">${esc(n.displayName || n.id)}</text>
  </g>`;
}
function edgePath(e, from, to, idx, sel) {
  const x1 = from.x + from.w;
  const y1 = from.y + 23;
  const x2 = to.x;
  const y2 = to.y + 23;
  const midX = (x1 + x2) / 2;
  const d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  if (e.isInterfaceLink) {
    return `<path class="og-edge og-iflink" d="${d}"/>`;
  }
  const cls = `og-edge og-link${sel ? " sel" : ""}`;
  const marker = e.cardinality === "manyToMany" ? "url(#og-many)" : e.cardinality === "oneToOne" ? "url(#og-one)" : "url(#og-many)";
  const label = e.displayName || e.apiName;
  const role = e.roleA ? ` \xB7 ${esc(e.roleA)}` : "";
  const lx = midX;
  const ly = (y1 + y2) / 2 - 6;
  return `<g data-edge="${esc(e.apiName)}">
    <path class="${cls} og-hit" d="${d}"/>
    <path class="${cls}" d="${d}" marker-end="${marker}"/>
    <text class="og-elabel" x="${lx}" y="${ly}" text-anchor="middle">${esc(label)}${role}</text>
  </g>`;
}
function renderSvg(def, lay, cfg, st) {
  const nodeById = new Map(def.nodes.map((n) => [n.id, n]));
  const edges = (def.edges || []).map((e, i) => {
    const from = lay.pos[e.source];
    const to = lay.pos[e.target];
    if (!from || !to) return "";
    return edgePath(e, from, to, i, st.selectedEdgeApiName === e.apiName);
  }).join("");
  const nodes = def.nodes.map((n) => {
    const r = lay.pos[n.id];
    if (!r) return "";
    const sel = st.selectedNodeId === n.id;
    return n.kind === "interface" ? interfaceCard(n, r, sel) : objectCard(n, r, cfg, sel);
  }).join("");
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
function graphCss() {
  return `
  :host{display:block}
  .og-canvas{position:relative;width:100%;height:100%;overflow:auto;background:var(--og-bg,#0b1020)}
  .og-svg{display:block;min-width:100%}
  .og-empty{padding:40px;text-align:center;color:var(--og-muted,#94a3b8);font-size:13px}
  /* \u5361\u7247 */
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
  /* \u63A5\u53E3 */
  .og-ifcard{fill:var(--og-iface,#1e1b3a);stroke:var(--og-accent2,#8b5cf6);stroke-dasharray:4 3;stroke-width:1.2}
  .og-iftag{fill:var(--og-accent2,#a78bfa);font-size:10px;font-style:italic}
  /* \u8FB9 */
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

// src/interaction/pointer.ts
var DRAG_THRESHOLD = 5;
var InteractionController = class {
  model;
  cb;
  mode = "idle";
  activeId = null;
  startX = 0;
  startY = 0;
  grabDX = 0;
  grabDY = 0;
  moved = false;
  pointerId = -1;
  constructor(model, cb) {
    this.model = model;
    this.cb = cb;
  }
  toSvgPoint(clientX, clientY) {
    const svg = this.cb.getSvg();
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const sx = vb && vb.width ? vb.width / rect.width : 1;
    const sy = vb && vb.height ? vb.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }
  onPointerDown(ev) {
    const target = ev.target;
    const portEl = target.closest("[data-port]");
    const nodeEl = target.closest("[data-node]");
    if (portEl) {
      this.mode = "connect";
      this.activeId = portEl.getAttribute("data-port");
      this.pointerId = ev.pointerId;
      this.safeCapture(ev);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (nodeEl) {
      const id = nodeEl.getAttribute("data-node");
      if (!id) return;
      this.mode = "drag";
      this.activeId = id;
      this.moved = false;
      this.pointerId = ev.pointerId;
      const pt = this.toSvgPoint(ev.clientX, ev.clientY);
      this.startX = pt.x;
      this.startY = pt.y;
      const pos = this.cb.getLayout().pos[id];
      this.grabDX = pos ? pt.x - pos.x : 0;
      this.grabDY = pos ? pt.y - pos.y : 0;
      this.safeCapture(ev);
      ev.preventDefault();
    }
  }
  safeCapture(ev) {
    try {
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    } catch {
    }
  }
  onPointerMove(ev) {
    if (this.mode === "idle" || ev.pointerId !== this.pointerId) return;
    const pt = this.toSvgPoint(ev.clientX, ev.clientY);
    if (this.mode === "drag" && this.activeId) {
      const dx = pt.x - this.startX;
      const dy = pt.y - this.startY;
      if (!this.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      this.moved = true;
      this.cb.onNodeDrag(this.activeId, Math.max(0, pt.x - this.grabDX), Math.max(0, pt.y - this.grabDY));
    } else if (this.mode === "connect" && this.activeId) {
      const pos = this.cb.getLayout().pos[this.activeId];
      const from = pos ? { x: pos.x + pos.w, y: pos.y + 23 } : null;
      this.cb.onRubber(from, { x: pt.x, y: pt.y });
    }
  }
  onPointerUp(ev) {
    if (this.mode === "idle" || ev.pointerId !== this.pointerId) return;
    if (this.mode === "drag" && this.activeId) {
      const pt = this.toSvgPoint(ev.clientX, ev.clientY);
      const moved = Math.abs(pt.x - this.startX) + Math.abs(pt.y - this.startY) >= DRAG_THRESHOLD;
      if (moved && this.moved) this.cb.onNodeDragEnd(this.activeId);
      else this.cb.onNodeSelect(this.activeId);
    } else if (this.mode === "connect" && this.activeId) {
      const pt = this.toSvgPoint(ev.clientX, ev.clientY);
      const tgt = this.hitNode(pt.x, pt.y);
      this.cb.onRubber(null, null);
      if (tgt) this.cb.onConnect(this.activeId, tgt);
    }
    this.reset(ev);
  }
  hitNode(x, y) {
    const pos = this.cb.getLayout().pos;
    for (const n of this.model.nodes) {
      const p = pos[n.id];
      if (p && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return n.id;
    }
    return null;
  }
  onPointerCancel(ev) {
    this.cb.onRubber(null, null);
    this.reset(ev);
  }
  reset(ev) {
    try {
      ev.currentTarget?.releasePointerCapture?.(this.pointerId);
    } catch {
    }
    this.mode = "idle";
    this.activeId = null;
    this.moved = false;
    this.pointerId = -1;
  }
};

// src/element/cmx-ontology-graph.ts
var CmxOntologyGraph = class extends HTMLElement {
  static get observedAttributes() {
    return ["data-spec", "readonly"];
  }
  root;
  model = new OntologyModel();
  selectedNodeId = null;
  selectedEdgeApiName = null;
  rubber = { from: null, to: null };
  interaction;
  _readonly = false;
  _bootstrapped = false;
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.interaction = new InteractionController(this.model, {
      getLayout: () => this.currentLayout(),
      getSvg: () => this.root.querySelector("svg"),
      onNodeDrag: (id, x, y) => {
        this.model.setLayoutHint(id, x, y);
        this.paint();
      },
      onNodeDragEnd: (id) => {
        this.emit("spec-change", { spec: this.model.getDef() });
        void id;
      },
      onNodeSelect: (id) => this.selectNode(id),
      onRubber: (from, to) => {
        this.rubber = { from, to };
        this.paint();
      },
      onConnect: (src, tgt) => this.requestConnect(src, tgt)
    });
  }
  connectedCallback() {
    if (this._readonly !== this.hasAttribute("readonly")) this._readonly = this.hasAttribute("readonly");
    if (!this._bootstrapped) {
      this._bootstrapped = true;
      const raw = this.getAttribute("data-spec");
      if (raw) {
        try {
          this.model.setDef(JSON.parse(raw));
        } catch {
        }
      }
    }
    this.render();
  }
  attributeChangedCallback(name, _old, value) {
    if (name === "readonly") {
      this._readonly = value != null;
      if (this.isConnected) this.render();
    } else if (name === "data-spec" && value != null && this._bootstrapped) {
      try {
        this.model.setDef(JSON.parse(value));
        this.render();
      } catch {
      }
    }
  }
  // ── 公共 API ──
  setSpec(def) {
    this.model.setDef(def);
    this.selectedNodeId = null;
    this.selectedEdgeApiName = null;
    if (this.isConnected) this.render();
  }
  getSpec() {
    return this.model.getDef();
  }
  getModel() {
    return this.model;
  }
  validate() {
    return this.model.validate();
  }
  /** 加对象类型（宿主命名后调）。返回 apiName 或 null（重名）。 */
  addObjectType(apiName, displayName) {
    const id = this.model.addObjectType(apiName, displayName);
    if (id) {
      this.render();
      this.selectNode(id);
      this.emit("spec-change", { spec: this.model.getDef() });
      this.emit("node-add", { nodeId: id, kind: "object" });
    }
    return id;
  }
  addInterface(apiName, displayName) {
    const id = this.model.addInterface(apiName, displayName);
    if (id) {
      this.render();
      this.selectNode(id);
      this.emit("spec-change", { spec: this.model.getDef() });
      this.emit("node-add", { nodeId: id, kind: "interface" });
    }
    return id;
  }
  /** 加关系边（宿主速建气泡确认后调）。返回 null 成功或拒绝原因。 */
  addLink(apiName, src, tgt, card, roleA, roleB) {
    const err = this.model.addLink(apiName, src, tgt, card, roleA, roleB);
    if (err) {
      this.emit("connect-rejected", { src, tgt, reason: err });
      return err;
    }
    this.render();
    this.emit("spec-change", { spec: this.model.getDef() });
    this.emit("link-added", { apiName, source: src, target: tgt });
    return null;
  }
  delNode(id) {
    this.model.delNode(id);
    if (this.selectedNodeId === id) this.selectedNodeId = null;
    this.render();
    this.emit("spec-change", { spec: this.model.getDef() });
    this.emit("node-del", { nodeId: id });
  }
  delLink(apiName) {
    this.model.delLink(apiName);
    if (this.selectedEdgeApiName === apiName) this.selectedEdgeApiName = null;
    this.render();
    this.emit("spec-change", { spec: this.model.getDef() });
  }
  autoLayout() {
    this.model.clearLayoutHints();
    this.render();
    this.emit("spec-change", { spec: this.model.getDef() });
  }
  selectNode(id) {
    this.selectedNodeId = id;
    this.selectedEdgeApiName = null;
    this.paint();
    const n = this.model.node(id);
    this.emit("type-select", { nodeId: id, node: n ? JSON.parse(JSON.stringify(n)) : null });
  }
  /** 供宿主编辑节点后回写模型并重画。 */
  refresh() {
    this.render();
  }
  // ── 内部 ──
  cfg() {
    return this._readonly ? PREVIEW_LAYOUT : DEFAULT_LAYOUT;
  }
  currentLayout() {
    return layout(this.model.getDef(), this.cfg(), this.model.layoutHints());
  }
  /** 拉线落点 → 请求宿主补关系元数据（不直接建，交速建气泡）。 */
  requestConnect(src, tgt) {
    this.rubber = { from: null, to: null };
    this.paint();
    this.emit("link-add", { source: src, target: tgt });
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  renderState() {
    return {
      selectedNodeId: this.selectedNodeId,
      selectedEdgeApiName: this.selectedEdgeApiName,
      readonly: this._readonly,
      maxRows: this.cfg().maxRows
    };
  }
  render() {
    const lay = this.currentLayout();
    const svg = this.model.nodes.length ? renderSvg(this.model.getDef(), lay, this.cfg(), this.renderState()) : '<div class="og-empty">\u7A7A\u672C\u4F53 \xB7 \u53CC\u51FB\u753B\u5E03\u6216\u70B9\u300C+ \u5BF9\u8C61\u7C7B\u578B\u300D\u5F00\u59CB</div>';
    this.root.innerHTML = `<style>${graphCss()}</style><div class="og-canvas" part="canvas">${svg}</div>`;
    if (this._readonly) this.bindReadonlySelect();
    else this.bindInteractions();
  }
  paint() {
    const canvas = this.root.querySelector(".og-canvas");
    if (!canvas) {
      this.render();
      return;
    }
    const lay = this.currentLayout();
    let svg = this.model.nodes.length ? renderSvg(this.model.getDef(), lay, this.cfg(), this.renderState()) : '<div class="og-empty">\u7A7A\u672C\u4F53</div>';
    if (this.rubber.from && this.rubber.to) {
      const r = `<path class="og-rubber" d="M${this.rubber.from.x},${this.rubber.from.y} L${this.rubber.to.x},${this.rubber.to.y}"/>`;
      svg = svg.replace("</svg>", r + "</svg>");
    }
    canvas.innerHTML = svg;
  }
  bindInteractions() {
    const canvas = this.root.querySelector(".og-canvas");
    if (!canvas || canvas.__ogBound) return;
    canvas.__ogBound = true;
    canvas.addEventListener("pointerdown", (e) => this.interaction.onPointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.interaction.onPointerMove(e));
    canvas.addEventListener("pointerup", (e) => this.interaction.onPointerUp(e));
    canvas.addEventListener("pointercancel", (e) => this.interaction.onPointerCancel(e));
    canvas.addEventListener("click", (e) => {
      const el = e.target.closest("[data-edge]");
      if (el) {
        this.selectedEdgeApiName = el.getAttribute("data-edge");
        this.selectedNodeId = null;
        this.paint();
        const e2 = this.model.edges.find((x) => x.apiName === this.selectedEdgeApiName);
        this.emit("edge-select", { apiName: this.selectedEdgeApiName, edge: e2 ? JSON.parse(JSON.stringify(e2)) : null });
      }
    });
  }
  bindReadonlySelect() {
    const canvas = this.root.querySelector(".og-canvas");
    if (!canvas || canvas.__ogRoBound) return;
    canvas.__ogRoBound = true;
    canvas.addEventListener("click", (e) => {
      const edgeEl = e.target.closest("[data-edge]");
      if (edgeEl) {
        this.selectedEdgeApiName = edgeEl.getAttribute("data-edge");
        this.selectedNodeId = null;
        this.paint();
        return;
      }
      const nodeEl = e.target.closest("[data-node]");
      if (nodeEl) {
        const id = nodeEl.getAttribute("data-node");
        if (id) this.selectNode(id);
      }
    });
  }
};
function defineOntologyGraph() {
  if (typeof customElements !== "undefined" && !customElements.get("cmx-ontology-graph")) {
    customElements.define("cmx-ontology-graph", CmxOntologyGraph);
  }
}

// src/index.ts
var VERSION = "1.0.0";
defineOntologyGraph();
export {
  CARDINALITY_LABEL,
  CmxOntologyGraph,
  DEFAULT_LAYOUT,
  OntologyModel,
  PREVIEW_LAYOUT,
  STATUS_LABEL,
  VERSION,
  defineOntologyGraph,
  graphCss,
  layout,
  nodeHeight,
  renderSvg
};
