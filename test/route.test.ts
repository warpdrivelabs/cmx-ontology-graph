/**
 * 正交连线布线单测 —— 浮动锚点朝向侧、A* 避让遮挡、共线简化、自关联。
 */
import { describe, it, expect } from 'vitest';
import { chooseSides, routeEdge, toPath, polyMidpoint, type Pt } from '../src/layout/route.js';
import type { NodeRect } from '../src/model/types.js';

const R = (x: number, y: number, w = 210, h = 120): NodeRect => ({ x, y, w, h });

/** 折线是否穿过某矩形内部（任一轴对齐段）。 */
function polyHitsRect(pts: Pt[], r: NodeRect): boolean {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    const x0 = Math.min(p.x, q.x);
    const x1 = Math.max(p.x, q.x);
    const y0 = Math.min(p.y, q.y);
    const y1 = Math.max(p.y, q.y);
    // 收紧 2px，容忍锚点擦边
    if (x0 < r.x + r.w - 2 && x1 > r.x + 2 && y0 < r.y + r.h - 2 && y1 > r.y + 2) return true;
  }
  return false;
}

describe('chooseSides 朝向侧', () => {
  it('B 在右 → 源右侧、靶左侧', () => {
    expect(chooseSides(R(0, 0), R(400, 0))).toEqual({ sa: 'R', sb: 'L' });
  });
  it('B 在左 → 源左侧、靶右侧', () => {
    expect(chooseSides(R(400, 0), R(0, 0))).toEqual({ sa: 'L', sb: 'R' });
  });
  it('B 在下 → 源下、靶上', () => {
    expect(chooseSides(R(0, 0), R(0, 400))).toEqual({ sa: 'B', sb: 'T' });
  });
  it('B 在上 → 源上、靶下', () => {
    expect(chooseSides(R(0, 400), R(0, 0))).toEqual({ sa: 'T', sb: 'B' });
  });
});

describe('routeEdge 锚点', () => {
  it('端点贴合朝向侧中点：源右缘中点 → 靶左缘中点', () => {
    const a = R(0, 0);
    const b = R(400, 0);
    const pts = routeEdge(a, b, []);
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first).toEqual({ x: a.x + a.w, y: Math.round(a.y + a.h / 2) });
    expect(last).toEqual({ x: b.x, y: Math.round(b.y + b.h / 2) });
  });

  it('拖到左侧后端点改走左/右侧（不再固定右缘）', () => {
    const a = R(400, 0);
    const b = R(0, 0); // 靶在源左侧
    const pts = routeEdge(a, b, []);
    const first = pts[0]!;
    // 源应从左缘出（x = a.x），而非右缘
    expect(first.x).toBe(a.x);
  });
});

describe('routeEdge 避让遮挡', () => {
  it('两端之间有卡片时，路径绕开该卡片', () => {
    const a = R(0, 0);
    const b = R(600, 0);
    const blocker = R(280, -30, 120, 180); // 挡在 A、B 之间
    const pts = routeEdge(a, b, [blocker]);
    expect(polyHitsRect(pts, blocker)).toBe(false);
    // 绕行必然产生纵向偏移（存在与锚点 y 不同的折点）
    const ys = new Set(pts.map((p) => p.y));
    expect(ys.size).toBeGreaterThan(1);
  });

  it('无遮挡且对齐时走直线（简化为两点）', () => {
    const pts = routeEdge(R(0, 0), R(400, 0), []);
    expect(pts.length).toBe(2);
    expect(pts[0]!.y).toBe(pts[1]!.y);
  });
});

describe('toPath / polyMidpoint / 自关联', () => {
  it('toPath 产出合法 path（M 开头）', () => {
    const d = toPath(routeEdge(R(0, 0), R(400, 0), []));
    expect(d.startsWith('M')).toBe(true);
  });
  it('polyMidpoint 落在包围盒内', () => {
    const pts = routeEdge(R(0, 0), R(600, 200), []);
    const m = polyMidpoint(pts);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(m.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1);
    expect(m.x).toBeLessThanOrEqual(Math.max(...xs) + 1);
    expect(m.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1);
    expect(m.y).toBeLessThanOrEqual(Math.max(...ys) + 1);
  });
  it('自关联（source==target）产出闭合小环折线', () => {
    const a = R(100, 100);
    const pts = routeEdge(a, a, []);
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });
});
