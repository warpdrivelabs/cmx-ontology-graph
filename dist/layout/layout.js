/**
 * 本体图自动布局 —— 纯函数。本体图非严格 DAG（关系可双向/自环），故不做拓扑分层，改用
 * **确定性网格布局**（按节点数开方铺格），再叠加手动拖拽提示（_layout）。稳定、无环假设、可覆盖。
 *
 * 富卡片高度随属性行数变化（对象类型卡内列关键属性）；接口节点固定矮胶囊。
 */
export const DEFAULT_LAYOUT = {
    colGap: 300,
    rowGap: 260,
    nodeW: 232,
    headH: 46,
    rowH: 22,
    maxRows: 6,
    pad: 0,
};
export const PREVIEW_LAYOUT = {
    colGap: 260,
    rowGap: 220,
    nodeW: 190,
    headH: 42,
    rowH: 20,
    maxRows: 4,
    pad: 30,
};
/** 一个属性是否为层块（复合子层：业务单据的行/明细）。 */
export function isLevelProp(p) {
    return !!(p.isLevel || (p.children && p.children.length) || p.baseType === 'array' || p.baseType === 'struct');
}
/**
 * 卡内渲染行数（递归）：标量属性 = 1 行；层块 = 层头 1 行 + 其 children 递归行数。
 * 顶层标量超 maxRows 折叠为 1 行「+N」；层块永远整块展开（业务单据层级是重点，不截断）。
 */
export function countRenderRows(props, maxRows) {
    const scalars = props.filter((p) => !isLevelProp(p));
    const levels = props.filter((p) => isLevelProp(p));
    const shownScalars = Math.min(scalars.length, maxRows);
    const extra = scalars.length > maxRows ? 1 : 0;
    let rows = shownScalars + extra;
    for (const lv of levels)
        rows += 1 + countRenderRows(lv.children || [], maxRows);
    return rows;
}
/** 卡片高度：对象类型 = 头 + 渲染行数*行高 + 留白；接口 = 矮胶囊。层块递归计高。 */
export function nodeHeight(n, cfg) {
    if (n.kind === 'interface')
        return cfg.headH;
    const rows = countRenderRows(n.properties || [], cfg.maxRows);
    return cfg.headH + rows * cfg.rowH + 8;
}
/** 计算布局：确定性网格 + 拖拽提示覆盖。 */
export function layout(def, cfg, hints) {
    const nodes = def.nodes || [];
    const pos = {};
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    let maxX = 0;
    let maxY = 0;
    nodes.forEach((n, i) => {
        const gx = i % cols;
        const gy = Math.floor(i / cols);
        const h = nodeHeight(n, cfg);
        const def_x = cfg.pad + gx * cfg.colGap;
        const def_y = cfg.pad + gy * cfg.rowGap;
        const hint = hints ? hints[n.id] : undefined;
        const x = hint ? hint.x : def_x;
        const y = hint ? hint.y : def_y;
        pos[n.id] = { x, y, w: cfg.nodeW, h };
        maxX = Math.max(maxX, x + cfg.nodeW);
        maxY = Math.max(maxY, y + h);
    });
    return { pos, width: maxX + cfg.pad, height: maxY + cfg.pad };
}
//# sourceMappingURL=layout.js.map