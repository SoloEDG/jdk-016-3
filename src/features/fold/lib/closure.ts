/**
 * 闭环约束分析：折叠生成树之外的折边（弦）不驱动任何纸面，
 * 这里负责检查它们在当前姿态下是否仍然闭合。
 * 不可行时只标记冲突区域（构成环路的纸面与折痕），绝不修改纸张数据。
 */
import type { Paper, PoseFace, Vec3 } from "../../../shared/types";
import { dot } from "../../../shared/vector";

/** 闭环缝隙容差（纸张半宽为 1）：小于此值视为仍然闭合 */
export const CLOSURE_EPS = 0.02;

export interface HingeSeg {
  id: string;
  crease: string;
  tree: boolean;
  a: Vec3;
  b: Vec3;
  /** 闭环弦在另一侧纸面上的像（闭合时与 a/b 重合） */
  a2?: Vec3;
  b2?: Vec3;
}

export interface ClosureInfo {
  /** 拥有树折边的折痕（可独立驱动） */
  treeCreases: Set<string>;
  /** 含闭环约束边的折痕 */
  constrained: Set<string>;
  /** 闭合检查失败的折痕 */
  conflictCreases: Set<string>;
  /** 闭合检查失败的折边 id */
  conflictHinges: Set<string>;
  /** 冲突环路经过的全部纸面 */
  conflictFaces: Set<string>;
  /** 折边 id -> 缝隙宽度 */
  gaps: Record<string, number>;
  /** 闭环折痕 id -> 当前等效折角（度，由相邻纸面法向推算） */
  chordAngle: Record<string, number>;
}

/** 纸面某平面顶点在当前姿态下的位置 */
function posedVertex(
  paper: Paper,
  pose: PoseFace[],
  faceId: string,
  flat: Vec3,
): Vec3 {
  const base = paper.faces.find((f) => f.id === faceId);
  const pf = pose.find((f) => f.id === faceId);
  if (!base || !pf) return flat;
  const all = [...base.points, ...base.holes.flat()];
  const posed = [...pf.points, ...pf.holes.flat()];
  let best = 0;
  let bd = Infinity;
  all.forEach((p, i) => {
    const d = Math.abs(p[0] - flat[0]) + Math.abs(p[2] - flat[2]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return posed[best]!;
}

/** 全部逻辑折边的显示线段（树折边取子面姿态，闭环弦取两侧姿态） */
export function hingeSegments(paper: Paper, pose: PoseFace[]): HingeSeg[] {
  return paper.hinges.map((h) => {
    if (h.tree) {
      return {
        id: h.id,
        crease: h.crease,
        tree: true,
        a: posedVertex(paper, pose, h.faces[1], h.a),
        b: posedVertex(paper, pose, h.faces[1], h.b),
      };
    }
    return {
      id: h.id,
      crease: h.crease,
      tree: false,
      a: posedVertex(paper, pose, h.faces[0], h.a),
      b: posedVertex(paper, pose, h.faces[0], h.b),
      a2: posedVertex(paper, pose, h.faces[1], h.a),
      b2: posedVertex(paper, pose, h.faces[1], h.b),
    };
  });
}

/** 生成树邻接表 + 根到各面的父指针 */
function treeParents(paper: Paper): Map<string, string> {
  const adj = new Map<string, string[]>();
  for (const h of paper.hinges) {
    if (!h.tree) continue;
    const [u, v] = h.faces;
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push(v);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(v)!.push(u);
  }
  const parent = new Map<string, string>();
  const queue = [paper.root];
  const seen = new Set(queue);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (seen.has(v)) continue;
      seen.add(v);
      parent.set(v, u);
      queue.push(v);
    }
  }
  return parent;
}

/** 生成树上两面之间的路径（含端点），即闭环弦的基本环路 */
function treePath(parent: Map<string, string>, a: string, b: string): string[] {
  const anc = new Set<string>();
  let x: string | undefined = a;
  while (x !== undefined) {
    anc.add(x);
    x = parent.get(x);
  }
  const out: string[] = [];
  let y: string | undefined = b;
  while (y !== undefined && !anc.has(y)) {
    out.push(y);
    y = parent.get(y);
  }
  const lca = y;
  let z: string | undefined = a;
  while (z !== undefined && z !== lca) {
    out.push(z);
    z = parent.get(z);
  }
  if (lca !== undefined) out.push(lca);
  return out;
}

const dist3 = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function closureAnalysis(paper: Paper, pose: PoseFace[]): ClosureInfo {
  const treeCreases = new Set<string>();
  const constrained = new Set<string>();
  const conflictCreases = new Set<string>();
  const conflictHinges = new Set<string>();
  const conflictFaces = new Set<string>();
  const gaps: Record<string, number> = {};
  const chordAngle: Record<string, number> = {};
  for (const h of paper.hinges)
    (h.tree ? treeCreases : constrained).add(h.crease);

  const parent = treeParents(paper);
  const normalOf = new Map(pose.map((f) => [f.id, f.normal]));

  for (const h of paper.hinges) {
    if (h.tree) continue;
    const [f1, f2] = h.faces;
    const a1 = posedVertex(paper, pose, f1, h.a);
    const a2 = posedVertex(paper, pose, f2, h.a);
    const b1 = posedVertex(paper, pose, f1, h.b);
    const b2 = posedVertex(paper, pose, f2, h.b);
    const gap = Math.max(dist3(a1, a2), dist3(b1, b2));
    gaps[h.id] = gap;
    const n1 = normalOf.get(f1);
    const n2 = normalOf.get(f2);
    if (n1 && n2) {
      const cos = Math.min(1, Math.max(-1, dot(n1, n2)));
      const deg = (Math.acos(cos) * 180) / Math.PI;
      chordAngle[h.crease] = Math.max(
        chordAngle[h.crease] ?? 0,
        Math.round(deg * 10) / 10,
      );
    }
    if (gap > CLOSURE_EPS) {
      conflictCreases.add(h.crease);
      conflictHinges.add(h.id);
      for (const f of treePath(parent, f1, f2)) conflictFaces.add(f);
    }
  }
  return {
    treeCreases,
    constrained,
    conflictCreases,
    conflictHinges,
    conflictFaces,
    gaps,
    chordAngle,
  };
}
