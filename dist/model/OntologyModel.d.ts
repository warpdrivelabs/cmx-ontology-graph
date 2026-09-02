/**
 * OntologyModel —— 本体图的可变模型 + 结构操作。逃生舱 getModel() 暴露它。
 * 副作用（重渲/派发事件）不在此层，由元素监听变更后处理；这里只做纯粹的模型变更并返回结果。
 *
 * 与 GraphModel（决策图）平级。本体图节点分对象类型（object）与接口（interface）；边分普通关系
 * （带基数）与接口实现边（isInterfaceLink，由节点 implements 派生，不可手动加删）。
 */
import type { Cardinality, GraphEdge, GraphNode, GraphProperty, OntologyGraphDef } from './types.js';
export declare class OntologyModel {
    private def;
    constructor(def?: OntologyGraphDef);
    /** 空骨架。 */
    static skeleton(name?: string): OntologyGraphDef;
    getDef(): OntologyGraphDef;
    setDef(def: OntologyGraphDef): void;
    /** 设置某关系边的手动布线折点（含锚点）。 */
    setEdgeRoute(apiName: string, points: {
        x: number;
        y: number;
    }[]): void;
    /** 取某关系边的手动布线折点；无则 undefined。 */
    edgeRoute(apiName: string): {
        x: number;
        y: number;
    }[] | undefined;
    /** 清除某关系边的手动布线（回退自动布线）。 */
    clearEdgeRoute(apiName: string): void;
    /** 当前所有分组容器折叠态（组键 → 是否收起）。 */
    groupCollapsed(): Record<string, boolean> | undefined;
    /** 设某组键收起/展开。 */
    setGroupCollapsed(key: string, collapsed: boolean): void;
    /** 切换某组键折叠态（默认收起，故首次切换 = 展开）。 */
    toggleGroup(key: string): void;
    /** 批量设置（工具栏「全部展开/收起」用）。 */
    setAllGroups(keys: string[], collapsed: boolean): void;
    get nodes(): GraphNode[];
    get edges(): GraphEdge[];
    node(id: string): GraphNode | undefined;
    /** 仅普通关系边（排除接口实现边）。 */
    get linkEdges(): GraphEdge[];
    /** 加对象类型节点。返回 apiName（须唯一，调用方保证；重名则返回 null）。 */
    addObjectType(apiName: string, displayName?: string): string | null;
    /** 加接口节点。 */
    addInterface(apiName: string, displayName?: string): string | null;
    /** 删节点 + 关联边 + 布局提示 + 其它节点对它的 implements 引用。 */
    delNode(id: string): void;
    /** 加普通关系边。返回 null 成功，否则拒绝原因。apiName 须唯一。 */
    addLink(apiName: string, source: string, target: string, cardinality?: Cardinality, roleA?: string, roleB?: string): string | null;
    /** 删普通关系边（按 apiName）。 */
    delLink(apiName: string): void;
    /** 设对象类型实现某接口（幂等），并同步接口实现边。 */
    setImplements(objectApiName: string, interfaceApiName: string, on: boolean): void;
    /** 由各对象类型的 implements 重建接口实现边（虚线挂接）。 */
    private syncInterfaceLinks;
    addProperty(objectApiName: string, prop: GraphProperty): void;
    setProperties(objectApiName: string, props: GraphProperty[]): void;
    setNodeMeta(id: string, patch: Partial<GraphNode>): void;
    setLayoutHint(id: string, x: number, y: number): void;
    layoutHints(): Record<string, {
        x: number;
        y: number;
    }> | undefined;
    clearLayoutHints(): void;
    /** 本地结构校验（镜像后端）。返回 null 或首个违规信息。 */
    validate(): string | null;
}
//# sourceMappingURL=OntologyModel.d.ts.map