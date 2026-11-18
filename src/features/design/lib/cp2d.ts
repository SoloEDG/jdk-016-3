/**
 * 展开图平面划分（planar arrangement）纯几何库。
 * 输入：纸张边界 + 若干折痕线段；输出：顶点聚合、原子边、被切分出的纸面区域。
 * 区域可能带孔洞（闭合折痕外的环形纸面），外边界环逆时针、孔洞环顺时针。
 * 所有容差集中在此，保证超短线段与几乎重合的交点被合并而不是产生细碎纸面。
 */

export interface Pt {
  x: number;
  y: number;
}

/** 顶点吸附/合并半径（纸张半宽为 1） */
export const SNAP = 0.03;
/** 可接受的最短绘制线段 */
export const MIN_SEG = 0.06;
/** 原子边最小长度，短于此视为零长并丢弃 */
export const MIN_EDGE = 1e-6;
/** 纸面最小面积，小于此面积的碎片不生成 */
export const AREA_EPS = 1e-7;

const EQ = 1e-9;

export const pt = (x: number, y: number): Pt => ({ x, y });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const sub2 = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const cross2 = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export interface LineInput {
  /** 折痕 id（边界为 "border"） */
  id: string;
  a: Pt;
  b: Pt;
  border: boolean;
  /** 绘制顺序，去重时先画的优先保留 */
  order: number;
}

export interface ArrEdge {
  a: number;
  b: number;
  line: string;
  border: boolean;
  order: number;
}

/** 一个纸面区域：外边界环（逆时针）+ 若干孔洞环（闭合折痕包围的内边界） */
export interface Region {
  outer: number[];
  holes: number[][];
}

export interface Arrangement {
  points: Pt[];
  edges: ArrEdge[];
  /** 切分出的纸面区域（可能带孔，如闭合折痕外的环形纸面） */
  faces: Region[];
  /** 有向边 "a_b" -> 其左侧区域下标（纸外为 -1） */
  faceOf: Map<string, number>;
}

/** 线段求交：返回交点在两条线段上的参数 t/u（含共线重叠的端点） */
function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number }[] {
  const r = sub2(b, a);
  const s = sub2(d, c);
  const den = cross2(r, s);
  const qp = sub2(c, a);
  if (Math.abs(den) < EQ) {
    // 平行：仅共线时产生重叠区间
    if (Math.abs(cross2(qp, r)) > 1e-7) return [];
    const rr = r.x * r.x + r.y * r.y;
    if (rr < EQ) return [];
    const t0 = (qp.x * r.x + qp.y * r.y) / rr;
    const t1 = t0 + (s.x * r.x + s.y * r.y) / rr;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (lo > hi + EQ) return [];
    const ss = s.x * s.x + s.y * s.y;
    const toU = (p: Pt) => ((p.x - c.x) * s.x + (p.y - c.y) * s.y) / ss;
    const out: { t: number; u: number }[] = [];
    for (const t of [lo, hi]) {
      const p = { x: a.x + t * r.x, y: a.y + t * r.y };
      out.push({ t, u: clamp01(toU(p)) });
    }
    return out;
  }
  const t = cross2(qp, s) / den;
  const u = cross2(qp, r) / den;
  const E = 1e-9;
  if (t < -E || t > 1 + E || u < -E || u > 1 + E) return [];
  return [{ t: clamp01(t), u: clamp01(u) }];
}

/** 并查集顶点聚合：距离小于 SNAP 的点合并为一个顶点 */
function cluster(points: Pt[], snap: number): { ids: number[]; pts: Pt[] } {
  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  // 网格分桶避免 O(n²)
  const cell = snap;
  const grid = new Map<string, number[]>();
  const key = (p: Pt) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const j of bucket)
          if (dist(p, points[j]!) < snap) {
            const ri = find(i);
            const rj = find(j);
            if (ri !== rj) parent[ri] = rj;
          }
      }
    const k = key(p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(i);
  }
  // 代表点：纸角 > 边界上的点 > 簇质心
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!members.has(r)) members.set(r, []);
    members.get(r)!.push(i);
  }
  const ids: number[] = [];
  const pts: Pt[] = [];
  const remap = new Map<number, number>();
  for (const group of members.values()) {
    const corner = group.find(
      (i) =>
        Math.abs(Math.abs(points[i]!.x) - 1) < EQ &&
        Math.abs(Math.abs(points[i]!.y) - 1) < EQ,
    );
    const onBorder = group.find(
      (i) =>
        Math.abs(Math.abs(points[i]!.x) - 1) < EQ ||
        Math.abs(Math.abs(points[i]!.y) - 1) < EQ,
    );
    let rep: Pt;
    if (corner !== undefined) rep = { ...points[corner]! };
    else if (onBorder !== undefined) rep = { ...points[onBorder]! };
    else {
      const sx = group.reduce((s, i) => s + points[i]!.x, 0) / group.length;
      const sy = group.reduce((s, i) => s + points[i]!.y, 0) / group.length;
      rep = { x: sx, y: sy };
    }
    const id = pts.length;
    pts.push(rep);
    for (const i of group) remap.set(i, id);
  }
  for (let i = 0; i < n; i++) ids.push(remap.get(find(i))!);
  return { ids, pts };
}

export function polygonArea(loop: Pt[]): number {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]!;
    const q = loop[(i + 1) % loop.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function centroid(loop: Pt[]): Pt {
  const n = loop.length;
  return {
    x: loop.reduce((s, p) => s + p.x, 0) / n,
    y: loop.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** 点到线段的距离 */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EQ) return dist(p, a);
  const t = clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** 通用点在多边形内（射线法，支持非凸；边界上返回 withinEps 控制的结果） */
export function pointInPolygon(p: Pt, loop: Pt[], withinEps = 1e-9): boolean {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    if (segDist(p, a, b) <= withinEps) return true;
  }
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!;
    const b = loop[j]!;
    if (a.y > p.y !== b.y > p.y) {
      const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x < x) inside = !inside;
    }
  }
  return inside;
}

/** 点严格在多边形内（距边界超过 eps） */
function strictlyInPolygon(p: Pt, loop: Pt[]): boolean {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    if (segDist(p, a, b) <= 1e-9) return false;
  }
  return pointInPolygon(p, loop, -1);
}

/** 点在区域内：在外边界内且不在任何孔洞内（孔边界上算作在区域内） */
export function pointInRegion(p: Pt, outer: Pt[], holes: Pt[][]): boolean {
  if (!pointInPolygon(p, outer)) return false;
  return !holes.some((h) => strictlyInPolygon(p, h));
}

/**
 * 区域内一点（用于身份继承的定位代表点）：
 * 取最长外边界边的中点向区域内微移，并验证；失败则逐边回退。
 */
export function interiorPoint(outer: Pt[], holes: Pt[][]): Pt {
  const edges = outer
    .map((p, i) => [p, outer[(i + 1) % outer.length]!] as const)
    .sort((a, b) => dist(b[0], b[1]) - dist(a[0], a[1]));
  for (const [p, q] of edges) {
    const len = dist(p, q);
    if (len < EQ) continue;
    // 左法向（外边界环为逆时针，内部在左）
    const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
    for (const f of [0.3, 0.1, 0.03, 0.005]) {
      const d = Math.min(len * f, 0.05);
      const c = {
        x: (p.x + q.x) / 2 + n.x * d,
        y: (p.y + q.y) / 2 + n.y * d,
      };
      if (pointInRegion(c, outer, holes)) return c;
    }
  }
  return centroid(outer);
}

export function buildArrangement(lines: LineInput[], snap = SNAP): Arrangement {
  // 1. 计算所有交点，把每条线切成原子段
  const params: number[][] = lines.map(() => [0, 1]);
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const li = lines[i]!;
      const lj = lines[j]!;
      for (const h of segIntersect(li.a, li.b, lj.a, lj.b)) {
        params[i]!.push(h.t);
        params[j]!.push(h.u);
      }
    }
  interface Atom {
    p: Pt;
    q: Pt;
    line: number;
  }
  const atoms: Atom[] = [];
  lines.forEach((l, i) => {
    const dir = sub2(l.b, l.a);
    const sorted = params[i]!.sort((x, y) => x - y);
    const uniq: number[] = [];
    for (const t of sorted)
      if (!uniq.length || t - uniq[uniq.length - 1]! > 1e-7) uniq.push(t);
    for (let k = 0; k + 1 < uniq.length; k++) {
      const t0 = uniq[k]!;
      const t1 = uniq[k + 1]!;
      atoms.push({
        p: { x: l.a.x + t0 * dir.x, y: l.a.y + t0 * dir.y },
        q: { x: l.a.x + t1 * dir.x, y: l.a.y + t1 * dir.y },
        line: i,
      });
    }
  });

  // 2. 聚合原子段端点（几乎重合的交点在此合并）
  const ends: Pt[] = [];
  atoms.forEach((a) => ends.push(a.p, a.q));
  const { ids, pts } = cluster(ends, snap);

  // 3. 生成原子边：丢弃零长边，按 (顶点对) 去重，边界与先画者优先
  const edgeMap = new Map<string, ArrEdge>();
  atoms.forEach((atom, k) => {
    const a = ids[2 * k]!;
    const b = ids[2 * k + 1]!;
    if (a === b) return;
    if (dist(pts[a]!, pts[b]!) < MIN_EDGE) return;
    const l = lines[atom.line]!;
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const cand: ArrEdge = {
      a,
      b,
      line: l.id,
      border: l.border,
      order: l.order,
    };
    const old = edgeMap.get(key);
    if (!old) edgeMap.set(key, cand);
    else if (cand.border && !old.border) edgeMap.set(key, cand);
    else if (cand.border === old.border && cand.order < old.order)
      edgeMap.set(key, cand);
  });
  let edges = [...edgeMap.values()];

  // 4. 反复剪除悬挂的折痕边（未连接到任何边缘/折痕的线段不会切分纸面）
  for (;;) {
    const deg = new Map<number, number>();
    for (const e of edges) {
      deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
      deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
    }
    const dead = edges.filter(
      (e) => !e.border && (deg.get(e.a)! <= 1 || deg.get(e.b)! <= 1),
    );
    if (!dead.length) break;
    const drop = new Set(dead);
    edges = edges.filter((e) => !drop.has(e));
  }

  // 5. 半边遍历：每条有向边追踪其左侧边界环
  const adj = new Map<number, { to: number; ang: number }[]>();
  for (const e of edges) {
    const pa = pts[e.a]!;
    const pb = pts[e.b]!;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    if (!adj.has(e.a)) adj.set(e.a, []);
    adj.get(e.a)!.push({ to: e.b, ang });
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.b)!.push({ to: e.a, ang: Math.atan2(pa.y - pb.y, pa.x - pb.x) });
  }
  for (const list of adj.values()) list.sort((u, v) => u.ang - v.ang);

  interface Walk {
    loop: number[];
    area: number;
    dirs: string[];
  }
  const walks: Walk[] = [];
  const walkOf = new Map<string, number>();
  const visited = new Set<string>();
  const dkey = (a: number, b: number) => `${a}_${b}`;
  for (const e of edges) {
    for (const [u, v] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as const) {
      if (visited.has(dkey(u, v))) continue;
      const loop: number[] = [];
      const dirs: string[] = [];
      let cu = u;
      let cv = v;
      for (let guard = 0; guard < 10000; guard++) {
        visited.add(dkey(cu, cv));
        dirs.push(dkey(cu, cv));
        loop.push(cu);
        const list = adj.get(cv)!;
        const idx = list.findIndex((w) => w.to === cu);
        // 在 cv 处取 (cv->cu) 前一条（顺时针最近）的半边，即左侧面边界
        const next = list[(idx - 1 + list.length) % list.length]!;
        cu = cv;
        cv = next.to;
        if (cu === u && cv === v) break;
      }
      const ptsLoop = loop.map((i) => pts[i]!);
      const area = polygonArea(ptsLoop);
      const wid = walks.length;
      walks.push({ loop, area, dirs });
      for (const d of dirs) walkOf.set(d, wid);
    }
  }

  // 6. 把边界环分组为区域：正面积环为外边界，负面积环归入最小严格包含它的正环（孔洞），
  //    不被任何正环包含的负环是纸外区域，丢弃。
  const positives = walks
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.area > AREA_EPS);
  const regions: Region[] = positives.map(({ w }) => ({
    outer: w.loop,
    holes: [],
  }));
  const regionOfWalk = new Map<number, number>();
  positives.forEach(({ i }, k) => regionOfWalk.set(i, k));
  walks.forEach((w, wi) => {
    if (w.area > -AREA_EPS) return;
    const p = pts[w.loop[0]!]!;
    let best = -1;
    let bestArea = Infinity;
    positives.forEach(({ w: pw }, k) => {
      if (
        pw.area < bestArea &&
        strictlyInPolygon(
          p,
          pw.loop.map((i2) => pts[i2]!),
        )
      ) {
        best = k;
        bestArea = pw.area;
      }
    });
    if (best >= 0) {
      regions[best]!.holes.push(w.loop);
      regionOfWalk.set(wi, best);
    }
  });
  const faceOf = new Map<string, number>();
  walks.forEach((w, i) => {
    const r = regionOfWalk.get(i) ?? -1;
    for (const d of w.dirs) faceOf.set(d, r);
  });
  return { points: pts, edges, faces: regions, faceOf };
}
