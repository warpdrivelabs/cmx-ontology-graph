/**
 * OntologyModel 单测 —— 纯逻辑：对象/接口节点增删、关系边、implements→接口实现边同步、属性、校验。
 */
import { describe, it, expect } from 'vitest';
import { OntologyModel } from '../src/model/OntologyModel.js';

describe('OntologyModel 结构操作', () => {
  it('加对象类型 + 重名拒绝', () => {
    const m = new OntologyModel();
    expect(m.addObjectType('Customer', '客户')).toBe('Customer');
    expect(m.addObjectType('Customer')).toBeNull(); // 重名
    expect(m.nodes.length).toBe(1);
    expect(m.node('Customer')?.kind).toBe('object');
    expect(m.node('Customer')?.status).toBe('experimental');
  });

  it('加关系边：两端须存在 + apiName 唯一', () => {
    const m = new OntologyModel();
    m.addObjectType('Customer');
    m.addObjectType('Order');
    expect(m.addLink('places', 'Customer', 'Order', 'oneToMany', 'places', 'placedBy')).toBeNull();
    expect(m.linkEdges.length).toBe(1);
    expect(m.linkEdges[0]!.cardinality).toBe('oneToMany');
    // 两端缺失
    expect(m.addLink('bad', 'Customer', 'Ghost')).toMatch(/两端/);
    // 重名
    expect(m.addLink('places', 'Customer', 'Order')).toMatch(/已存在/);
  });

  it('implements → 接口实现边自动同步；删接口回收边', () => {
    const m = new OntologyModel();
    m.addObjectType('Airport');
    m.addInterface('Locatable');
    m.setImplements('Airport', 'Locatable', true);
    const ifLinks = m.edges.filter((e) => e.isInterfaceLink);
    expect(ifLinks.length).toBe(1);
    expect(ifLinks[0]!.source).toBe('Airport');
    expect(ifLinks[0]!.target).toBe('Locatable');
    // linkEdges 不含接口实现边
    expect(m.linkEdges.length).toBe(0);
    // 删接口 → 实现边 + implements 引用一并回收
    m.delNode('Locatable');
    expect(m.edges.filter((e) => e.isInterfaceLink).length).toBe(0);
    expect(m.node('Airport')?.implements || []).not.toContain('Locatable');
  });

  it('删对象类型连带清关联关系边', () => {
    const m = new OntologyModel();
    m.addObjectType('Customer');
    m.addObjectType('Order');
    m.addLink('places', 'Customer', 'Order');
    m.delNode('Order');
    expect(m.nodes.length).toBe(1);
    expect(m.linkEdges.length).toBe(0);
  });

  it('属性操作 + 校验：有属性无主键报错', () => {
    const m = new OntologyModel();
    m.addObjectType('Customer');
    m.addProperty('Customer', { apiName: 'id', baseType: 'long' });
    expect(m.validate()).toMatch(/缺主键/);
    m.setProperties('Customer', [{ apiName: 'id', baseType: 'long', isPrimaryKey: true }]);
    expect(m.validate()).toBeNull();
  });

  it('setDef round-trip 保留 implements 派生边', () => {
    const m = new OntologyModel();
    m.addObjectType('Airport');
    m.addInterface('Locatable');
    m.setImplements('Airport', 'Locatable', true);
    const def = m.getDef();
    const m2 = new OntologyModel(def);
    expect(m2.edges.filter((e) => e.isInterfaceLink).length).toBe(1);
  });
});
