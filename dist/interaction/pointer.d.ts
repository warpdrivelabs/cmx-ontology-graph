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
    onRubber(from: {
        x: number;
        y: number;
    } | null, to: {
        x: number;
        y: number;
    } | null): void;
    /** 连线拖拽中，光标下（阈值内）最近的锚点 → 供宿主高亮；无则 null。 */
    onHotPort(port: PortRef | null): void;
    onConnect(src: PortRef, tgt: PortRef): void;
    /** 拖拽某关系边的内部线段 → 实时更新该边的手动布线折点（含锚点）。 */
    onSegmentDrag(apiName: string, points: Array<{
        x: number;
        y: number;
    }>): void;
    /** 内部线段拖拽结束（提交/派 spec-change）。 */
    onSegmentDragEnd(apiName: string): void;
}
export declare class InteractionController {
    private model;
    private cb;
    private mode;
    private activeId;
    private activeProp;
    private activeSide;
    private connectStart;
    private segEdge;
    private segI;
    private segOrient;
    private segRoute;
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
    /** 吸附到最近的锚点（阈值内）；exclude 排除自身锚点（高亮时用）。返回 {node,prop,side} 或 null。 */
    private hitPort;
    onPointerCancel(ev: PointerEvent): void;
    private reset;
}
//# sourceMappingURL=pointer.d.ts.map