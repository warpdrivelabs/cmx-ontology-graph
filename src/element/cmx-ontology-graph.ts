/**
 * <cmx-ontology-graph> —— 本体图（Object/Link ER 图）可视化编辑自定义元素（shadow DOM，零框架，vanilla）。
 * 与 <cmx-decision-graph> 平级；对标 <cmx-megasheet>：属性传数据 + 命令式方法 + CustomEvent 出 + getModel() 逃生舱。
 *
 * 数据入：属性 data-spec='<json>' 或 setSpec(def)。
 * 配置：属性 readonly（只读预览）。
 * 事件出（bubbles+composed）：spec-change / type-select / edge-select / link-add / node-add / node-del。
 *   - type-select：选中对象类型/接口节点 → 宿主在 property 区渲强类型 Inspector（属性表格等）。
 *   - link-add：拉线落到目标 → 宿主弹「关系速建气泡」补 apiName/基数/角色，再 addLink 回写。
 * 逃生舱：getModel() 返 OntologyModel；getSpec() 返当前 def；autoLayout()/selectNode(id)。
 *
 * 属性/关系的强类型编辑**不在组件内**——组件只画图 + 拖拽/连线 + 选中，领域逻辑交宿主 Inspector。
 */

import { OntologyModel } from '../model/OntologyModel.js';
import type { Cardinality, OntologyGraphDef } from '../model/types.js';
import { DEFAULT_LAYOUT, PREVIEW_LAYOUT, layout as computeLayout } from '../layout/layout.js';
import type { LayoutConfig } from '../layout/layout.js';
import { graphCss, renderSvg, type RenderState } from '../render/svg.js';
import { InteractionController } from '../interaction/pointer.js';

export class CmxOntologyGraph extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['data-spec', 'readonly'];
  }

  private root: ShadowRoot;
  private model = new OntologyModel();
  private selectedNodeId: string | null = null;
  private selectedEdgeApiName: string | null = null;
  private rubber: { from: { x: number; y: number } | null; to: { x: number; y: number } | null } = { from: null, to: null };
  private interaction: InteractionController;
  private _readonly = false;
  private _bootstrapped = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.interaction = new InteractionController(this.model, {
      getLayout: () => this.currentLayout(),
      getSvg: () => this.root.querySelector('svg'),
      onNodeDrag: (id, x, y) => {
        this.model.setLayoutHint(id, x, y);
        this.paint();
      },
      onNodeDragEnd: (id) => {
        this.emit('spec-change', { spec: this.model.getDef() });
        void id;
      },
      onNodeSelect: (id) => this.selectNode(id),
      onRubber: (from, to) => {
        this.rubber = { from, to };
        this.paint();
      },
      onConnect: (src, tgt) => this.requestConnect(src, tgt),
    });
  }

  connectedCallback(): void {
    if (this._readonly !== this.hasAttribute('readonly')) this._readonly = this.hasAttribute('readonly');
    if (!this._bootstrapped) {
      this._bootstrapped = true;
      const raw = this.getAttribute('data-spec');
      if (raw) {
        try {
          this.model.setDef(JSON.parse(raw) as OntologyGraphDef);
        } catch {
          /* 非法 JSON 忽略，用空骨架 */
        }
      }
    }
    this.render();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'readonly') {
      this._readonly = value != null;
      if (this.isConnected) this.render();
    } else if (name === 'data-spec' && value != null && this._bootstrapped) {
      try {
        this.model.setDef(JSON.parse(value) as OntologyGraphDef);
        this.render();
      } catch {
        /* */
      }
    }
  }

  // ── 公共 API ──
  setSpec(def: OntologyGraphDef): void {
    this.model.setDef(def);
    this.selectedNodeId = null;
    this.selectedEdgeApiName = null;
    if (this.isConnected) this.render();
  }
  getSpec(): OntologyGraphDef {
    return this.model.getDef();
  }
  getModel(): OntologyModel {
    return this.model;
  }
  validate(): string | null {
    return this.model.validate();
  }
  /** 加对象类型（宿主命名后调）。返回 apiName 或 null（重名）。 */
  addObjectType(apiName: string, displayName?: string): string | null {
    const id = this.model.addObjectType(apiName, displayName);
    if (id) {
      this.render();
      this.selectNode(id);
      this.emit('spec-change', { spec: this.model.getDef() });
      this.emit('node-add', { nodeId: id, kind: 'object' });
    }
    return id;
  }
  addInterface(apiName: string, displayName?: string): string | null {
    const id = this.model.addInterface(apiName, displayName);
    if (id) {
      this.render();
      this.selectNode(id);
      this.emit('spec-change', { spec: this.model.getDef() });
      this.emit('node-add', { nodeId: id, kind: 'interface' });
    }
    return id;
  }
  /** 加关系边（宿主速建气泡确认后调）。返回 null 成功或拒绝原因。 */
  addLink(apiName: string, src: string, tgt: string, card: Cardinality, roleA?: string, roleB?: string): string | null {
    const err = this.model.addLink(apiName, src, tgt, card, roleA, roleB);
    if (err) {
      this.emit('connect-rejected', { src, tgt, reason: err });
      return err;
    }
    this.render();
    this.emit('spec-change', { spec: this.model.getDef() });
    this.emit('link-added', { apiName, source: src, target: tgt });
    return null;
  }
  delNode(id: string): void {
    this.model.delNode(id);
    if (this.selectedNodeId === id) this.selectedNodeId = null;
    this.render();
    this.emit('spec-change', { spec: this.model.getDef() });
    this.emit('node-del', { nodeId: id });
  }
  delLink(apiName: string): void {
    this.model.delLink(apiName);
    if (this.selectedEdgeApiName === apiName) this.selectedEdgeApiName = null;
    this.render();
    this.emit('spec-change', { spec: this.model.getDef() });
  }
  autoLayout(): void {
    this.model.clearLayoutHints();
    this.render();
    this.emit('spec-change', { spec: this.model.getDef() });
  }
  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.selectedEdgeApiName = null;
    this.paint();
    const n = this.model.node(id);
    this.emit('type-select', { nodeId: id, node: n ? JSON.parse(JSON.stringify(n)) : null });
  }
  /** 供宿主编辑节点后回写模型并重画。 */
  refresh(): void {
    this.render();
  }

  // ── 内部 ──
  private cfg(): LayoutConfig {
    return this._readonly ? PREVIEW_LAYOUT : DEFAULT_LAYOUT;
  }
  private currentLayout() {
    return computeLayout(this.model.getDef(), this.cfg(), this.model.layoutHints());
  }
  /** 拉线落点 → 请求宿主补关系元数据（不直接建，交速建气泡）。 */
  private requestConnect(src: string, tgt: string): void {
    this.rubber = { from: null, to: null };
    this.paint();
    this.emit('link-add', { source: src, target: tgt });
  }

  private emit(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private renderState(): RenderState {
    return {
      selectedNodeId: this.selectedNodeId,
      selectedEdgeApiName: this.selectedEdgeApiName,
      readonly: this._readonly,
      maxRows: this.cfg().maxRows,
    };
  }

  private render(): void {
    const lay = this.currentLayout();
    const svg = this.model.nodes.length
      ? renderSvg(this.model.getDef(), lay, this.cfg(), this.renderState())
      : '<div class="og-empty">空本体 · 双击画布或点「+ 对象类型」开始</div>';
    this.root.innerHTML = `<style>${graphCss()}</style><div class="og-canvas" part="canvas">${svg}</div>`;
    if (this._readonly) this.bindReadonlySelect();
    else this.bindInteractions();
  }

  private paint(): void {
    const canvas = this.root.querySelector('.og-canvas');
    if (!canvas) {
      this.render();
      return;
    }
    const lay = this.currentLayout();
    let svg = this.model.nodes.length
      ? renderSvg(this.model.getDef(), lay, this.cfg(), this.renderState())
      : '<div class="og-empty">空本体</div>';
    if (this.rubber.from && this.rubber.to) {
      const r = `<path class="og-rubber" d="M${this.rubber.from.x},${this.rubber.from.y} L${this.rubber.to.x},${this.rubber.to.y}"/>`;
      svg = svg.replace('</svg>', r + '</svg>');
    }
    canvas.innerHTML = svg;
  }

  private bindInteractions(): void {
    const canvas = this.root.querySelector('.og-canvas') as HTMLElement | null;
    if (!canvas || (canvas as unknown as { __ogBound?: boolean }).__ogBound) return;
    (canvas as unknown as { __ogBound?: boolean }).__ogBound = true;
    canvas.addEventListener('pointerdown', (e) => this.interaction.onPointerDown(e as PointerEvent));
    canvas.addEventListener('pointermove', (e) => this.interaction.onPointerMove(e as PointerEvent));
    canvas.addEventListener('pointerup', (e) => this.interaction.onPointerUp(e as PointerEvent));
    canvas.addEventListener('pointercancel', (e) => this.interaction.onPointerCancel(e as PointerEvent));
    canvas.addEventListener('click', (e) => {
      const el = (e.target as Element).closest('[data-edge]');
      if (el) {
        this.selectedEdgeApiName = el.getAttribute('data-edge');
        this.selectedNodeId = null;
        this.paint();
        const e2 = this.model.edges.find((x) => x.apiName === this.selectedEdgeApiName);
        this.emit('edge-select', { apiName: this.selectedEdgeApiName, edge: e2 ? JSON.parse(JSON.stringify(e2)) : null });
      }
    });
  }

  private bindReadonlySelect(): void {
    const canvas = this.root.querySelector('.og-canvas') as HTMLElement | null;
    if (!canvas || (canvas as unknown as { __ogRoBound?: boolean }).__ogRoBound) return;
    (canvas as unknown as { __ogRoBound?: boolean }).__ogRoBound = true;
    canvas.addEventListener('click', (e) => {
      const edgeEl = (e.target as Element).closest('[data-edge]');
      if (edgeEl) {
        this.selectedEdgeApiName = edgeEl.getAttribute('data-edge');
        this.selectedNodeId = null;
        this.paint();
        return;
      }
      const nodeEl = (e.target as Element).closest('[data-node]');
      if (nodeEl) {
        const id = nodeEl.getAttribute('data-node');
        if (id) this.selectNode(id);
      }
    });
  }
}

/** 幂等注册。 */
export function defineOntologyGraph(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('cmx-ontology-graph')) {
    customElements.define('cmx-ontology-graph', CmxOntologyGraph);
  }
}
