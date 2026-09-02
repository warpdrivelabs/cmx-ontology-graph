/**
 * 本体图自动布局 —— 纯函数。本体图非严格 DAG（关系可双向/自环），故不做拓扑分层，改用
 * **确定性网格布局**（按节点数开方铺格），再叠加手动拖拽提示（_layout）。稳定、无环假设、可覆盖。
 *
 * 富卡片高度随属性行数变化（对象类型卡内列关键属性）；接口节点固定矮胶囊。
 */
import type { GraphNode, GraphProperty, LayoutResult, OntologyGraphDef } from '../model/types.js';
export interface LayoutConfig {
    /** 网格列间距（卡片中心距）。 */
    colGap: number;
    /** 网格行间距。 */
    rowGap: number;
    /** 卡片宽。 */
    nodeW: number;
    /** 卡片头部高（色条 + 标题）。 */
    headH: number;
    /** 每属性行高。 */
    rowH: number;
    /** 卡内最多显示属性行数（超出折叠 +N）。 */
    maxRows: number;
    /** 画布外边距。 */
    pad: number;
}
export declare const DEFAULT_LAYOUT: LayoutConfig;
export declare const PREVIEW_LAYOUT: LayoutConfig;
/** 一个属性是否为层块（复合子层：业务单据的行/明细）。 */
export declare function isLevelProp(p: GraphProperty): boolean;
/**
 * 卡内渲染行数（递归）：标量属性 = 1 行；层块 = 层头 1 行 + 其 children 递归行数。
 * 顶层标量超 maxRows 折叠为 1 行「+N」；层块永远整块展开（业务单据层级是重点，不截断）。
 */
export declare function countRenderRows(props: GraphProperty[], maxRows: number): number;
/** 卡片高度：对象类型 = 头 + 渲染行数*行高 + 留白；接口 = 矮胶囊。层块递归计高。 */
export declare function nodeHeight(n: GraphNode, cfg: LayoutConfig): number;
/** 计算布局：确定性网格 + 拖拽提示覆盖。 */
export declare function layout(def: OntologyGraphDef, cfg: LayoutConfig, hints?: Record<string, {
    x: number;
    y: number;
}>): LayoutResult;
//# sourceMappingURL=layout.d.ts.map