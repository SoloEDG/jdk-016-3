<script setup lang="ts">
import type { Document } from "../../../shared/types";
import type { ClosureInfo } from "../../fold/lib/closure";

const props = defineProps<{ doc: Document; analysis: ClosureInfo }>();
defineEmits<{
  finish: [];
  cancel: [];
  undo: [];
  remove: [id: string];
}>();

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
  <section class="panel design-panel">
    <div class="section-heading">
      <span>02 / 折痕设计</span><small>DESIGN</small>
    </div>
    <p class="muted">
      在中间展开图上点击两点画出折痕，纸面会立即切分。折痕可从纸边连到已有折痕，端点自动吸附。
    </p>
    <div class="design-stats">
      <span
        ><b>{{ doc.paper.pattern.length }}</b>折痕</span
      ><span
        ><b>{{ doc.paper.faces.length }}</b>纸面</span
      ><span
        ><b>{{ analysis.constrained.size }}</b>闭环约束</span
      >
    </div>
    <div v-if="doc.paper.pattern.length" class="seg-list">
      <div v-for="(l, i) in doc.paper.pattern" :key="l.id" class="seg-row">
        <span class="crease-num">{{ String(i + 1).padStart(2, "0") }}</span>
        <span class="seg-name"
          ><b>{{ l.name }}</b></span
        >
        <span :class="roleClass(l.id)">{{ roleOf(l.id) }}</span>
        <button
          class="seg-del"
          :title="'删除 ' + l.name"
          :aria-label="'删除 ' + l.name"
          @click="$emit('remove', l.id)"
        >
          ×
        </button>
      </div>
    </div>
    <p v-else class="muted small">还没有折痕。从空白处或纸边开始画第一笔。</p>
    <div class="design-actions">
      <button class="text-button" @click="$emit('undo')">↩ 撤销上一笔</button>
    </div>
    <button class="primary full" @click="$emit('finish')">
      完成并生成步骤 <span>↗</span>
    </button>
    <button class="text-button cancel-design" @click="$emit('cancel')">
      放弃本次绘制
    </button>
    <div class="tip">
      <span>⌁</span>
      <p>形成闭环的折痕会标注「闭环约束」，<br />其折角由相邻折痕联动决定</p>
    </div>
  </section>
</template>
