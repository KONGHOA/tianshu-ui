<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import type { Node } from '@antv/x6';
import type { DagNodeData } from '../composables/useDagGraph';

const getNode = inject<() => Node>('getNode');
const node = getNode?.();
const nodeData = ref<DagNodeData | null>((node?.getData() as DagNodeData) || null);

function handleDataChange() {
  nodeData.value = (node?.getData() as DagNodeData) || null;
}

node?.on('change:data', handleDataChange);

onBeforeUnmount(() => {
  node?.off('change:data', handleDataChange);
});

const colorMap: Record<DagNodeData['taskType'], string> = {
  SOURCE: '#0E42D2',
  TRANSFORM: '#D25F00',
  SINK: '#009A29'
};

const initials = computed(() => {
  if (!nodeData.value) return '';
  const map: Record<DagNodeData['taskType'], string> = {
    SOURCE: 'S',
    TRANSFORM: 'T',
    SINK: 'D'
  };
  return map[nodeData.value.taskType];
});

const badgeClass = computed(() =>
  nodeData.value?.configured ? 'bg-emerald-500/80 border-emerald-100' : 'bg-red-500/80 border-red-100'
);

const textColor = computed(() => (nodeData.value ? colorMap[nodeData.value.taskType] : '#1f2933'));
</script>

<template>
  <div class="flex items-center gap-10px border border-#dbe1f1 rounded-12px bg-white/95 px-12px py-8px shadow-sm">
    <div
      class="h-36px w-36px flex items-center justify-center rounded-full text-16px text-white font-semibold"
      :style="{ backgroundColor: textColor }"
    >
      {{ initials }}
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-6px">
        <p class="line-clamp-1 text-13px text-[#1b2559] font-medium">
          {{ nodeData?.label ?? '节点' }}
        </p>
        <span class="text-10px text-[#8a93b8]">
          {{ nodeData?.pluginType ?? '' }}
        </span>
      </div>
      <div class="flex items-center gap-6px text-11px text-[#7a84a6]">
        <span>{{ nodeData?.taskType }}</span>
        <span class="relative inline-flex items-center">
          <span class="h-6px w-6px border rounded-full" :class="badgeClass" />
          <span class="ml-4px text-10px text-[#99a2c7]">
            {{ nodeData?.configured ? '已配置' : '未配置' }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>
