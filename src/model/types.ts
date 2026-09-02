/**
 * 本体图数据模型类型 —— 与本体后端 cmx-onto-model 的 serde 契约对齐（camelCase）。
 * 组件对这些字段做结构操作 + 图渲染；不理解属性语义/校验规则（那是宿主注入的 Inspector 的事）。
 *
 * 与 @cmx/decision-graph 平级但**语义不同**：decision-graph 是 DAG（input→output 防环），本体图是
 * 一般 ER 图（对象类型=富卡片节点，关系类型=带基数的有向边，接口=虚线挂接；关系可双向、可自环层级，
 * 仅接口继承才需防环——防环留给宿主/后端，组件不强制）。
 */

/** 图节点角色。object=对象类型（富卡片）；interface=接口（虚线挂接的横切节点）。 */
export type NodeKind = 'object' | 'interface';

/** 关系基数。 */
export type Cardinality = 'oneToOne' | 'oneToMany' | 'manyToMany';

/** 类型生命周期（与后端 TypeStatus 对齐）。 */
export type TypeStatus = 'experimental' | 'active' | 'deprecated';

/** 卡内属性行（渲染用精简投影；完整定义在宿主 Inspector）。 */
export interface GraphProperty {
  apiName: string;
  /** 显示名（层块头/字段的中文名，可选）。 */
  displayName?: string;
  /** 基础类型（string/long/decimal/…），卡内小字显示。 */
  baseType?: string;
  /** 是否主键（卡内 ◇ 置顶）。 */
  isPrimaryKey?: boolean;
  /** 是否标题属性（卡内 ⌾）。 */
  isTitle?: boolean;
  /** 是否必填（卡内 *）。 */
  required?: boolean;
  /** 是否已建索引（卡内 ⚡）。 */
  isIndexed?: boolean;
  /** 语义类型徽标（金额/百分比…）。 */
  semanticType?: string;
  /** 复合层块（业务单据的子层，如订单行）——array/struct 属性，children = 该层字段（可再嵌层）。 */
  children?: GraphProperty[];
  /** 是否为层块（复合类型，卡内渲缩进层块而非单行）。 */
  isLevel?: boolean;
  /** 层显示名（该子层来源实体的 displayName，如"订单行"）。 */
  entityName?: string;
}

/** 图节点（对象类型 / 接口）。 */
export interface GraphNode {
  /** 稳定标识 = apiName。 */
  id: string;
  kind: NodeKind;
  displayName?: string;
  /** 顶部色条颜色（对象类型自定义 color）。 */
  color?: string;
  icon?: string;
  status?: TypeStatus;
  /** 对象类型的属性列表（接口节点为空）。 */
  properties?: GraphProperty[];
  /** 对象类型实现的接口 apiName（用于虚线挂接边生成）。 */
  implements?: string[];
  /** DAM 分组路径（宿主注入，如 [domain, application, module]）——本体图按此分域折叠，缓解大图性能。 */
  groupPath?: string[];
}

/** 有向关系边（关系类型）。source=A端 apiName，target=B端 apiName。 */
export interface GraphEdge {
  /** 关系类型 apiName。 */
  apiName: string;
  source: string;
  target: string;
  displayName?: string;
  cardinality?: Cardinality;
  /** A→B 角色名（边中标签）。 */
  roleA?: string;
  /** B→A 角色名。 */
  roleB?: string;
  /** 源侧外键属性 apiName（连线起点锚到该属性行；缺省按名称启发式匹配或源主键）。 */
  sourceProperty?: string;
  /** 靶侧被引属性 apiName（连线终点锚到该属性行；缺省 = 靶主键）。 */
  targetProperty?: string;
  /** 是否接口实现边（虚线挂接，非普通关系；由 implements 派生，不落后端关系表）。 */
  isInterfaceLink?: boolean;
}

/** 布局坐标提示（组件会话态；可持久化到 spec._layout，后端忽略未知字段）。 */
export interface LayoutHint {
  x: number;
  y: number;
}

/** 本体图定义（组件的核心 payload）。`_layout` 为组件私有扩展，非后端契约。 */
export interface OntologyGraphDef {
  name?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 组件私有：节点手动拖拽坐标提示（id → {x,y}）。后端忽略。 */
  _layout?: Record<string, LayoutHint>;
  /** 组件私有：关系边手动布线折点（apiName → 折线全量顶点，含锚点）。后端忽略。 */
  _edgeRoutes?: Record<string, { x: number; y: number }[]>;
  /** 组件私有：分组容器折叠态（组键 domain/domainapp/… → 是否收起）。后端忽略。 */
  _groupCollapsed?: Record<string, boolean>;
}

/** 节点在画布上的定位盒。 */
export interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 布局结果。 */
export interface LayoutResult {
  pos: Record<string, NodeRect>;
  width: number;
  height: number;
}

export const CARDINALITY_LABEL: Record<Cardinality, string> = {
  oneToOne: '1:1',
  oneToMany: '1:N',
  manyToMany: 'N:M',
};

export const STATUS_LABEL: Record<TypeStatus, string> = {
  experimental: '试验',
  active: '激活',
  deprecated: '废弃',
};
