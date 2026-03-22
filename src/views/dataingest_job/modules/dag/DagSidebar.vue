<script setup lang="ts">
import { NCollapse, NCollapseItem } from 'naive-ui';
import type { Node } from '@antv/x6';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { NodeType, PluginType } from './composables/useDagGraph';

interface DagSidebarItem {
  label: string;
  taskType: NodeType;
  pluginType: PluginType;
  description?: string;
}

interface DagNodeOptions {
  taskType: NodeType;
  pluginType: PluginType;
  label: string;
}

interface Props {
  addNode: (opts: DagNodeOptions, overridePos?: { x: number; y: number }) => Node | null;
  handleDragStart: (e: DragEvent, opts: DagNodeOptions) => void;
}

const props = defineProps<Props>();

const sections: { key: string; label: string; items: DagSidebarItem[] }[] = [
  {
    key: 'source',
    label: '数据源',
    items: [
      { label: 'JDBC Source', taskType: 'SOURCE', pluginType: 'JDBC', description: '关系型库/湖源' },
      { label: 'Kafka Source', taskType: 'SOURCE', pluginType: 'KAFKA', description: '实时 Topic' },
      { label: 'Fake Source', taskType: 'SOURCE', pluginType: 'FAKE', description: '调试用模拟数据' }
    ]
  },
  {
    key: 'transform',
    label: '数据转换',
    items: [
      { label: 'FieldMapper', taskType: 'TRANSFORM', pluginType: 'FIELD_MAPPER', description: '字段映射' },
      { label: 'Filter', taskType: 'TRANSFORM', pluginType: 'FILTER', description: '条件过滤' },
      { label: 'Replace', taskType: 'TRANSFORM', pluginType: 'REPLACE', description: '替换规则' },
      { label: 'SQL', taskType: 'TRANSFORM', pluginType: 'SQL', description: '自定义 SQL' }
    ]
  },
  {
    key: 'sink',
    label: '数据目标',
    items: [
      { label: 'JDBC Sink', taskType: 'SINK', pluginType: 'JDBC', description: '写入关系型' },
      { label: 'Kafka Sink', taskType: 'SINK', pluginType: 'KAFKA', description: '写入 Topic' },
      { label: 'Console Sink', taskType: 'SINK', pluginType: 'CONSOLE', description: '调试输出' }
    ]
  }
];

function getIconClass(type: NodeType) {
  switch (type) {
    case 'SOURCE':
      return 'mdi:database-export-outline';
    case 'TRANSFORM':
      return 'mdi:cog-outline';
    case 'SINK':
      return 'mdi:database-import-outline';
    default:
      return 'mdi:puzzle-outline';
  }
}

function handleClick(item: DagSidebarItem) {
  props.addNode({ taskType: item.taskType, pluginType: item.pluginType, label: item.label });
}
</script>

<template>
  <div class="custom-scrollbar h-full w-full flex-1 overflow-auto bg-white">
    <NCollapse :default-expanded-names="['source', 'transform', 'sink']" class="w-full">
      <NCollapseItem v-for="section in sections" :key="section.key" :title="section.label" :name="section.key">
        <div class="flex flex-col gap-2px">
          <button
            v-for="item in section.items"
            :key="item.label"
            draggable="true"
            class="group h-32px w-full flex cursor-pointer items-center justify-between rounded-6px border-none bg-transparent px-8px text-left transition-colors hover:bg-#f3f5f9"
            type="button"
            @click="handleClick(item)"
            @dragstart="
              event =>
                props.handleDragStart(event, {
                  taskType: item.taskType,
                  pluginType: item.pluginType,
                  label: item.label
                })
            "
          >
            <div class="flex items-center gap-6px">
              <SvgIcon
                icon="mdi:drag-vertical"
                class="text-14px text-#8a92b2 opacity-0 transition-opacity group-hover:opacity-100"
              />
              <div
                class="h-24px w-24px flex items-center justify-center rounded-4px transition-colors group-hover:bg-[#288fff]/10"
              >
                <SvgIcon
                  :icon="getIconClass(item.taskType)"
                  class="text-16px text-[#666] transition-colors group-hover:text-[#288fff]"
                />
              </div>
              <span class="font-medium transition-colors group-hover:text-[#288fff]">{{ item.label }}</span>
            </div>
            <SvgIcon
              icon="mdi:star-outline"
              class="text-14px text-#c2c6d6 opacity-0 transition-all hover:text-#fbbf24 group-hover:opacity-100"
            />
          </button>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
:deep(.n-collapse-item__header) {
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  font-weight: 500;
  color: #1c2560;
}
:deep(.n-collapse-item__content-inner) {
  padding-top: 0 !important;
  padding-bottom: 8px !important;
}
</style>
