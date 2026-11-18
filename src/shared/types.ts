export type Vec3 = [number, number, number];
/** 展开图二维坐标：[x, z]，纸张为 [-1, 1]² */
export type P2 = [number, number];
export interface Face {
  id: string;
  points: Vec3[];
  /** 孔洞环（闭合折痕包围的内边界），无孔为空数组 */
  holes: Vec3[][];
  parent?: string;
  hinge?: [Vec3, Vec3];
  crease?: string;
}
export interface Crease {
  id: string;
  name: string;
  description: string;
  face: string;
  target: number;
}
/** 用户在展开图上绘制的一条折痕线（携带元数据），是折痕图案的源数据 */
export interface CreaseLine {
  id: string;
  name: string;
  description: string;
  target: number;
  a: P2;
  b: P2;
}
/** 两个纸面之间的一条逻辑折边（可能是一条绘制线被交点切分后的一段） */
export interface HingeInfo {
  id: string;
  crease: string;
  /** 树折边为 [父面, 子面]；闭环弦为相邻两面（顺序确定但无父子含义） */
  faces: [string, string];
  a: Vec3;
  b: Vec3;
  /** true = 在折叠生成树上，可独立驱动；false = 闭环约束边，角度由其他折痕决定 */
  tree: boolean;
}
export interface Paper {
  id: string;
  name: string;
  subtitle: string;
  size: number;
  faces: Face[];
  creases: Crease[];
  /** 展开图折痕图案（源数据，重建纸面的依据） */
  pattern: CreaseLine[];
  /** 全部逻辑折边（含闭环约束边） */
  hinges: HingeInfo[];
  /** 折叠生成树的根纸面 */
  root: string;
  /** 首次构建时的根纸面定位点（展开图坐标） */
  rootAt?: P2;
}
export interface Step {
  id: string;
  title: string;
  note: string;
  angles: Record<string, number>;
  duration: number;
}
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  grid: boolean;
  wire: boolean;
}
export interface Document {
  paper: Paper;
  front: string;
  back: string;
  texture: string;
  selected: string;
  angles: Record<string, number>;
  directions: Record<string, number>;
  steps: Step[];
  step: number;
  playing: boolean;
  speed: number;
  view: View;
  /** fold = 折叠模式；design = 展开图折痕设计模式 */
  mode: "fold" | "design";
}
export interface PoseFace {
  id: string;
  points: Vec3[];
  holes: Vec3[][];
  normal: Vec3;
}
