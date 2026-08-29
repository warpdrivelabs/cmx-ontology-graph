/**
 * <cmx-ontology-graph> —— 本体图（Object/Link ER 图）可视化编辑自定义元素（shadow DOM，零框架，vanilla）。
 * 与 <cmx-decision-graph> 平级；对标 <cmx-megasheet>：属性传数据 + 命令式方法 + CustomEvent 出 + getModel() 逃生舱。
 *
 * 数据入：属性 data-spec='<json>' 或 setSpec(def)。
 * 配置：属性 readonly（只读预览）。
 * 事件出（bubbles+composed）：spec-change / type-select / edge-select / link-add / node-add / node-del。
 *   - type-select：选中对象类型/接口节点 → 宿主在 property 区渲强类型 Inspector（属性表格等）。
 *   - link-add：拉线落到目标 → 宿主弹「关系速建气泡」补 apiName/基数/角色，再 addLink 回写。
 * 逃生舱：getModel() 返 OntologyModel；getSpec() 返当前 def；autoLayout()/selectNode(id)。
 *
 * 属性/关系的强类型编辑**不在组件内**——组件只画图 + 拖拽/连线 + 选中，领域逻辑交宿主 Inspector。
 */
import { OntologyModel } from '../model/OntologyModel.js';
import type { Cardinality, OntologyGraphDef } from '../model/types.js';
export declare class CmxOntologyGraph extends HTMLElement {
    static get observedAttributes(): string[];
    private root;
    private model;
    private selectedNodeId;
    private selectedEdgeApiName;
    private rubber;
    private interaction;
    private _readonly;
    private _bootstrapped;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(name: string, _old: string | null, value: string | null): void;
    setSpec(def: OntologyGraphDef): void;
    getSpec(): OntologyGraphDef;
    getModel(): OntologyModel;
    validate(): string | null;
    /** 加对象类型（宿主命名后调）。返回 apiName 或 null（重名）。 */
    addObjectType(apiName: string, displayName?: string): string | null;
    addInterface(apiName: string, displayName?: string): string | null;
    /** 加关系边（宿主速建气泡确认后调）。返回 null 成功或拒绝原因。 */
    addLink(apiName: string, src: string, tgt: string, card: Cardinality, roleA?: string, roleB?: string): string | null;
    delNode(id: string): void;
    delLink(apiName: string): void;
    autoLayout(): void;
    selectNode(id: string): void;
    /** 供宿主编辑节点后回写模型并重画。 */
    refresh(): void;
    private cfg;
    private currentLayout;
    /** 拉线落点 → 请求宿主补关系元数据（不直接建，交速建气泡）。 */
    private requestConnect;
    private emit;
    private renderState;
    private render;
    private paint;
    private bindInteractions;
    private bindReadonlySelect;
}
/** 幂等注册。 */
export declare function defineOntologyGraph(): void;
//# sourceMappingURL=cmx-ontology-graph.d.ts.map