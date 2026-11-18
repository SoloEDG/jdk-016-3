import type { Paper, PoseFace, Vec3 } from "../../../shared/types";
import { rotate, sub, cross, unit } from "../../../shared/vector";
type Transform = (p: Vec3) => Vec3;
/** 法向：跳过共线顶点（T 型交界会在纸面边界上留下 180° 顶点） */
function faceNormal(points: Vec3[]): Vec3 {
  for (let i = 0; i + 2 < points.length; i++) {
    const n = cross(
      sub(points[i + 1]!, points[i]!),
      sub(points[i + 2]!, points[i]!),
    );
    if (Math.hypot(...n) > 1e-9) return unit(n);
  }
  return [0, 1, 0];
}
export function solvePose(
  paper: Paper,
  angles: Record<string, number>,
): PoseFace[] {
  const transforms = new Map<string, Transform>(),
    pending = [...paper.faces],
    result: PoseFace[] = [];
  while (pending.length) {
    const i = pending.findIndex((f) => !f.parent || transforms.has(f.parent));
    if (i < 0) throw new Error("纸面连接关系不能成环");
    const f = pending.splice(i, 1)[0]!;
    const parent: Transform = f.parent ? transforms.get(f.parent)! : (p) => p;
    let transform = parent;
    if (f.hinge && f.crease) {
      const a = parent(f.hinge[0]),
        b = parent(f.hinge[1]),
        angle = angles[f.crease] ?? 0;
      transform = (p) => rotate(parent(p), a, b, angle);
    }
    transforms.set(f.id, transform);
    const points = f.points.map(transform);
    result.push({
      id: f.id,
      points,
      holes: f.holes.map((h) => h.map(transform)),
      normal: faceNormal(points),
    });
  }
  return result;
}
