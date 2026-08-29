/**
 * layout + svg 单测 —— 网格布局坐标、卡片高度随属性、拖拽提示覆盖；SVG 渲染含富卡片图元。
 */
import { describe, it, expect } from 'vitest';
import { layout, nodeHeight, DEFAULT_LAYOUT } from '../src/layout/layout.js';
import { renderSvg } from '../src/render/svg.js';
import type { OntologyGraphDef, GraphNode } from '../src/model/types.js';

const objNode = (id: string, props = 0): GraphNode => ({
  id,
  kind: 'object',
  properties: Array.from({ length: props }, (_, i) => ({ apiName: 'p' + i, baseType: 'string' })),
});

describe('layout', () => {
  it('卡片高度随属性行数增长；接口固定矮', () => {
    const h0 = nodeHeight(objNode('A', 0), DEFAULT_LAYOUT);
    const h3 = nodeHeight(objNode('A', 3), DEFAULT_LAYOUT);
    expect(h3).toBeGreaterThan(h0);
    const hi = nodeHeight({ id: 'I', kind: 'interface' }, DEFAULT_LAYOUT);
    expect(hi).toBe(DEFAULT_LAYOUT.headH);
  });

  it('网格布局：多节点铺开，尺寸正数', () => {
    const def: OntologyGraphDef = { nodes: [objNode('A'), objNode('B'), objNode('C'), objNode('D')], edges: [] };
    const lay = layout(def, DEFAULT_LAYOUT);
    expect(Object.keys(lay.pos).length).toBe(4);
    expect(lay.width).toBeGreaterThan(0);
    expect(lay.height).toBeGreaterThan(0);
    // 不同节点坐标不全相同
    const xs = new Set(Object.values(lay.pos).map((p) => p.x));
    expect(xs.size).toBeGreaterThan(1);
  });

  it('拖拽提示覆盖默认网格坐标', () => {
    const def: OntologyGraphDef = { nodes: [objNode('A')], edges: [] };
    const lay = layout(def, DEFAULT_LAYOUT, { A: { x: 999, y: 777 } });
    expect(lay.pos['A']!.x).toBe(999);
    expect(lay.pos['A']!.y).toBe(777);
  });
});

describe('renderSvg', () => {
  it('对象类型渲染富卡片：色条/标题/apiName/属性行/连接点', () => {
    const def: OntologyGraphDef = {
      nodes: [
        {
          id: 'Customer',
          kind: 'object',
          displayName: '客户',
          status: 'active',
          properties: [
            { apiName: 'id', baseType: 'long', isPrimaryKey: true },
            { apiName: 'name', baseType: 'string', isIndexed: true, required: true },
          ],
        },
      ],
      edges: [],
    };
    const lay = layout(def, DEFAULT_LAYOUT);
    const svg = renderSvg(def, lay, DEFAULT_LAYOUT, { selectedNodeId: null, selectedEdgeApiName: null, readonly: false, maxRows: 6 });
    expect(svg).toContain('og-object');
    expect(svg).toContain('客户'); // displayName
    expect(svg).toContain('Customer'); // apiName
    expect(svg).toContain('og-bar'); // 色条
    expect(svg).toContain('og-port'); // 连接点
    expect(svg).toContain('◇'); // 主键图元
    expect(svg).toContain('og-st-active'); // 状态类
  });

  it('关系边渲染基数 marker + 标签；接口虚线挂接边', () => {
    const def: OntologyGraphDef = {
      nodes: [objNode('Customer'), objNode('Order'), { id: 'Locatable', kind: 'interface' }],
      edges: [
        { apiName: 'places', source: 'Customer', target: 'Order', cardinality: 'oneToMany', displayName: '下单' },
        { apiName: 'Customer__implements__Locatable', source: 'Customer', target: 'Locatable', isInterfaceLink: true },
      ],
    };
    const lay = layout(def, DEFAULT_LAYOUT);
    const svg = renderSvg(def, lay, DEFAULT_LAYOUT, { selectedNodeId: null, selectedEdgeApiName: null, readonly: false, maxRows: 6 });
    expect(svg).toContain('data-edge="places"');
    expect(svg).toContain('下单');
    expect(svg).toContain('marker-end');
    expect(svg).toContain('og-iflink'); // 接口虚线边
    expect(svg).toContain('«interface»');
  });
});
