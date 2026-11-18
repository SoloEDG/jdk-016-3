<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import {
  Layers,
  RotateCcw,
  ArrowUpRight,
  HelpCircle,
  Leaf,
} from "lucide-vue-next";
import { createDocument } from "../shared/document";
import type { P2 } from "../shared/types";
import { PaperPanel, papers, replacePaper } from "../features/paper";
import {
  CreasePanel,
  selectCrease,
  toggleDirection,
  selectedCrease,
} from "../features/creases";
import {
  FoldPanel,
  solvePose,
  hingeSegments,
  closureAnalysis,
  changeAngle,
  flatten,
  applyTarget,
} from "../features/fold";
import {
  SequencePanel,
  makeSteps,
  seek,
  captureStep,
  usePlayer,
} from "../features/sequence";
import { Viewport, ObservePanel, setView } from "../features/observe";
import {
  DesignCanvas,
  DesignPanel,
  enterDesign,
  exitDesign,
  finishDesign,
  drawSegment,
  removeCreaseLine,
  undoDraw,
} from "../features/design";

const doc = reactive(createDocument(papers[0]!, makeSteps(papers[0]!)));
const pose = computed(() => solvePose(doc.paper, doc.angles));
const analysis = computed(() => closureAnalysis(doc.paper, pose.value));
const hinges = computed(() => {
  const seen = new Set<string>();
  return hingeSegments(doc.paper, pose.value).map((h) => {
    let label = 0;
    if (!seen.has(h.crease)) {
      seen.add(h.crease);
      label = doc.paper.creases.findIndex((c) => c.id === h.crease) + 1;
    }
    return { ...h, label };
  });
});
const { toggle } = usePlayer(doc);
const help = ref(false),
  toast = ref("");
function notify(s: string) {
  toast.value = s;
  setTimeout(() => (toast.value = ""), 2400);
}
function choosePaper(id: string) {
  const p = papers.find((p) => p.id === id);
  if (p) {
    exitDesign(doc, false);
    replacePaper(doc, p);
    doc.steps = makeSteps(p);
    setView(doc, "iso");
  }
}
function reset() {
  exitDesign(doc, false);
  flatten(doc);
  doc.steps = makeSteps(doc.paper);
  setView(doc, "iso");
  notify("已回到平展纸张");
}
function capture() {
  captureStep(doc);
  notify("当前形态已保存到步骤 " + (doc.step + 1));
}
function startDesign() {
  enterDesign(doc);
  notify("在展开图上点击两点绘制折痕");
}
function commitDesign() {
  const n = finishDesign(doc);
  notify(
    n
      ? `已提交 ${n} 道新折痕，步骤序列已更新`
      : "没有新的折痕，已返回折叠模式",
  );
}
function abandonDesign() {
  exitDesign(doc, true);
  notify("已放弃本次绘制，纸张恢复原样");
}
function draw(a: P2, b: P2) {
  notify(drawSegment(doc, a, b).message);
}
function removeLine(id: string) {
  notify(removeCreaseLine(doc, id).message);
}
function undoLine() {
  notify(undoDraw(doc).message);
}
const paperAlias = computed(
  () =>
    ({
      shelter: "PAPER GARDEN",
      ribbon: "VALLEY WALK",
      blank: "BLANK SHEET",
    })[doc.paper.id] ?? "CREASE PATTERN",
);
</script>
<template>
  <div class="workspace">
    <header class="topbar">
      <a class="brand" href="#"
        ><span class="brand-mark">◩</span><strong>折间<span>ORI</span></strong
        ><i></i><small>三维折纸工作室</small></a
      >
      <nav>
        <span class="project-indicator"></span> 未命名的纸间探索
        <span class="local-badge">本次会话</span>
      </nav>
      <div class="header-actions">
        <button class="icon-button" aria-label="帮助" @click="help = !help">
          <HelpCircle :size="18" /></button
        ><button class="reset" @click="reset">
          <RotateCcw :size="14" />重新开始</button
        ><button class="primary" @click="seek(doc, doc.steps.length - 1)">
          观察成品 <ArrowUpRight :size="15" />
        </button>
      </div>
    </header>
    <main>
      <div class="page-title">
        <div>
          <div class="eyebrow">THE ART OF FOLDING</div>
          <h1>一张纸，无限可能<span>。</span></h1>
          <p>沿着折痕，让平面生长成空间。</p>
        </div>
        <div class="session-note">
          <Leaf :size="16" /><span>放慢一点，折出自己的节奏。</span>
        </div>
      </div>
      <div class="studio">
        <aside class="left-sidebar">
          <PaperPanel
            :doc="doc"
            @paper="choosePaper"
            @design="startDesign"
          /><CreasePanel
            v-if="doc.mode === 'fold'"
            :doc="doc"
            :analysis="analysis"
            @select="selectCrease(doc, $event)"
          /><DesignPanel
            v-else
            :doc="doc"
            :analysis="analysis"
            @finish="commitDesign"
            @cancel="abandonDesign"
            @undo="undoLine"
            @remove="removeLine"
          />
          <div class="sidebar-footer">
            <Layers :size="13" /> 单张纸 ·
            {{ doc.paper.faces.length }} 个关联纸面
          </div>
        </aside>
        <div class="center">
          <div class="canvas-label">
            <span
              >{{ doc.paper.name }}
              <small>/ {{ paperAlias }}</small></span
            ><span v-if="doc.mode === 'design'" class="difficulty design-mode"
              >折痕设计模式</span
            ><span v-else class="difficulty"
              >入门探索 <i></i><i></i><i class="empty"></i
            ></span>
          </div>
          <DesignCanvas
            v-if="doc.mode === 'design'"
            :doc="doc"
            :analysis="analysis"
            @draw="draw"
          />
          <Viewport
            v-else
            :doc="doc"
            :pose="pose"
            :hinges="hinges"
            :analysis="analysis"
            @select="selectCrease(doc, $event)"
          />
          <div v-if="doc.mode === 'design'" class="instruction">
            <span class="instruction-number">✎</span>
            <div>
              <b>折痕设计模式</b>
              <p>
                新折痕会实时切分纸面并继承双面材质；提交后自动生成对应折叠步骤，取消则恢复原样。
              </p>
            </div>
            <span class="step-count"
              >{{ doc.paper.pattern.length }} 道折痕</span
            >
          </div>
          <div v-else class="instruction">
            <span class="instruction-number">0{{ doc.step + 1 }}</span>
            <div>
              <b>{{ doc.steps[doc.step]?.title }}</b>
              <p>{{ doc.steps[doc.step]?.note }}</p>
            </div>
            <span class="step-count"
              >{{ doc.step + 1 }} / {{ doc.steps.length }}</span
            >
          </div>
        </div>
        <aside class="right-sidebar">
          <template v-if="doc.mode === 'fold'">
            <div class="selected-heading">
              <span class="eyebrow">当前折痕</span>
              <h2>{{ selectedCrease(doc)?.name ?? "尚未绘制折痕" }}</h2>
              <p>
                {{
                  selectedCrease(doc)?.description ??
                  "在左侧进入「绘制自定义折痕」，画出属于你自己的第一道折痕。"
                }}
              </p>
            </div>
            <FoldPanel
              :doc="doc"
              :analysis="analysis"
              @angle="changeAngle(doc, $event)"
              @direction="toggleDirection(doc)"
              @target="applyTarget(doc)"
            /><ObservePanel :doc="doc" />
          </template>
          <template v-else>
            <div class="selected-heading">
              <span class="eyebrow">设计模式</span>
              <h2>绘制你的折痕</h2>
              <p>
                线段可以从纸边连到已有折痕，交点会自动分割纸面。形成闭环的折痕会被标注为约束，折叠时不可行会显示冲突而不会撕坏纸张。
              </p>
            </div>
            <section class="panel observe-panel">
              <div class="section-heading">
                <span>图例</span><small>LEGEND</small>
              </div>
              <div class="legend design-legend">
                <span><i class="dash"></i>可折折痕</span>
                <span><i class="dots"></i>闭环约束</span>
                <span><i class="ring"></i>吸附点</span>
              </div>
            </section>
          </template>
        </aside>
      </div>
      <SequencePanel
        :doc="doc"
        @seek="seek(doc, $event)"
        @play="toggle"
        @capture="capture"
      />
      <footer>
        <span>ORI / 折间 <i>用折叠，重新认识一张纸。</i></span
        ><span
          ><i class="status-dot"></i> 全部计算于浏览器本地
          <small>© 2026 ORI STUDIO</small></span
        >
      </footer>
    </main>
    <div v-if="toast" role="status" class="toast">✓ {{ toast }}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help = false">
      <section class="help-modal">
        <button class="close" @click="help = false">×</button>
        <div class="eyebrow">A SMALL GUIDE</div>
        <h2>从第一道折痕开始</h2>
        <p>
          选择纸张与颜色，点选折痕后拖动角度滑杆。父纸面转动时，关联纸面会一起运动。
        </p>
        <p>
          点击「绘制自定义折痕」可在展开图上自由画线：纸面会即时切分，提交后新折痕会加入下方步骤序列。形成闭环的折痕不能独立转动，折叠不可行时会标红提示，不会损坏作品。
        </p>
        <p>
          下方步骤可还原对应形态，也可保存当前角度后播放。拖动画面旋转视角，滚轮缩放，下载按钮可保存当前观察图。
        </p>
        <p>作品保留在本次会话中，刷新会重新开始。</p>
        <button class="primary" @click="help = false">开始探索 ↗</button>
      </section>
    </div>
  </div>
</template>
