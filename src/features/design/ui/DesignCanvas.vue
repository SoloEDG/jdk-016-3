<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import type { Document, P2, Vec3 } from "../../../shared/types";
import type { ClosureInfo } from "../../fold/lib/closure";
import { snapPoint } from "../model/editor";

const props = defineProps<{ doc: Document; analysis: ClosureInfo }>();
const emit = defineEmits<{ draw: [a: P2, b: P2] }>();

const CX = 400,
  CY = 280,
  S = 215;
const sx = (x: number) => CX + x * S;
const sy = (z: number) => CY + z * S;
/** 外边界 + 孔洞环合并为一条 path（evenodd 渲染环形纸面） */
const facePath = (points: Vec3[], holes: Vec3[][]) => {
  const loop = (pts: Vec3[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p[0])},${sy(p[2])}`)
      .join(" ") + " Z";
  return [loop(points), ...holes.map(loop)].join(" ");
};

const start = ref<P2 | null>(null);
const cursor = ref<P2 | null>(null);

function toPaper(e: PointerEvent): P2 {
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  return [
    (((e.clientX - r.left) / r.width) * 800 - CX) / S,
    (((e.clientY - r.top) / r.height) * 560 - CY) / S,
  ];
}
function move(e: PointerEvent) {
  cursor.value = snapPoint(props.doc.paper, toPaper(e));
}
function down(e: PointerEvent) {
  const p = snapPoint(props.doc.paper, toPaper(e));
  if (!start.value) {
    start.value = p;
  } else {
    emit("draw", start.value, p);
    start.value = null;
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") start.value = null;
}
window.addEventListener("keydown", onKey);
onUnmounted(() => window.removeEventListener("keydown", onKey));

const creaseIndex = computed(
  () => new Map(props.doc.paper.creases.map((c, i) => [c.id, i + 1])),
);
/** 每条折痕只在第一段折边上显示序号 */
const hingeLabels = computed(() => {
  const seen = new Set<string>();
  const map = new Map<string, number>();
  for (const h of props.doc.paper.hinges) {
    if (seen.has(h.crease)) map.set(h.id, 0);
    else {
      seen.add(h.crease);
      map.set(h.id, creaseIndex.value.get(h.crease) ?? 0);
    }
  }
  return map;
});

const vertices = computed(() => {
  const seen = new Set<string>();
  const out: P2[] = [];
  const push = (x: number, z: number) => {
    const k = `${x.toFixed(6)},${z.toFixed(6)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push([x, z]);
  };
  push(-1, -1);
  push(1, -1);
  push(1, 1);
  push(-1, 1);
  for (const h of props.doc.paper.hinges) {
    push(h.a[0], h.a[2]);
    push(h.b[0], h.b[2]);
  }
  return out;
});
</script>

<template>
  <section class="viewport">
    <div class="viewport-top">
      <div class="view-tabs">
        <button class="active">展开图设计</button>
      </div>
      <span class="live"><i></i> 即时预览</span>
    </div>
    <svg
      class="paper-scene design-scene"
      viewBox="0 0 800 560"
      aria-label="展开图折痕设计"
      @pointermove="move"
      @pointerdown="down"
      @pointerleave="cursor = null"
    >
      <rect width="800" height="560" fill="#f6f7f2" />
      <rect
        :x="sx(-1) + 5"
        :y="sy(-1) + 7"
        :width="2 * S"
        :height="2 * S"
        fill="#63705a"
        opacity=".14"
        rx="2"
      />
      <rect
        :x="sx(-1)"
        :y="sy(-1)"
        :width="2 * S"
        :height="2 * S"
        :fill="doc.back"
        stroke="#785945"
        stroke-opacity=".45"
        stroke-width="1.4"
      />
      <path
        v-for="f in doc.paper.faces"
        :key="f.id"
        :d="facePath(f.points, f.holes)"
        fill-rule="evenodd"
        :fill="doc.front"
        :stroke="analysis.conflictFaces.has(f.id) ? '#b4543f' : '#785945'"
        :stroke-opacity="analysis.conflictFaces.has(f.id) ? 0.8 : 0.3"
        stroke-width="1.1"
        stroke-linejoin="round"
      />
      <g>
        <line
          v-for="h in doc.paper.hinges"
          :key="h.id"
          :x1="sx(h.a[0])"
          :y1="sy(h.a[2])"
          :x2="sx(h.b[0])"
          :y2="sy(h.b[2])"
          :stroke="
            h.crease === doc.selected
              ? '#384d3f'
              : h.tree
                ? '#746f57'
                : '#c58a3d'
          "
          :stroke-width="h.crease === doc.selected ? 2.4 : 1.3"
          :stroke-dasharray="h.tree ? '6 4' : '2 4'"
        />
        <g v-for="h in doc.paper.hinges" :key="'t' + h.id">
          <template v-if="hingeLabels.get(h.id)">
            <circle
              :cx="(sx(h.a[0]) + sx(h.b[0])) / 2"
              :cy="(sy(h.a[2]) + sy(h.b[2])) / 2"
              r="10"
              fill="#f7f6ee"
              stroke="#d8dccf"
            />
            <text
              :x="(sx(h.a[0]) + sx(h.b[0])) / 2"
              :y="(sy(h.a[2]) + sy(h.b[2])) / 2 + 3.5"
              text-anchor="middle"
              font-size="10"
              fill="#555"
            >
              {{ hingeLabels.get(h.id) }}
            </text>
          </template>
        </g>
      </g>
      <circle
        v-for="(v, i) in vertices"
        :key="i"
        :cx="sx(v[0])"
        :cy="sy(v[1])"
        r="2.4"
        fill="#8b9683"
      />
      <g v-if="start && cursor">
        <line
          :x1="sx(start[0])"
          :y1="sy(start[1])"
          :x2="sx(cursor[0])"
          :y2="sy(cursor[1])"
          stroke="#384d3f"
          stroke-width="2"
          stroke-dasharray="7 5"
        />
        <circle :cx="sx(start[0])" :cy="sy(start[1])" r="4.5" fill="#384d3f" />
      </g>
      <circle
        v-if="cursor"
        :cx="sx(cursor[0])"
        :cy="sy(cursor[1])"
        r="8"
        fill="none"
        stroke="#384d3f"
        stroke-width="1.4"
        stroke-dasharray="3 3"
      />
      <text
        v-if="!doc.paper.pattern.length"
        x="400"
        y="530"
        text-anchor="middle"
        font-size="11"
        fill="#9aa18f"
      >
        在纸面上点击两个点，画出第一道折痕
      </text>
    </svg>
    <div class="scene-caption">
      <span>点击两点绘制折痕 · 端点自动吸附边缘与交点 · ESC 取消当前线段</span
      ><b
        >{{ doc.paper.pattern.length }} 道折痕 ·
        {{ doc.paper.faces.length }} 个纸面</b
      >
    </div>
  </section>
</template>
