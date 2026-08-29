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
import type { LayoutResult, OntologyGraphDef } from '../model/types.js';
import type { LayoutConfig } from '../layout/layout.js';
export interface RenderState {
    selectedNodeId: string | null;
    selectedEdgeApiName: string | null;
    readonly: boolean;
    maxRows: number;
}
export declare function renderSvg(def: OntologyGraphDef, lay: LayoutResult, cfg: LayoutConfig, st: RenderState): string;
/** 组件样式（走 --og-* 令牌，宿主锚 --sap*；裸色兜底）。 */
export declare function graphCss(): string;
//# sourceMappingURL=svg.d.ts.map