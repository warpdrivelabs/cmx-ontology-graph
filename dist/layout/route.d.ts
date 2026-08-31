/**
 * 正交连线布线（避让遮挡）—— 纯函数、无 DOM、可单测。
 *
 * 修复两点：
 * 1) **锚点浮动**：按两节点中心连线的主轴选「朝向侧」，锚在该侧中点 —— 拖动节点时端点始终贴合朝向侧，
 *    不再固定在右/左缘 y+23 而「离开锚点」。
 * 2) **避让遮挡**：A* 在「有趣坐标线」网格上求最短正交路径，绕开其余节点卡片（障碍膨胀留白 + 转弯惩罚）。
 *    起终点各先法向伸出一段 stub 再拐弯；两端节点自身计入障碍，避免连线穿过端点卡片。
 * 兜底：A* 无解时走中线正交折线（不避让但正交、稳定）。
 */
import type { NodeRect } from '../model/types.js';
export interface Pt {
    x: number;
    y: number;
}
export type Side = 'L' | 'R' | 'T' | 'B';
/** 选朝向侧（按中心连线主轴）。导出供单测。 */
export declare function chooseSides(a: NodeRect, b: NodeRect): {
    sa: Side;
    sb: Side;
};
/** 已知两端锚点与朝向侧的正交避让布线核心（属性级锚点复用此）。others = 除两端外其余节点盒。 */
export declare function routeAnchored(pa: Pt, sa: Side, pb: Pt, sb: Side, endA: NodeRect, endB: NodeRect, others: NodeRect[]): Pt[];
/** 布线主入口（节点级：几何朝向侧中点）。others = 除两端外的其余节点盒。 */
export declare function routeEdge(a: NodeRect, b: NodeRect, others: NodeRect[]): Pt[];
/** 折点序列 → 圆角 SVG path。 */
export declare function toPath(pts: Pt[], radius?: number): string;
/** 折线弧长中点（放边标签）。 */
export declare function polyMidpoint(pts: Pt[]): Pt;
//# sourceMappingURL=route.d.ts.map