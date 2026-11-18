import type { Vec3, View } from "../../../shared/types";
export function cameraPoint(p: Vec3, view: View): Vec3 {
  const a = (view.yaw * Math.PI) / 180,
    b = (view.pitch * Math.PI) / 180,
    x = p[0] * Math.cos(a) - p[2] * Math.sin(a),
    z = p[0] * Math.sin(a) + p[2] * Math.cos(a);
  return [
    x,
    p[1] * Math.cos(b) - z * Math.sin(b),
    p[1] * Math.sin(b) + z * Math.cos(b),
  ];
}
export function project(p: Vec3, view: View) {
  const c = cameraPoint(p, view);
  return {
    x: 400 + c[0] * 145 * view.zoom,
    y: 280 - c[1] * 145 * view.zoom,
    z: c[2],
  };
}
export function polygon(points: Vec3[], view: View) {
  return points
    .map((p) => {
      const v = project(p, view);
      return `${v.x},${v.y}`;
    })
    .join(" ");
}
/** 外边界 + 孔洞环合并为一条 SVG path（配合 fill-rule="evenodd" 渲染环形纸面） */
export function facePath(points: Vec3[], holes: Vec3[][], view: View) {
  const loop = (pts: Vec3[]) =>
    pts
      .map((p, i) => {
        const v = project(p, view);
        return `${i === 0 ? "M" : "L"}${v.x.toFixed(2)},${v.y.toFixed(2)}`;
      })
      .join(" ") + " Z";
  return [loop(points), ...holes.map(loop)].join(" ");
}
