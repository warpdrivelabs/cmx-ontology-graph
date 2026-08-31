/**
 * OntologyModel —— 本体图的可变模型 + 结构操作。逃生舱 getModel() 暴露它。
 * 副作用（重渲/派发事件）不在此层，由元素监听变更后处理；这里只做纯粹的模型变更并返回结果。
 *
 * 与 GraphModel（决策图）平级。本体图节点分对象类型（object）与接口（interface）；边分普通关系
 * （带基数）与接口实现边（isInterfaceLink，由节点 implements 派生，不可手动加删）。
 */
function clone(v) {
    return JSON.parse(JSON.stringify(v));
}
export class OntologyModel {
    def;
    constructor(def) {
        this.def = def ? clone(def) : OntologyModel.skeleton();
        this.def.nodes = this.def.nodes || [];
        this.def.edges = this.def.edges || [];
        this.syncInterfaceLinks();
    }
    /** 空骨架。 */
    static skeleton(name) {
        const def = { nodes: [], edges: [] };
        if (name != null)
            def.name = name;
        return def;
    }
    getDef() {
        return clone(this.def);
    }
    setDef(def) {
        // 保留既有布局提示与手动布线（保存/刷新重建 spec 不带 _layout/_edgeRoutes 时不重置位置）。
        const prevLayout = this.def && this.def._layout ? this.def._layout : undefined;
        const prevRoutes = this.def && this.def._edgeRoutes ? this.def._edgeRoutes : undefined;
        this.def = clone(def);
        this.def.nodes = this.def.nodes || [];
        this.def.edges = this.def.edges || [];
        if (!this.def._layout && prevLayout) {
            const ids = new Set(this.def.nodes.map((n) => n.id));
            const kept = {};
            for (const k of Object.keys(prevLayout)) {
                const v = prevLayout[k];
                if (v && ids.has(k))
                    kept[k] = v;
            }
            if (Object.keys(kept).length)
                this.def._layout = kept;
        }
        if (!this.def._edgeRoutes && prevRoutes) {
            const apis = new Set(this.def.edges.map((e) => e.apiName));
            const kept = {};
            for (const k of Object.keys(prevRoutes)) {
                const v = prevRoutes[k];
                if (v && apis.has(k))
                    kept[k] = v;
            }
            if (Object.keys(kept).length)
                this.def._edgeRoutes = kept;
        }
        this.syncInterfaceLinks();
    }
    /** 设置某关系边的手动布线折点（含锚点）。 */
    setEdgeRoute(apiName, points) {
        this.def._edgeRoutes = this.def._edgeRoutes || {};
        this.def._edgeRoutes[apiName] = points;
    }
    /** 取某关系边的手动布线折点；无则 undefined。 */
    edgeRoute(apiName) {
        return this.def._edgeRoutes ? this.def._edgeRoutes[apiName] : undefined;
    }
    /** 清除某关系边的手动布线（回退自动布线）。 */
    clearEdgeRoute(apiName) {
        if (this.def._edgeRoutes)
            delete this.def._edgeRoutes[apiName];
    }
    get nodes() {
        return this.def.nodes;
    }
    get edges() {
        return this.def.edges;
    }
    node(id) {
        return this.def.nodes.find((n) => n.id === id);
    }
    /** 仅普通关系边（排除接口实现边）。 */
    get linkEdges() {
        return this.def.edges.filter((e) => !e.isInterfaceLink);
    }
    /** 加对象类型节点。返回 apiName（须唯一，调用方保证；重名则返回 null）。 */
    addObjectType(apiName, displayName) {
        if (!apiName || this.node(apiName))
            return null;
        const n = { id: apiName, kind: 'object', properties: [] };
        if (displayName != null)
            n.displayName = displayName;
        n.status = 'experimental';
        this.def.nodes.push(n);
        return apiName;
    }
    /** 加接口节点。 */
    addInterface(apiName, displayName) {
        if (!apiName || this.node(apiName))
            return null;
        const n = { id: apiName, kind: 'interface' };
        if (displayName != null)
            n.displayName = displayName;
        this.def.nodes.push(n);
        return apiName;
    }
    /** 删节点 + 关联边 + 布局提示 + 其它节点对它的 implements 引用。 */
    delNode(id) {
        this.def.nodes = this.def.nodes.filter((n) => n.id !== id);
        this.def.edges = this.def.edges.filter((e) => e.source !== id && e.target !== id);
        for (const n of this.def.nodes) {
            if (n.implements)
                n.implements = n.implements.filter((x) => x !== id);
        }
        if (this.def._layout)
            delete this.def._layout[id];
        this.syncInterfaceLinks();
    }
    /** 加普通关系边。返回 null 成功，否则拒绝原因。apiName 须唯一。 */
    addLink(apiName, source, target, cardinality = 'oneToMany', roleA, roleB) {
        if (!this.node(source) || !this.node(target))
            return '关系两端对象类型须存在';
        if (this.def.edges.some((e) => e.apiName === apiName && !e.isInterfaceLink))
            return `关系 apiName「${apiName}」已存在`;
        const e = { apiName, source, target, cardinality };
        if (roleA != null)
            e.roleA = roleA;
        if (roleB != null)
            e.roleB = roleB;
        this.def.edges.push(e);
        return null;
    }
    /** 删普通关系边（按 apiName）。 */
    delLink(apiName) {
        this.def.edges = this.def.edges.filter((e) => e.isInterfaceLink || e.apiName !== apiName);
    }
    /** 设对象类型实现某接口（幂等），并同步接口实现边。 */
    setImplements(objectApiName, interfaceApiName, on) {
        const n = this.node(objectApiName);
        if (!n || n.kind !== 'object')
            return;
        n.implements = n.implements || [];
        const has = n.implements.includes(interfaceApiName);
        if (on && !has)
            n.implements.push(interfaceApiName);
        if (!on && has)
            n.implements = n.implements.filter((x) => x !== interfaceApiName);
        this.syncInterfaceLinks();
    }
    /** 由各对象类型的 implements 重建接口实现边（虚线挂接）。 */
    syncInterfaceLinks() {
        this.def.edges = this.def.edges.filter((e) => !e.isInterfaceLink);
        for (const n of this.def.nodes) {
            if (n.kind !== 'object' || !n.implements)
                continue;
            for (const iface of n.implements) {
                if (!this.node(iface))
                    continue;
                this.def.edges.push({
                    apiName: `${n.id}__implements__${iface}`,
                    source: n.id,
                    target: iface,
                    isInterfaceLink: true,
                });
            }
        }
    }
    // ── 属性操作（对象类型卡内）──
    addProperty(objectApiName, prop) {
        const n = this.node(objectApiName);
        if (!n || n.kind !== 'object')
            return;
        n.properties = n.properties || [];
        n.properties.push(prop);
    }
    setProperties(objectApiName, props) {
        const n = this.node(objectApiName);
        if (!n || n.kind !== 'object')
            return;
        n.properties = props;
    }
    setNodeMeta(id, patch) {
        const n = this.node(id);
        if (n)
            Object.assign(n, patch);
    }
    // ── 布局提示 ──
    setLayoutHint(id, x, y) {
        this.def._layout = this.def._layout || {};
        this.def._layout[id] = { x, y };
    }
    layoutHints() {
        return this.def._layout;
    }
    clearLayoutHints() {
        delete this.def._layout;
    }
    /** 本地结构校验（镜像后端）。返回 null 或首个违规信息。 */
    validate() {
        const ids = new Set();
        for (const n of this.def.nodes) {
            if (ids.has(n.id))
                return `类型 apiName 重复：${n.id}`;
            ids.add(n.id);
        }
        for (const e of this.def.edges) {
            if (e.isInterfaceLink)
                continue;
            if (!ids.has(e.source) || !ids.has(e.target))
                return `关系「${e.apiName}」端点不存在：${e.source} → ${e.target}`;
        }
        for (const n of this.def.nodes) {
            if (n.kind !== 'object')
                continue;
            const props = n.properties || [];
            const pkCount = props.filter((p) => p.isPrimaryKey).length;
            if (props.length && pkCount === 0)
                return `对象类型「${n.id}」缺主键`;
        }
        return null;
    }
}
//# sourceMappingURL=OntologyModel.js.map