/**
 * 指针交互控制器（本体图）—— 拖拽节点 + 从连接点拉线建关系。与 @cmx/decision-graph 的 pointer 同构，
 * 仅模型类型改为 OntologyModel（`.nodes` 形状一致：{id,...}）。控制器只算坐标 + 判定，动作经回调交回元素。
 */
const DRAG_THRESHOLD = 5;
export class InteractionController {
    model;
    cb;
    mode = 'idle';
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
        if (!svg)
            return { x: clientX, y: clientY };
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const sx = vb && vb.width ? vb.width / rect.width : 1;
        const sy = vb && vb.height ? vb.height / rect.height : 1;
        return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
    }
    onPointerDown(ev) {
        const target = ev.target;
        const portEl = target.closest('[data-port]');
        const nodeEl = target.closest('[data-node]');
        if (portEl) {
            this.mode = 'connect';
            this.activeId = portEl.getAttribute('data-port');
            this.pointerId = ev.pointerId;
            this.safeCapture(ev);
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        if (nodeEl) {
            const id = nodeEl.getAttribute('data-node');
            if (!id)
                return;
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
    safeCapture(ev) {
        try {
            ev.currentTarget.setPointerCapture?.(ev.pointerId);
        }
        catch {
            /* 合成事件无活跃指针 */
        }
    }
    onPointerMove(ev) {
        if (this.mode === 'idle' || ev.pointerId !== this.pointerId)
            return;
        const pt = this.toSvgPoint(ev.clientX, ev.clientY);
        if (this.mode === 'drag' && this.activeId) {
            const dx = pt.x - this.startX;
            const dy = pt.y - this.startY;
            if (!this.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD)
                return;
            this.moved = true;
            this.cb.onNodeDrag(this.activeId, Math.max(0, pt.x - this.grabDX), Math.max(0, pt.y - this.grabDY));
        }
        else if (this.mode === 'connect' && this.activeId) {
            const pos = this.cb.getLayout().pos[this.activeId];
            const from = pos ? { x: pos.x + pos.w, y: pos.y + 23 } : null;
            this.cb.onRubber(from, { x: pt.x, y: pt.y });
        }
    }
    onPointerUp(ev) {
        if (this.mode === 'idle' || ev.pointerId !== this.pointerId)
            return;
        if (this.mode === 'drag' && this.activeId) {
            const pt = this.toSvgPoint(ev.clientX, ev.clientY);
            const moved = Math.abs(pt.x - this.startX) + Math.abs(pt.y - this.startY) >= DRAG_THRESHOLD;
            if (moved && this.moved)
                this.cb.onNodeDragEnd(this.activeId);
            else
                this.cb.onNodeSelect(this.activeId);
        }
        else if (this.mode === 'connect' && this.activeId) {
            const pt = this.toSvgPoint(ev.clientX, ev.clientY);
            const tgt = this.hitNode(pt.x, pt.y);
            this.cb.onRubber(null, null);
            // 允许自关联（拖回自身 = 层级关系，如组织树/BOM）；宿主速建气泡区分处理。
            if (tgt)
                this.cb.onConnect(this.activeId, tgt);
        }
        this.reset(ev);
    }
    hitNode(x, y) {
        const pos = this.cb.getLayout().pos;
        for (const n of this.model.nodes) {
            const p = pos[n.id];
            if (p && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)
                return n.id;
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
        }
        catch {
            /* */
        }
        this.mode = 'idle';
        this.activeId = null;
        this.moved = false;
        this.pointerId = -1;
    }
}
//# sourceMappingURL=pointer.js.map