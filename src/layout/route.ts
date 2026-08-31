/**
 * 正交连线布线（避让遮挡）—— 纯函数、无 DOM、可单测。
 *
 * 修复两点：
 * 1) **锚点浮动**：按两节点中心连线的主轴选「朝向侧」，锚在该侧中点 —— 拖动节点时端点始终贴合朝向侧，
 *    不再固定在右/左缘 y+23 而「离开锚点」。
 * 2) **避让遮挡**：A* 在「有趣坐标线」网格上求最短正交路径，绕开其余节点卡片（障碍膨胀留白 + 转弯惩罚）。
 *    起终点各先法向伸出一段 stub 再拐弯；两端节点自身计入障碍，避免连线穿过端点卡片。
 * 兜底：A* 无解时走中线正交折线（不避让但正交、稳定）。
 */

import type { NodeRect } from '../model/types.js';

export interface Pt {
  x: number;
  y: number;
}
export type Side = 'L' | 'R' | 'T' | 'B';

/** 障碍膨胀（线与卡片留白）。 */
const MARGIN = 14;
/** 锚点法向伸出：先离开卡片再拐弯。 */
const STUB = 18;
/** 转弯惩罚：偏好更少拐弯的路径。 */
const TURN = 14;

const r0 = (v: number): number => Math.round(v);
function center(r: NodeRect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
function inflate(r: NodeRect, m: number): NodeRect {
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}

/** 选朝向侧（按中心连线主轴）。导出供单测。 */
export function chooseSides(a: NodeRect, b: NodeRect): { sa: Side; sb: Side } {
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { sa: 'R', sb: 'L' } : { sa: 'L', sb: 'R' };
  return dy >= 0 ? { sa: 'B', sb: 'T' } : { sa: 'T', sb: 'B' };
}

function anchorPt(r: NodeRect, s: Side): Pt {
  if (s === 'R') return { x: r0(r.x + r.w), y: r0(r.y + r.h / 2) };
  if (s === 'L') return { x: r0(r.x), y: r0(r.y + r.h / 2) };
  if (s === 'T') return { x: r0(r.x + r.w / 2), y: r0(r.y) };
  return { x: r0(r.x + r.w / 2), y: r0(r.y + r.h) };
}
function stubOf(p: Pt, s: Side): Pt {
  if (s === 'R') return { x: p.x + STUB, y: p.y };
  if (s === 'L') return { x: p.x - STUB, y: p.y };
  if (s === 'T') return { x: p.x, y: p.y - STUB };
  return { x: p.x, y: p.y + STUB };
}

/** 轴对齐线段是否穿过矩形内部（障碍已膨胀，边界擦过视为不穿）。 */
function segHits(p: Pt, q: Pt, r: NodeRect): boolean {
  const x0 = Math.min(p.x, q.x);
  const x1 = Math.max(p.x, q.x);
  const y0 = Math.min(p.y, q.y);
  const y1 = Math.max(p.y, q.y);
  return x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y;
}
function blocked(p: Pt, q: Pt, obst: NodeRect[]): boolean {
  for (const r of obst) if (segHits(p, q, r)) return true;
  return false;
}
function ptInside(p: Pt, obst: NodeRect[]): boolean {
  for (const r of obst) if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) return true;
  return false;
}
function uniqSorted(a: number[]): number[] {
  return [...new Set(a.map(r0))].sort((m, n) => m - n);
}

interface ANode {
  x: number;
  y: number;
  g: number;
  f: number;
  dir: string;
  prev: string | null;
}

/** A* 正交布线：起终点须为网格点；返回不含起终点的中间折点，或 null（无解）。 */
function astar(start: Pt, goal: Pt, xs: number[], ys: number[], obst: NodeRect[]): Pt[] | null {
  const ixOf = new Map<number, number>();
  xs.forEach((v, i) => ixOf.set(v, i));
  const iyOf = new Map<number, number>();
  ys.forEach((v, i) => iyOf.set(v, i));
  if (!ixOf.has(start.x) || !iyOf.has(start.y) || !ixOf.has(goal.x) || !iyOf.has(goal.y)) return null;
  const K = (x: number, y: number): string => x + ':' + y;
  const hEst = (x: number, y: number): number => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const open = new Map<string, ANode>();
  const all = new Map<string, ANode>();
  const closed = new Set<string>();
  const sKey = K(start.x, start.y);
  const gKey = K(goal.x, goal.y);
  open.set(sKey, { x: start.x, y: start.y, g: 0, f: hEst(start.x, start.y), dir: '', prev: null });
  all.set(sKey, open.get(sKey)!);
  let guard = 0;
  while (open.size > 0 && guard++ < 40000) {
    let curKey: string | null = null;
    let cur: ANode | null = null;
    for (const [k, n] of open) if (cur === null || n.f < cur.f) { cur = n; curKey = k; }
    if (curKey === null || cur === null) break;
    open.delete(curKey);
    closed.add(curKey);
    if (curKey === gKey) {
      const pts: Pt[] = [];
      let node: ANode | null = cur;
      while (node) {
        pts.push({ x: node.x, y: node.y });
        node = node.prev ? all.get(node.prev) ?? null : null;
      }
      pts.reverse();
      return pts.slice(1, -1);
    }
    const ix = ixOf.get(cur.x);
    const iy = iyOf.get(cur.y);
    if (ix === undefined || iy === undefined) continue;
    const cand: Array<{ x: number; y: number; d: string }> = [];
    const xr = xs[ix + 1];
    if (xr !== undefined) cand.push({ x: xr, y: cur.y, d: 'H' });
    const xl = xs[ix - 1];
    if (xl !== undefined) cand.push({ x: xl, y: cur.y, d: 'H' });
    const yd = ys[iy + 1];
    if (yd !== undefined) cand.push({ x: cur.x, y: yd, d: 'V' });
    const yu = ys[iy - 1];
    if (yu !== undefined) cand.push({ x: cur.x, y: yu, d: 'V' });
    for (const nb of cand) {
      const nKey = K(nb.x, nb.y);
      if (closed.has(nKey)) continue;
      if (blocked({ x: cur.x, y: cur.y }, { x: nb.x, y: nb.y }, obst)) continue;
      const step = Math.abs(nb.x - cur.x) + Math.abs(nb.y - cur.y);
      const turn = cur.dir !== '' && cur.dir !== nb.d ? TURN : 0;
      const ng = cur.g + step + turn;
      const prevN = all.get(nKey);
      if (prevN === undefined || ng < prevN.g) {
        const nn: ANode = { x: nb.x, y: nb.y, g: ng, f: ng + hEst(nb.x, nb.y), dir: nb.d, prev: curKey };
        open.set(nKey, nn);
        all.set(nKey, nn);
      }
    }
  }
  return null;
}

/** 中线正交折线兜底（A* 无解时）。 */
function fallback(pa: Pt, sPt: Pt, gPt: Pt, pb: Pt): Pt[] {
  if (Math.abs(gPt.x - sPt.x) >= Math.abs(gPt.y - sPt.y)) {
    const mx = r0((sPt.x + gPt.x) / 2);
    return [pa, sPt, { x: mx, y: sPt.y }, { x: mx, y: gPt.y }, gPt, pb];
  }
  const my = r0((sPt.y + gPt.y) / 2);
  return [pa, sPt, { x: sPt.x, y: my }, { x: gPt.x, y: my }, gPt, pb];
}

/** 自关联：右侧伸出小方环回到顶部中点。 */
function selfLoop(r: NodeRect): Pt[] {
  const ext = 30;
  const rx = r.x + r.w;
  const cy = r0(r.y + r.h / 2);
  const cx = r0(r.x + r.w / 2);
  return [
    { x: r0(rx), y: cy },
    { x: r0(rx + ext), y: cy },
    { x: r0(rx + ext), y: r0(r.y - ext) },
    { x: cx, y: r0(r.y - ext) },
    { x: cx, y: r0(r.y) },
  ];
}

/** 去重 + 合并共线折点。 */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const b = out[out.length - 1];
    if (b && b.x === p.x && b.y === p.y) continue;
    const a = out[out.length - 2];
    if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** 已知两端锚点与朝向侧的正交避让布线核心（属性级锚点复用此）。others = 除两端外其余节点盒。 */
export function routeAnchored(
  pa: Pt,
  sa: Side,
  pb: Pt,
  sb: Side,
  endA: NodeRect,
  endB: NodeRect,
  others: NodeRect[],
): Pt[] {
  const sPt = stubOf(pa, sa);
  const gPt = stubOf(pb, sb);
  const inflated = others.map((r) => inflate(r, MARGIN));
  const obst = [...inflated, endA, endB];
  const xs = uniqSorted([sPt.x, gPt.x, r0((sPt.x + gPt.x) / 2), ...inflated.flatMap((r) => [r.x, r.x + r.w])]);
  const ys = uniqSorted([sPt.y, gPt.y, r0((sPt.y + gPt.y) / 2), ...inflated.flatMap((r) => [r.y, r.y + r.h])]);
  let mids: Pt[] | null = null;
  if (!ptInside(sPt, obst) && !ptInside(gPt, obst)) mids = astar(sPt, gPt, xs, ys, obst);
  const raw = mids ? [pa, sPt, ...mids, gPt, pb] : fallback(pa, sPt, gPt, pb);
  return simplify(raw);
}

/** 布线主入口（节点级：几何朝向侧中点）。others = 除两端外的其余节点盒。 */
export function routeEdge(a: NodeRect, b: NodeRect, others: NodeRect[]): Pt[] {
  if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && a.w === b.w && a.h === b.h) return selfLoop(a);
  const { sa, sb } = chooseSides(a, b);
  return routeAnchored(anchorPt(a, sa), sa, anchorPt(b, sb), sb, a, b, others);
}

/** 折点序列 → 圆角 SVG path。 */
export function toPath(pts: Pt[], radius = 7): string {
  if (pts.length < 2) return '';
  const p0 = pts[0]!;
  if (pts.length === 2) {
    const p1 = pts[1]!;
    return `M${p0.x},${p0.y} L${p1.x},${p1.y}`;
  }
  let d = `M${p0.x},${p0.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const r = Math.min(radius, dist(a, b) / 2, dist(b, c) / 2);
    const t1 = towards(b, a, r);
    const t2 = towards(b, c, r);
    d += ` L${round1(t1.x)},${round1(t1.y)} Q${b.x},${b.y} ${round1(t2.x)},${round1(t2.y)}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L${last.x},${last.y}`;
  return d;
}

/** 折线弧长中点（放边标签）。 */
export function polyMidpoint(pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1]!, pts[i]!);
    seg.push(d);
    total += d;
  }
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = seg[i - 1] ?? 0;
    if (acc + d >= total / 2) {
      const t = d ? (total / 2 - acc) / d : 0;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += d;
  }
  return pts[Math.floor(pts.length / 2)]!;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function towards(from: Pt, to: Pt, d: number): Pt {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) * d) / len, y: from.y + ((to.y - from.y) * d) / len };
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
