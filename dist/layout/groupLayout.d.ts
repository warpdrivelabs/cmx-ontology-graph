/**
 * 分域折叠布局 —— 把节点按 DAM 分组路径(groupPath)组织成**嵌套可折叠容器**（域▸应用▸模块▸对象卡）。
 * 递归布局：收起组 = 固定小盒；展开组 = 头 + 子（子组盒 或 叶卡）货架式打包 + bbox 自适应容器。
 *
 * 性能本质：默认(无 _groupCollapsed 条目)= 收起 → 整图只画少数域盒；只有展开到叶模块层才布局其对象卡。
 * 因此可见节点数受"已展开"约束，而非对象类型总数。边由 resolveKey 归约到最近可见祖先盒 → 跨容器边聚合。
 */
import type { NodeRect, OntologyGraphDef } from '../model/types.js';
import { type LayoutConfig } from './layout.js';
export interface GroupBox {
    key: string;
    label: string;
    count: number;
    depth: number;
    collapsed: boolean;
    rect: NodeRect;
}
export interface GroupLayoutResult {
    boxes: GroupBox[];
    pos: Record<string, NodeRect>;
    resolveKey: (nodeId: string) => string;
    rectOf: (key: string) => NodeRect | undefined;
    width: number;
    height: number;
}
/** 顶层布局：所有顶级域组货架式铺开。 */
export declare function groupLayout(def: OntologyGraphDef, cfg: LayoutConfig, collapsed: Record<string, boolean>): GroupLayoutResult;
/** 是否有意义地分组（≥2 个含叶的最深组）。否则宿主回退扁平图。 */
export declare function groupingActive(def: OntologyGraphDef): boolean;
/** 所有分组键（工具栏「全部展开/收起」用）。 */
export declare function allGroupKeys(def: OntologyGraphDef): string[];
//# sourceMappingURL=groupLayout.d.ts.map