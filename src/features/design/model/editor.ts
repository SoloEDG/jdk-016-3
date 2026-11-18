/**
 * 折痕设计模式的编辑会话：
 * 绘制即时重建纸面用于预览，正式提交时才把新折痕追加进步骤序列；
 * 取消则整体回滚到进入设计模式前的快照，作品不受损。
 */
import type { Document, P2, Paper, Step } from "../../../shared/types";
import { appendCreaseSteps } from "../../sequence/lib/steps";
import { buildPaper, type PaperSpec } from "../lib/build";
import { MIN_SEG, SNAP, pt, dist, type Pt } from "../lib/cp2d";

interface Snapshot {
  paper: Paper;
  angles: Record<string, number>;
  directions: Record<string, number>;
  selected: string;
  steps: Step[];
  step: number;
}

let snapshot: Snapshot | null = null;
/** 本次设计会话新增的折痕 id（用于提交时追加步骤、撤销时回退） */
let added: string[] = [];
/** 会话内单调递增的折痕编号，保证 id 不复用（旧步骤引用永不串线） */
let seq = 0;

const specOf = (p: Paper): PaperSpec => ({
  id: p.id,
  name: p.name,
  subtitle: p.subtitle,
  size: p.size,
  rootAt: p.rootAt,
});

export function enterDesign(doc: Document) {
  if (doc.mode === "design") return;
  snapshot = {
    paper: doc.paper,
    angles: { ...doc.angles },
    directions: { ...doc.directions },
    selected: doc.selected,
    steps: doc.steps.map((s) => ({ ...s, angles: { ...s.angles } })),
    step: doc.step,
  };
  added = [];
  doc.playing = false;
  doc.mode = "design";
}

/**
 * 退出设计模式。restore=true 回滚到快照（取消）；
 * restore=false 保留当前纸面（提交或切换纸张时丢弃快照）。
 */
export function exitDesign(doc: Document, restore: boolean) {
  if (doc.mode !== "design") return;
  if (restore && snapshot) {
    doc.paper = snapshot.paper;
    doc.angles = snapshot.angles;
    doc.directions = snapshot.directions;
    doc.selected = snapshot.selected;
    doc.steps = snapshot.steps;
    doc.step = snapshot.step;
  }
  snapshot = null;
  added = [];
  doc.mode = "fold";
}

/** 正式提交：为本次会话新增的折痕追加步骤；当前折叠角度保持不变 */
export function finishDesign(doc: Document): number {
  if (doc.mode !== "design") return 0;
  const ids = added.filter((id) =>
    doc.paper.creases.some((c) => c.id === id),
  );
  snapshot = null;
  added = [];
  doc.mode = "fold";
  if (ids.length) {
    appendCreaseSteps(doc, ids);
    doc.selected = ids[ids.length - 1]!;
  }
  return ids.length;
}

/** 吸附：纸角/折痕端点 > 到折痕或边界的垂足 > 原位置（并夹取到纸面内） */
export function snapPoint(paper: Paper, p: P2): P2 {
  const clamped: Pt = {
    x: Math.min(1, Math.max(-1, p[0])),
    y: Math.min(1, Math.max(-1, p[1])),
  };
  const ends: Pt[] = [
    pt(-1, -1),
    pt(1, -1),
    pt(1, 1),
    pt(-1, 1),
    ...paper.hinges.flatMap((h) => [
      pt(h.a[0]!, h.a[2]!),
      pt(h.b[0]!, h.b[2]!),
    ]),
  ];
  let best: Pt | null = null;
  let bd = SNAP;
  for (const e of ends) {
    const d = dist(e, clamped);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (best) return [best.x, best.y];
  const segs: [Pt, Pt][] = [
    [pt(-1, -1), pt(1, -1)],
    [pt(1, -1), pt(1, 1)],
    [pt(1, 1), pt(-1, 1)],
    [pt(-1, 1), pt(-1, -1)],
    ...paper.hinges.map(
      (h) =>
        [pt(h.a[0]!, h.a[2]!), pt(h.b[0]!, h.b[2]!)] as [Pt, Pt],
    ),
  ];
  for (const [a, b] of segs) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) continue;
    const t = Math.min(
      1,
      Math.max(0, ((clamped.x - a.x) * dx + (clamped.y - a.y) * dy) / len2),
    );
    const foot = pt(a.x + t * dx, a.y + t * dy);
    const d = dist(foot, clamped);
    if (d < bd) {
      bd = d;
      best = foot;
    }
  }
  return best ? [best.x, best.y] : [clamped.x, clamped.y];
}

export interface EditResult {
  ok: boolean;
  message: string;
}

/** 绘制一条折痕：吸附 -> 校验 -> 重建纸面（即时预览），角度/步骤保持兼容 */
export function drawSegment(doc: Document, pa: P2, pb: P2): EditResult {
  const a = snapPoint(doc.paper, pa);
  const b = snapPoint(doc.paper, pb);
  if (dist(pt(a[0], a[1]), pt(b[0], b[1])) < MIN_SEG)
    return { ok: false, message: "线段太短，已忽略（请画出更长的折痕）" };
  seq += 1;
  const id = `u${seq}`;
  const no = doc.paper.pattern.length + 1;
  const line = {
    id,
    name: `自定义折痕 ${String(no).padStart(2, "0")}`,
    description: "在展开图上绘制的新折痕，可随步骤序列逐折成形。",
    target: 90,
    a,
    b,
  };
  const pattern = [...doc.paper.pattern, line];
  const paper = buildPaper(specOf(doc.paper), pattern, doc.paper);
  if (!paper.hinges.some((h) => h.crease === id))
    return {
      ok: false,
      message: "折痕需连接纸边或已有折痕，形成完整分割（未生效）",
    };
  doc.paper = paper;
  doc.directions[id] = 1;
  doc.selected = id;
  added.push(id);
  return { ok: true, message: `已添加「${line.name}」，纸面切分为 ${paper.faces.length} 片` };
}

/** 删除一条折痕并重建；其角度记录从当前姿态移除（历史步骤不受影响） */
export function removeCreaseLine(doc: Document, id: string): EditResult {
  const line = doc.paper.pattern.find((l) => l.id === id);
  if (!line) return { ok: false, message: "没有找到这条折痕" };
  const pattern = doc.paper.pattern.filter((l) => l.id !== id);
  doc.paper = buildPaper(specOf(doc.paper), pattern, doc.paper);
  delete doc.angles[id];
  delete doc.directions[id];
  added = added.filter((x) => x !== id);
  if (doc.selected === id)
    doc.selected = doc.paper.creases[0]?.id ?? "";
  return { ok: true, message: `已删除「${line.name}」` };
}

/** 撤销本次会话中最近一笔绘制 */
export function undoDraw(doc: Document): EditResult {
  const last = added[added.length - 1];
  if (!last) return { ok: false, message: "本次设计还没有可撤销的绘制" };
  return removeCreaseLine(doc, last);
}
