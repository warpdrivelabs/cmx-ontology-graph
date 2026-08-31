/**
 * 指针交互控制器（本体图）—— 拖拽节点 + 从连接点拉线建关系。与 @cmx/decision-graph 的 pointer 同构，
 * 仅模型类型改为 OntologyModel（`.nodes` 形状一致：{id,...}）。控制器只算坐标 + 判定，动作经回调交回元素。
 */

import type { OntologyModel } from '../model/OntologyModel.js';
import type { LayoutResult } from '../model/types.js';

/** 连接端点引用：节点 + （可选）属性 apiName + 边框侧（L/R）。 */
export interface PortRef {
  node: string;
  prop: string | null;
  side: string | null;
}

export interface InteractionCallbacks {
  getLayout(): LayoutResult;
  getSvg(): SVGSVGElement | null;
  onNodeDrag(id: string, x: number, y: number): void;
  onNodeDragEnd(id: string): void;
  onNodeSelect(id: string): void;
  onRubber(from: { x: number; y: number } | null, to: { x: number; y: number } | null): void;
  /** 连线拖拽中，光标下（阈值内）最近的锚点 → 供宿主高亮；无则 null。 */
  onHotPort(port: PortRef | null): void;
  onConnect(src: PortRef, tgt: PortRef): void;
  /** 拖拽某关系边的内部线段 → 实时更新该边的手动布线折点（含锚点）。 */
  onSegmentDrag(apiName: string, points: Array<{ x: number; y: number }>): void;
  /** 内部线段拖拽结束（提交/派 spec-change）。 */
  onSegmentDragEnd(apiName: string): void;
}

type Mode = 'idle' | 'drag' | 'connect' | 'segdrag';
const DRAG_THRESHOLD = 5;

export class InteractionController {
  private model: OntologyModel;
  private cb: InteractionCallbacks;
  private mode: Mode = 'idle';
  private activeId: string | null = null;
  private activeProp: string | null = null;
  private activeSide: string | null = null;
  private connectStart = { x: 0, y: 0 };
  private segEdge: string | null = null;
  private segI = 0;
  private segOrient = '';
  private segRoute: Array<{ x: number; y: number }> = [];
  private startX = 0;
  private startY = 0;
  private grabDX = 0;
  private grabDY = 0;
  private moved = false;
  private pointerId = -1;

  constructor(model: OntologyModel, cb: InteractionCallbacks) {
    this.model = model;
    this.cb = cb;
  }

  private toSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.cb.getSvg();
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const sx = vb && vb.width ? vb.width / rect.width : 1;
    const sy = vb && vb.height ? vb.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  onPointerDown(ev: PointerEvent): void {
    const target = ev.target as Element;
    // 边内部线段拖拽（两端非锚点）：优先于端口/节点。
    const segEl = target.closest('[data-edge-seg]');
    if (segEl) {
      const grp = segEl.closest('[data-edge]');
      const routeStr = grp ? grp.getAttribute('data-route') : null;
      const route = routeStr
        ? routeStr
            .trim()
            .split(/\s+/)
            .map((s) => {
              const c = s.split(',');
              return { x: Number(c[0] ?? 0), y: Number(c[1] ?? 0) };
            })
        : [];
      if (route.length >= 4) {
        this.mode = 'segdrag';
        this.segEdge = segEl.getAttribute('data-edge-seg');
        this.segI = parseInt(segEl.getAttribute('data-seg-i') || '0', 10);
        this.segOrient = segEl.getAttribute('data-orient') || '';
        this.segRoute = route;
        this.moved = false;
        const pt = this.toSvgPoint(ev.clientX, ev.clientY);
        this.startX = pt.x;
        this.startY = pt.y;
        this.pointerId = ev.pointerId;
        this.safeCapture(ev);
        ev.preventDefault();
        return;
      }
    }
    const portEl = target.closest('[data-port]');
    const nodeEl = target.closest('[data-node]');
    if (portEl) {
      this.mode = 'connect';
      this.activeId = portEl.getAttribute('data-port');
      this.activeProp = portEl.getAttribute('data-prop');
      this.activeSide = portEl.getAttribute('data-side');
      this.connectStart = {
        x: parseFloat(portEl.getAttribute('cx') || '0'),
        y: parseFloat(portEl.getAttribute('cy') || '0'),
      };
      this.pointerId = ev.pointerId;
      this.safeCapture(ev);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-node');
      if (!id) return;
      this.mode = 'drag';
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

  private safeCapture(ev: PointerEvent): void {
    try {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* 合成事件无活跃指针 */
    }
  }

  onPointerMove(ev: PointerEvent): void {
    if (this.mode === 'idle' || ev.pointerId !== this.pointerId) return;
    const pt = this.toSvgPoint(ev.clientX, ev.clientY);
    if (this.mode === 'drag' && this.activeId) {
      const dx = pt.x - this.startX;
      const dy = pt.y - this.startY;
      if (!this.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      this.moved = true;
      this.cb.onNodeDrag(this.activeId, Math.max(0, pt.x - this.grabDX), Math.max(0, pt.y - this.grabDY));
    } else if (this.mode === 'connect' && this.activeId) {
      this.cb.onHotPort(this.hitPort(pt.x, pt.y, { node: this.activeId, prop: this.activeProp, side: this.activeSide }));
      this.cb.onRubber(this.connectStart, { x: pt.x, y: pt.y });
    } else if (this.mode === 'segdrag' && this.segEdge) {
      const dx = pt.x - this.startX;
      const dy = pt.y - this.startY;
      if (!this.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      this.moved = true;
      const route = this.segRoute.map((p) => ({ x: p.x, y: p.y }));
      const a = route[this.segI];
      const b = route[this.segI + 1];
      const oa = this.segRoute[this.segI];
      const ob = this.segRoute[this.segI + 1];
      if (a && b && oa && ob) {
        // 水平段整体上下移（改 y）；垂直段整体左右移（改 x）。相邻垂直/水平段随之保持正交。
        if (this.segOrient === 'H') {
          a.y = oa.y + dy;
          b.y = ob.y + dy;
        } else {
          a.x = oa.x + dx;
          b.x = ob.x + dx;
        }
      }
      this.cb.onSegmentDrag(this.segEdge, route);
    }
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.mode === 'idle' || ev.pointerId !== this.pointerId) return;
    if (this.mode === 'drag' && this.activeId) {
      const pt = this.toSvgPoint(ev.clientX, ev.clientY);
      const moved = Math.abs(pt.x - this.startX) + Math.abs(pt.y - this.startY) >= DRAG_THRESHOLD;
      if (moved && this.moved) this.cb.onNodeDragEnd(this.activeId);
      else this.cb.onNodeSelect(this.activeId);
    } else if (this.mode === 'connect' && this.activeId) {
      const pt = this.toSvgPoint(ev.clientX, ev.clientY);
      this.cb.onRubber(null, null);
      // 仅当松开在某个锚点上（阈值内）才建关系；否则取消、不弹气泡。允许自关联（拖回自身锚点）。
      const tp = this.hitPort(pt.x, pt.y);
      if (tp) {
        const src: PortRef = { node: this.activeId, prop: this.activeProp, side: this.activeSide };
        this.cb.onConnect(src, tp);
      }
    } else if (this.mode === 'segdrag' && this.segEdge) {
      if (this.moved) this.cb.onSegmentDragEnd(this.segEdge);
    }
    this.reset(ev);
  }

  /** 吸附到最近的锚点（阈值内）；exclude 排除自身锚点（高亮时用）。返回 {node,prop,side} 或 null。 */
  private hitPort(x: number, y: number, exclude?: PortRef | null): PortRef | null {
    const svg = this.cb.getSvg();
    if (!svg) return null;
    let best: PortRef | null = null;
    let bestD = 26; // 吸附阈值（略大于半行高，便于对准属性行）
    svg.querySelectorAll('[data-port]').forEach((el) => {
      const cx = parseFloat(el.getAttribute('cx') || 'NaN');
      const cy = parseFloat(el.getAttribute('cy') || 'NaN');
      if (Number.isNaN(cx) || Number.isNaN(cy)) return;
      const node = el.getAttribute('data-port') || '';
      const prop = el.getAttribute('data-prop');
      const side = el.getAttribute('data-side');
      if (exclude && exclude.node === node && (exclude.prop || null) === (prop || null) && exclude.side === side) return;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestD) {
        bestD = d;
        best = { node, prop, side };
      }
    });
    return best;
  }

  onPointerCancel(ev: PointerEvent): void {
    this.cb.onRubber(null, null);
    this.reset(ev);
  }

  private reset(ev: PointerEvent): void {
    try {
      (ev.currentTarget as Element)?.releasePointerCapture?.(this.pointerId);
    } catch {
      /* */
    }
    this.mode = 'idle';
    this.activeId = null;
    this.activeProp = null;
    this.activeSide = null;
    this.segEdge = null;
    this.moved = false;
    this.pointerId = -1;
  }
}
