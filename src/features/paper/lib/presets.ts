import type { CreaseLine, P2, Paper } from "../../../shared/types";
import { buildPaper, type PaperSpec } from "../../design/lib/build";

function line(
  id: string,
  a: P2,
  b: P2,
  name: string,
  description: string,
  target: number,
): CreaseLine {
  return { id, a, b, name, description, target };
}

/** 两款预设共用同一组扇形折痕图案（从纸角出发的三道折痕） */
function fan(
  c1: [string, string, number],
  c2: [string, string, number],
  c3: [string, string, number],
): CreaseLine[] {
  return [
    line("c1", [-1, -1], [1, 0], ...c1),
    line("c2", [-1, -1], [1, 1], ...c2),
    line("c3", [-1, -1], [0, 1], ...c3),
  ];
}

const specs: [PaperSpec, CreaseLine[]][] = [
  [
    {
      id: "shelter",
      name: "纸之庭",
      subtitle: "立体空间 · 3 道折痕",
      size: 200,
      rootAt: [0.5, -0.6],
    },
    fan(
      ["侧翼斜折", "沿第一条斜折线抬起纸面，后续纸面随动。", 75],
      ["对角深折", "沿正方形对角线继续折叠，形成开放的空间。", 65],
      ["侧翼回折", "在已经转动的纸面上收拢最后一翼。", -80],
    ),
  ],
  [
    {
      id: "ribbon",
      name: "山谷回廊",
      subtitle: "连续折叠 · 3 道折痕",
      size: 180,
      rootAt: [0.5, -0.6],
    },
    fan(
      ["第一道山脊", "右侧相邻纸面围绕中轴旋转。", 110],
      ["入口谷折", "左前翼向下展开。", -55],
      ["回廊转角", "末端纸面沿局部折轴回转。", 100],
    ),
  ],
  [
    {
      id: "blank",
      name: "空白纸",
      subtitle: "自由绘制 · 0 道折痕",
      size: 200,
    },
    [],
  ],
];

export const papers: Paper[] = specs.map(([spec, pattern]) =>
  buildPaper(spec, pattern),
);

export const swatches = [
  { name: "柿子", front: "#e88459", back: "#f8dec2" },
  { name: "苔绿", front: "#718c79", back: "#dce6cf" },
  { name: "雾蓝", front: "#7496ac", back: "#d8e5eb" },
  { name: "紫藤", front: "#ad8fb1", back: "#eadfea" },
  { name: "米白", front: "#e8d6b5", back: "#fff7e8" },
];
