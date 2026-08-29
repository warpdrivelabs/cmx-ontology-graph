/**
 * 指针交互控制器（本体图）—— 拖拽节点 + 从连接点拉线建关系。与 @cmx/decision-graph 的 pointer 同构，
 * 仅模型类型改为 OntologyModel（`.nodes` 形状一致：{id,...}）。控制器只算坐标 + 判定，动作经回调交回元素。
 */
import type { OntologyModel } from '../model/OntologyModel.js';
import type { LayoutResult } from '../model/types.js';
export interface InteractionCallbacks {
    getLayout(): LayoutResult;
    getSvg(): SVGSVGElement | null;
    onNodeDrag(id: string, x: number, y: number): void;
    onNodeDragEnd(id: string): void;
    onNodeSelect(id: string): void;
    onRubber(from: {
        x: number;
        y: number;
    } | null, to: {
        x: number;
        y: number;
    } | null): void;
    onConnect(src: string, tgt: string): void;
}
export declare class InteractionController {
    private model;
    private cb;
    private mode;
    private activeId;
    private startX;
    private startY;
    private grabDX;
    private grabDY;
    private moved;
    private pointerId;
    constructor(model: OntologyModel, cb: InteractionCallbacks);
    private toSvgPoint;
    onPointerDown(ev: PointerEvent): void;
    private safeCapture;
    onPointerMove(ev: PointerEvent): void;
    onPointerUp(ev: PointerEvent): void;
    private hitNode;
    onPointerCancel(ev: PointerEvent): void;
    private reset;
}
//# sourceMappingURL=pointer.d.ts.map