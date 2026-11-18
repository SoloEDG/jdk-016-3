<script setup lang="ts">
import type { Document } from "../../../shared/types";
import type { ClosureInfo } from "../../fold/lib/closure";
import { creaseProgress } from "../lib/availability";
const props = defineProps<{ doc: Document; analysis: ClosureInfo }>();
defineEmits<{ select: [id: string] }>();
function roleOf(id: string): string {
  const p = props;
  if (p.analysis.conflictCreases.has(id)) return "冲突";
  if (p.analysis.constrained.has(id))
    return p.analysis.treeCreases.has(id) ? "部分闭环" : "闭环约束";
  return "独立";
}
function roleClass(id: string): string {
  if (props.analysis.conflictCreases.has(id)) return "badge conflict";
  if (props.analysis.constrained.has(id)) return "badge loop";
  return "badge free";
}
</script>
<template>
  <section class="panel">
    <div class="section-heading">
      <span>02 / 折痕</span><small>CREASES</small>
    </div>
    <p class="muted">选择一条折痕，开始塑造纸的空间。</p>
    <button
      v-for="(c, i) in doc.paper.creases"
      :key="c.id"
      class="crease-row"
      :class="{ active: doc.selected === c.id }"
      @click="$emit('select', c.id)"
    >
      <span class="crease-num">{{ String(i + 1).padStart(2, "0") }}</span
      ><span class="crease-name"
        ><b
          >{{ c.name }} <em :class="roleClass(c.id)">{{ roleOf(c.id) }}</em></b
        ><small
          >{{ (doc.angles[c.id] ?? 0).toFixed(0) }}° ·
          {{ (doc.directions[c.id] ?? 1) > 0 ? "谷折" : "山折" }}</small
        ><i :style="{ width: creaseProgress(doc, c.id) + '%' }"></i></span
      ><span>↗</span>
    </button>
    <p v-if="!doc.paper.creases.length" class="muted small">
      这张纸还没有折痕，点击左侧「绘制自定义折痕」开始设计。
    </p>
    <div class="tip">
      <span>⌁</span>
      <p>也可以直接点击纸张上的虚线<br />选择对应折痕</p>
    </div>
  </section>
</template>
