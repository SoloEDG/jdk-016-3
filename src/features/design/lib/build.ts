/**
 * 由展开图折痕图案重建可折叠纸张：
 * 平面划分 -> 纸面身份继承 -> 逻辑折边 -> 折叠生成树（闭环边保留为约束，不删除）。
 * 相同图案重复构建结果确定，旧纸面/折痕 id 在编辑后保持稳定。
 */
import type {
  CreaseLine,
  Face,
  HingeInfo,
  P2,
  Paper,
  Vec3,
} from "../../../shared/types";
import {
  buildArrangement,
  interiorPoint,
  pointInRegion,
  polygonArea,
  pt,
  type Pt,
} from "./cp2d";

export interface PaperSpec {
  id: string;
  name: string;
  subtitle: string;
  size: number;
  rootAt?: P2;
}

const BORDER: [Pt, Pt][] = [
  [pt(-1, -1), pt(1, -1)],
  [pt(1, -1), pt(1, 1)],
  [pt(1, 1), pt(-1, 1)],
  [pt(-1, 1), pt(-1, -1)],
];

const to3 = (p: Pt): Vec3 => [p.x, 0, p.y];

interface RegionGeom {
  outer: Pt[];
  holes: Pt[][];
  area: number;
}

/** 在划分结果中查找包含指定点的区域下标，找不到时取外边界质心最近者 */
function locateFace(regions: RegionGeom[], p: Pt): number {
  for (let i = 0; i < regions.length; i++)
    if (pointInRegion(p, regions[i]!.outer, regions[i]!.holes)) return i;
  let best = 0;
  let bd = Infinity;
  regions.forEach((r, i) => {
    const cx = r.outer.reduce((s, q) => s + q.x, 0) / r.outer.length;
    const cy = r.outer.reduce((s, q) => s + q.y, 0) / r.outer.length;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

const faceRepPoint = (f: Face): Pt =>
  interiorPoint(
    f.points.map((p) => pt(p[0], p[2])),
    (f.holes ?? []).map((h) => h.map((p) => pt(p[0], p[2]))),
  );

export function buildPaper(
  spec: PaperSpec,
  pattern: CreaseLine[],
  prev?: Paper,
): Paper {
  const lines = [
    ...BORDER.map(([a, b], i) => ({
      id: "border",
      a,
      b,
      border: true,
      order: i,
    })),
    ...pattern.map((l, i) => ({
      id: l.id,
      a: pt(l.a[0], l.a[1]),
      b: pt(l.b[0], l.b[1]),
      border: false,
      order: i + 4,
    })),
  ];
  const arr = buildArrangement(lines);
  const regions: RegionGeom[] = arr.faces.map((r) => {
    const outer = r.outer.map((i) => arr.points[i]!);
    const holes = r.holes.map((h) => h.map((i) => arr.points[i]!));
    return {
      outer,
      holes,
      area:
        polygonArea(outer) +
        holes.reduce((s, h) => s + polygonArea(h), 0),
    };
  });

  // —— 纸面身份继承：旧纸面代表点落在哪个新区域里，就继承它的 id ——
  const ids: (string | null)[] = regions.map(() => null);
  const used = new Set<string>();
  if (prev) {
    for (const f of prev.faces) {
      const at = locateFace(regions, faceRepPoint(f));
      if (!used.has(f.id) && ids[at] === null) {
        ids[at] = f.id;
        used.add(f.id);
      }
    }
  }
  regions.forEach((_, i) => {
    if (ids[i] !== null) return;
    let k = i;
    let id = `f${k}`;
    while (used.has(id)) id = `f${++k}`;
    ids[i] = id;
    used.add(id);
  });

  // —— 逻辑折边：同一折痕在同一对区域之间、且顶点相连的原子边合并为一条。
  //    （区域可能环绕，同一条线在同一对区域间可能出现多段，必须分开。）
  //    记录原子边方向与左右区域，折轴定向完全依据拓扑而非质心猜测。 ——
  interface AtomRef {
    a: number;
    b: number;
    pa: Pt;
    pb: Pt;
  }
  interface HingeDraft {
    crease: string;
    order: number;
    left: number;
    right: number;
    atoms: AtomRef[];
  }
  const hingeMap = new Map<string, HingeDraft>();
  for (const e of arr.edges) {
    if (e.border) continue;
    const left = arr.faceOf.get(`${e.a}_${e.b}`) ?? -1;
    const right = arr.faceOf.get(`${e.b}_${e.a}`) ?? -1;
    if (left < 0 || right < 0 || left === right) continue;
    const key = `${e.line}|${left}|${right}`;
    const pa = arr.points[e.a]!;
    const pb = arr.points[e.b]!;
    if (!hingeMap.has(key))
      hingeMap.set(key, {
        crease: e.line,
        order: e.order,
        left,
        right,
        atoms: [],
      });
    hingeMap.get(key)!.atoms.push({ a: e.a, b: e.b, pa, pb });
  }
  // 组内按共享顶点拆成连通段，每段一条折边
  interface HingeGeom {
    crease: string;
    order: number;
    left: number;
    right: number;
    a: Pt;
    b: Pt;
  }
  const hingeList: HingeGeom[] = [];
  for (const g of hingeMap.values()) {
    const uf = g.atoms.map((_, i) => i);
    const find2 = (i: number): number => {
      while (uf[i] !== i) {
        uf[i] = uf[uf[i]!]!;
        i = uf[i]!;
      }
      return i;
    };
    const byVertex = new Map<number, number>();
    g.atoms.forEach((atom, i) => {
      for (const v of [atom.a, atom.b]) {
        const j = byVertex.get(v);
        if (j === undefined) byVertex.set(v, i);
        else {
          const ri = find2(i);
          const rj = find2(j);
          if (ri !== rj) uf[ri] = rj;
        }
      }
    });
    const runs = new Map<number, AtomRef[]>();
    g.atoms.forEach((atom, i) => {
      const r = find2(i);
      if (!runs.has(r)) runs.set(r, []);
      runs.get(r)!.push(atom);
    });
    for (const atoms of runs.values()) {
      const dir = {
        x: atoms[0]!.pb.x - atoms[0]!.pa.x,
        y: atoms[0]!.pb.y - atoms[0]!.pa.y,
      };
      const pts: Pt[] = [];
      for (const atom of atoms)
        for (const p of [atom.pa, atom.pb])
          if (!pts.some((q) => q.x === p.x && q.y === p.y)) pts.push(p);
      let a = pts[0]!;
      let b = pts[0]!;
      let bd = -1;
      for (const p of pts)
        for (const q of pts) {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d > bd) {
            bd = d;
            a = p;
            b = q;
          }
        }
      if ((b.x - a.x) * dir.x + (b.y - a.y) * dir.y < 0) {
        const t = a;
        a = b;
        b = t;
      }
      hingeList.push({
        crease: g.crease,
        order: g.order,
        left: g.left,
        right: g.right,
        a,
        b,
      });
    }
  }
  hingeList.sort(
    (u, v) =>
      u.order - v.order ||
      Math.min(u.left, u.right) - Math.min(v.left, v.right) ||
      Math.max(u.left, u.right) - Math.max(v.left, v.right),
  );

  // —— 折叠生成树：按绘制顺序并查集，先画的折痕优先进树；其余保留为闭环约束边 ——
  const parent = regions.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const treeFlag = hingeList.map(() => false);
  hingeList.forEach((h, i) => {
    const ra = find(h.left);
    const rb = find(h.right);
    if (ra !== rb) {
      parent[ra] = rb;
      treeFlag[i] = true;
    }
  });

  // —— 根纸面：沿用旧根所在区域，否则用 rootAt 提示，否则取面积最大者 ——
  let rootIdx = 0;
  if (prev) {
    const prevRoot = prev.faces.find((f) => f.id === prev.root);
    rootIdx = locateFace(
      regions,
      prevRoot ? faceRepPoint(prevRoot) : { x: 0, y: 0 },
    );
  } else if (spec.rootAt) {
    rootIdx = locateFace(regions, { x: spec.rootAt[0], y: spec.rootAt[1] });
  } else {
    regions.forEach((r, i) => {
      if (r.area > regions[rootIdx]!.area) rootIdx = i;
    });
  }

  // —— BFS 确定父子关系 ——
  const treeAdj = new Map<number, { to: number; hinge: number }[]>();
  hingeList.forEach((h, i) => {
    if (!treeFlag[i]) return;
    for (const [u, v] of [
      [h.left, h.right],
      [h.right, h.left],
    ] as const) {
      if (!treeAdj.has(u)) treeAdj.set(u, []);
      treeAdj.get(u)!.push({ to: v, hinge: i });
    }
  });
  const bfsParent = new Map<number, { from: number; hinge: number }>();
  const queue = [rootIdx];
  const seen = new Set([rootIdx]);
  while (queue.length) {
    const u = queue.shift()!;
    for (const e of treeAdj.get(u) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      bfsParent.set(e.to, { from: u, hinge: e.hinge });
      queue.push(e.to);
    }
  }

  // —— 组装折边：树折边定向为子区域在轴正向左侧（与预设纸同一套符号约定） ——
  const hinges: HingeInfo[] = hingeList.map((h, i) => {
    const tree = treeFlag[i]!;
    let child = h.left;
    if (tree) child = bfsParent.get(h.left)?.hinge === i ? h.left : h.right;
    else child = h.right;
    const flip = child !== h.left;
    const a = flip ? h.b : h.a;
    const b = flip ? h.a : h.b;
    const parentIdx = tree
      ? child === h.left
        ? h.right
        : h.left
      : h.left;
    return {
      id: `h${i}`,
      crease: h.crease,
      faces: [ids[parentIdx]!, ids[child]!],
      a: to3(a),
      b: to3(b),
      tree,
    };
  });

  // —— 组装纸面（外边界逆时针，孔洞顺时针，y=0 平面） ——
  const faces: Face[] = regions.map((r, i) => {
    const id = ids[i]!;
    const par = bfsParent.get(i);
    const face: Face = {
      id,
      points: r.outer.map(to3),
      holes: r.holes.map((h) => h.map(to3)),
    };
    if (par) {
      const h = hinges[par.hinge]!;
      face.parent = ids[par.from]!;
      face.crease = h.crease;
      face.hinge = [h.a, h.b];
    }
    return face;
  });

  const creases = pattern.map((l) => {
    const mine = hinges.filter((h) => h.crease === l.id);
    const rep = mine.find((h) => h.tree) ?? mine[0];
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      target: l.target,
      face: rep ? rep.faces[1] : (ids[rootIdx] ?? "f0"),
    };
  });

  return {
    id: spec.id,
    name: spec.name,
    subtitle: spec.subtitle,
    size: spec.size,
    faces,
    creases,
    pattern,
    hinges,
    root: ids[rootIdx]!,
    rootAt: spec.rootAt,
  };
}
