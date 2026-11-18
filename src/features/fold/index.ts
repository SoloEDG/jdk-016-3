export { default as FoldPanel } from "./ui/FoldPanel.vue";
export { solvePose } from "./lib/kinematics";
export { hingeSegments, closureAnalysis } from "./lib/closure";
export type { HingeSeg, ClosureInfo } from "./lib/closure";
export { changeAngle, flatten, applyTarget } from "./model/folding";
