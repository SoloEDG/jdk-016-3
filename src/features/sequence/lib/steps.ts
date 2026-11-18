import type { Document, Paper, Step } from "../../../shared/types";
export function makeSteps(paper: Paper): Step[] {
  const angles: Record<string, number> = {};
  return [
    {
      id: "flat",
      title: "准备纸张",
      note: "将纸张正面朝上，观察预设折痕。",
      angles: {},
      duration: 1000,
    },
    ...paper.creases.map((c, i) => {
      angles[c.id] = c.target;
      return {
        id: "step-" + i,
        title: c.name,
        note: c.description,
        angles: { ...angles },
        duration: 1600,
      };
    }),
  ];
}
/**
 * 为新提交的折痕追加步骤：以最后一个步骤的角度为基础累积，
 * 既有步骤保持原样（未出现的折痕按 0° 处理，未切分区域形态不变）。
 */
export function appendCreaseSteps(doc: Document, creaseIds: string[]) {
  const acc: Record<string, number> = {
    ...(doc.steps[doc.steps.length - 1]?.angles ?? {}),
  };
  for (const id of creaseIds) {
    const c = doc.paper.creases.find((c) => c.id === id);
    if (!c) continue;
    acc[id] = c.target;
    doc.steps.push({
      id: `step-${doc.steps.length}-${id}`,
      title: c.name,
      note: c.description,
      angles: { ...acc },
      duration: 1600,
    });
  }
}
export function interpolate(
  a: Record<string, number>,
  b: Record<string, number>,
  t: number,
) {
  const ease = t * t * (3 - 2 * t);
  return Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [
      k,
      (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * ease,
    ]),
  );
}
