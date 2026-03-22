<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { NSpin } from 'naive-ui';
import type { Node } from '@antv/x6';
import { fetchGetIngestJobLines, fetchGetIngestJobTasks } from '@/service/api/dataingest/job';
import DagToolbar from './DagToolbar.vue';
import DagSidebar from './DagSidebar.vue';
import NodeConfigDrawer from './drawers/NodeConfigDrawer.vue';
import { type DagNodeData, useDagGraph } from './composables/useDagGraph';
import { type ValidationMessage, useDagValidation } from './composables/useDagValidation';

interface Props {
  jobId?: CommonType.IdType | null;
  jobTitle?: string;
  datasourceOptions: { label: string; value: CommonType.IdType }[];
  saving?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{ (e: 'save', tasks: any[], lines: any[]): void }>();

const editorWrapperRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
const minimapRef = ref<HTMLElement | null>(null);

const {
  graph,
  addNode,
  handleDragStart,
  handleDrop,
  removeSelectedCells,
  serializeGraph,
  deserializeGraph,
  autoLayout,
  zoomToFit
} = useDagGraph(canvasRef, minimapRef);

const { validate } = useDagValidation();

const showNodeDrawer = ref(false);
const activeNode = ref<Node | null>(null);
const validationMessages = ref<ValidationMessage[]>([]);
const loadingGraph = ref(false);
const pendingJobId = ref<CommonType.IdType | null>(null);

function handleNodeDblClick({ node }: { node: Node }) {
  activeNode.value = node;
  showNodeDrawer.value = true;
}

watch(
  graph,
  (g, _old, onCleanup) => {
    if (!g) return;
    const handler = (args: { node: Node }) => handleNodeDblClick(args);
    g.on('node:dblclick', handler);
    if (pendingJobId.value) {
      hydrateFromJob(pendingJobId.value);
    }
    onCleanup(() => {
      g.off('node:dblclick', handler);
    });
  },
  { immediate: true }
);

async function handleSave() {
  if (!graph.value) return;
  const messages = validate(graph.value);
  validationMessages.value = messages;
  const hasError = messages.some(message => message.level === 'error');
  if (hasError) {
    window.$message?.error('请先修复错误后再保存');
    return;
  }
  const { tasks, lines } = serializeGraph();
  emit('save', tasks, lines);
}

function handleNodeSaved() {
  validationMessages.value = [];
}

async function hydrateFromJob(jobId: CommonType.IdType) {
  if (!graph.value) {
    pendingJobId.value = jobId;
    return;
  }
  loadingGraph.value = true;
  const [taskResp, lineResp] = await Promise.all([fetchGetIngestJobTasks(jobId), fetchGetIngestJobLines(jobId)]);
  loadingGraph.value = false;
  const tasks = taskResp.data ?? [];
  const lines = lineResp.data ?? [];
  deserializeGraph(tasks, lines);
  await nextTick();
  zoomToFit();
}

watch(
  () => props.jobId,
  jobId => {
    pendingJobId.value = jobId ?? null;
    if (jobId && graph.value) {
      hydrateFromJob(jobId);
    } else if (!jobId && graph.value) {
      graph.value.clearCells();
    }
  },
  { immediate: true }
);

const drawerNodeData = computed<DagNodeData | null>(() => (activeNode.value?.getData() as DagNodeData) ?? null);
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden bg-[#f2f3f5] p-20px dark:bg-transparent">
    <div
      ref="editorWrapperRef"
      class="flex flex-col flex-1 overflow-hidden border border-gray-200 rounded-12px bg-white shadow-sm dark:border-gray-800 dark:bg-[#18181c]"
    >
      <!-- Toolbar exactly like DS -->
      <div
        class="h-56px flex shrink-0 items-center justify-between border-b border-gray-200 px-24px dark:border-gray-800"
      >
        <div class="text-16px text-[#1c2560] font-medium dark:text-gray-100">{{ props.jobTitle || 'DAG 工作流' }}</div>
        <div class="flex items-center gap-12px">
          <DagToolbar
            :auto-layout="autoLayout"
            :zoom-to-fit="zoomToFit"
            :remove-selected-cells="removeSelectedCells"
            :container="editorWrapperRef"
            :saving="props.saving ?? false"
            @save="handleSave"
          />
          <div class="mx-4px h-16px w-1px bg-[#eaecf5]"></div>
          <slot name="header-extra"></slot>
        </div>
      </div>

      <!-- Content exactly like DS -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar exactly like DS: width 190px -->
        <aside class="w-190px flex flex-col shrink-0 overflow-hidden border-r border-gray-200 dark:border-gray-800">
          <DagSidebar :handle-drag-start="handleDragStart" :add-node="addNode" />
        </aside>

        <!-- Canvas exactly like DS -->
        <section
          class="relative flex flex-col flex-1 overflow-hidden"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent
        >
          <div class="relative flex-1 overflow-hidden bg-white dark:bg-[#18181c]">
            <div ref="canvasRef" class="h-full w-full outline-none"></div>
            <div
              ref="minimapRef"
              class="absolute bottom-0 right-0 z-[9] h-[150px] w-[200px] overflow-hidden border border-[#e4e4e4] border-dashed bg-white"
            />
            <div
              v-if="loadingGraph"
              class="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-sm"
            >
              <NSpin size="large" />
            </div>
          </div>
          <div
            v-if="validationMessages.length > 0"
            class="z-10 shrink-0 border-t border-[#edf0fb] bg-[#fdf6f6] px-16px py-10px text-12px"
          >
            <p class="text-[#c53030] font-medium">连线校验提示</p>
            <ul class="mt-6px flex flex-col gap-4px">
              <li
                v-for="item in validationMessages"
                :key="item.message + (item.nodeCode || '')"
                :class="item.level === 'error' ? 'text-#c53030' : 'text-#c05621'"
              >
                {{ item.message }}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  </div>

  <NodeConfigDrawer
    v-model:visible="showNodeDrawer"
    :graph="graph"
    :node-data="drawerNodeData"
    :datasource-options="props.datasourceOptions"
    @saved="handleNodeSaved"
  />
</template>
