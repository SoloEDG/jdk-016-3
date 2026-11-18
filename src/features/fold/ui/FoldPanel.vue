<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "../../../shared/types";
import type { ClosureInfo } from "../lib/closure";
import { angleHint } from "../lib/angle";
defineEmits<{ angle: [value: number]; direction: []; target: [] }>();
const p = defineProps<{ doc: Document; analysis: ClosureInfo }>();
const angle = computed(() => p.doc.angles[p.doc.selected] ?? 0);
const none = computed(() => p.doc.paper.creases.length === 0);
/** 完全受闭环约束的折痕（没有可驱动的树折边） */
const locked = computed(
  () =>
    p.doc.selected !== "" && !p.analysis.treeCreases.has(p.doc.selected),
);
const conflict = computed(() =>
  p.analysis.conflictCreases.has(p.doc.selected),
);
const partial = computed(
  () =>
    !locked.value &&
    p.analysis.constrained.has(p.doc.selected),
);
const chordAngle = computed(
  () => p.analysis.chordAngle[p.doc.selected] ?? 0,
);
const gapMm = computed(() => {
  let g = 0;
  for (const h of p.doc.paper.hinges)
    if (h.crease === p.doc.selected && p.analysis.conflictHinges.has(h.id))
      g = Math.max(g, p.analysis.gaps[h.id] ?? 0);
  return ((g * p.doc.paper.size) / 2).toFixed(1);
});
</script>
<template>
  <section class="panel fold-panel">
    <div class="section-heading"><span>折叠控制</span><small>FOLD</small></div>
    <p v-if="none" class="muted small">
      这张纸还没有折痕。在左侧进入「绘制自定义折痕」，画出第一笔后再来折叠。
    </p>
    <template v-else-if="!locked">
      <div class="angle-display">
        <strong>{{ angle.toFixed(0) }}<sup>°</sup></strong
        ><span>{{ angleHint(angle) }}</span>
      </div>
      <input
        aria-label="折叠角度"
        type="range"
        min="-175"
        max="175"
        :value="angle"
        @input="
          $emit('angle', Number(($event.target as HTMLInputElement).value))
        "
      />
      <div class="range-labels">
        <span>−175°</span><span>0°</span><span>175°</span>
      </div>
      <div class="angle-presets">
        <button
          v-for="a in [0, 45, 90, 135]"
          :key="a"
          @click="$emit('angle', a)"
        >
          {{ a }}°
        </button>
      </div>
      <div class="line-label">
        <label>折叠方向</label
        ><button class="text-button" @click="$emit('direction')">
          {{ (doc.directions[doc.selected] ?? 1) > 0 ? "谷折 ↗" : "山折 ↘" }} ⇄
        </button>
      </div>
      <button class="primary full" @click="$emit('target')">
        折至建议角度 <span>↗</span>
      </button>
      <p v-if="conflict" class="conflict-banner">
        闭环在此无法闭合，缝隙约 {{ gapMm }} mm。<br />请调整相关折角或回到平展。
      </p>
      <p v-else-if="partial" class="loop-note">
        此折痕部分区段受闭环约束，转动时请注意相邻折痕的联动。
      </p>
      <p v-else class="muted small">关联纸面将随当前折痕一起转动。</p>
    </template>
    <template v-else>
      <div class="angle-display">
        <strong>{{ chordAngle.toFixed(0) }}<sup>°</sup></strong
        ><span>等效折角 · 由相邻折痕决定</span>
      </div>
      <p class="loop-note">
        这条折痕处在闭合环路中，不能独立转动；请调整同一环路上的其他折痕。
      </p>
      <p v-if="conflict" class="conflict-banner">
        当前环路无法闭合，缝隙约 {{ gapMm }} mm。
      </p>
    </template>
  </section>
</template>
