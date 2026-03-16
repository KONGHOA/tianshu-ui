<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import CountTo from '@/components/custom/count-to.vue';

defineOptions({
  name: 'GlobalMetrics'
});

const appStore = useAppStore();

const gap = computed(() => (appStore.isMobile ? 0 : 16));

interface MetricData {
  id: string;
  title: string;
  value: number;
  unit: string;
  colors: [string, string];
  icon: string;
}

const metrics: MetricData[] = [
  {
    id: 'total-asset',
    title: '数据总资产',
    value: 125,
    unit: 'PB',
    colors: ['#007BFF', '#00C6FF'],
    icon: 'i-ph-database-duotone'
  },
  {
    id: 'today-ingest',
    title: '今日接入量',
    value: 368294,
    unit: '条',
    colors: ['#28A745', '#55D466'],
    icon: 'i-ph-arrows-down-up-duotone'
  },
  {
    id: 'quality-score',
    title: '数据质量健康分',
    value: 98,
    unit: '分',
    colors: ['#FFC107', '#FFE066'],
    icon: 'i-ph-shield-check-duotone'
  },
  {
    id: 'service-calls',
    title: '服务调用总数',
    value: 1948520,
    unit: '次',
    colors: ['#17A2B8', '#4DD0E1'],
    icon: 'i-ph-activity-duotone'
  }
];
</script>

<template>
  <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
    <NGi v-for="item in metrics" :key="item.id" span="24 s:12 m:6">
      <div
        class="relative overflow-hidden card-wrapper rd-12px bg-white p-4 shadow-sm transition-shadow duration-300 dark:bg-[#1f2225] hover:shadow-md"
      >
        <div
          class="absolute right-0 top-0 h-24 w-24 translate-x-1/3 rd-full opacity-10 -translate-y-1/3"
          :style="{ background: `linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[1]} 100%)` }"
        ></div>
        <div class="flex items-start justify-between">
          <div>
            <div class="mb-2 text-14px text-gray-500 font-medium dark:text-gray-400">{{ item.title }}</div>
            <div class="flex items-baseline gap-2">
              <CountTo
                :start-value="0"
                :end-value="item.value"
                class="text-30px text-gray-800 font-bold dark:text-gray-100"
                :style="{ color: item.colors[0] }"
              />
              <span class="text-14px text-gray-500 font-medium dark:text-gray-400">{{ item.unit }}</span>
            </div>
          </div>
          <div
            class="rd-8px p-2"
            :style="{ background: `linear-gradient(135deg, ${item.colors[0]}20 0%, ${item.colors[1]}20 100%)` }"
          >
            <div class="text-24px" :class="[item.icon]" :style="{ color: item.colors[0] }"></div>
          </div>
        </div>
      </div>
    </NGi>
  </NGrid>
</template>

<style scoped>
.card-wrapper {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.dark .card-wrapper {
  background: rgba(31, 34, 37, 0.7);
  border-color: rgba(255, 255, 255, 0.05);
}
</style>
