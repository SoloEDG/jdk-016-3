export { default as DesignCanvas } from "./ui/DesignCanvas.vue";
export { default as DesignPanel } from "./ui/DesignPanel.vue";
export {
  enterDesign,
  exitDesign,
  finishDesign,
  drawSegment,
  removeCreaseLine,
  undoDraw,
  snapPoint,
} from "./model/editor";
export { buildPaper } from "./lib/build";
