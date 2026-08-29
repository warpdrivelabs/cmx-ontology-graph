/**
 * 本体图数据模型类型 —— 与本体后端 cmx-onto-model 的 serde 契约对齐（camelCase）。
 * 组件对这些字段做结构操作 + 图渲染；不理解属性语义/校验规则（那是宿主注入的 Inspector 的事）。
 *
 * 与 @cmx/decision-graph 平级但**语义不同**：decision-graph 是 DAG（input→output 防环），本体图是
 * 一般 ER 图（对象类型=富卡片节点，关系类型=带基数的有向边，接口=虚线挂接；关系可双向、可自环层级，
 * 仅接口继承才需防环——防环留给宿主/后端，组件不强制）。
 */
export const CARDINALITY_LABEL = {
    oneToOne: '1:1',
    oneToMany: '1:N',
    manyToMany: 'N:M',
};
export const STATUS_LABEL = {
    experimental: '试验',
    active: '激活',
    deprecated: '废弃',
};
//# sourceMappingURL=types.js.map