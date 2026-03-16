<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NEmpty, NIcon, NSpin, NTag, NTooltip } from 'naive-ui';
import { useBoolean, useLoading } from '@sa/hooks';
import {
  fetchGetDatabaseProfileAnomalies,
  fetchGetDatabaseProfileOverview,
  fetchGetDatabaseProfileTrend
} from '@/service/api/metadata/profile-query';
import {
  fetchCreateDatabaseProfileTask,
  fetchExecuteProfileTask,
  fetchGetProfileTaskList
} from '@/service/api/metadata/profile-task';
import type { ECOption } from '@/hooks/common/echarts';
import { useEcharts } from '@/hooks/common/echarts';
import ProfileExecutionDrawer from './ProfileExecutionDrawer.vue';
import ProfileTaskScheduleDrawer from './ProfileTaskScheduleDrawer.vue';

interface Props {
  databaseUuid: string;
  databaseName?: string;
}

const props = defineProps<Props>();
const { loading, startLoading, endLoading } = useLoading();
const { bool: triggerLoading, setTrue: startTrigger, setFalse: endTrigger } = useBoolean();

const overview = ref<Api.Metadata.DatabaseProfileOverview | null>(null);
const trendData = ref<{ date: string; value: number }[]>([]);
const historyVisible = ref(false);
const scheduleVisible = ref(false);
const currentTask = ref<Api.Metadata.ProfileTask | null>(null);
const anomalyItems = ref<Api.Metadata.ProfileAnomaly[]>([]);

const taskModeLabel = computed(() => (currentTask.value?.cronExpression ? '定时任务' : '手动任务'));
const taskEnabled = computed(() => currentTask.value?.enabled !== 0);
const latestDelta = computed(() => {
  if (trendData.value.length < 2) return null;
  const current = trendData.value[trendData.value.length - 1]!.value;
  const previous = trendData.value[trendData.value.length - 2]!.value;
  const delta = current - previous;
  const ratioValue = previous > 0 ? (delta / previous) * 100 : null;
  const ratio = ratioValue !== null ? `${ratioValue.toFixed(2)}%` : '-';
  return { delta, ratio, ratioValue };
});
const latestExecuteLabel = computed(() => {
  const raw = String(overview.value?.latestExecuteTime || '')
    .slice(0, 19)
    .replace('T', ' ');
  return raw || '暂无执行记录';
});
const successRatio = computed(() => {
  const total = Number(overview.value?.profiledTableCount || 0);
  const success = Number(overview.value?.successTableCount || 0);
  if (!total) return '0%';
  return `${((success / total) * 100).toFixed(1)}%`;
});
const deltaToneClass = computed(() => {
  if (!latestDelta.value) return 'text-stone-900 dark:text-stone-50';
  return latestDelta.value.delta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300';
});
const executionSummary = computed(() => {
  const status = String(overview.value?.executionStatus || '').toLowerCase();
  if (status === 'success') return '最近一次执行已完成，趋势数据可直接用于观察日级变化。';
  if (status === 'partial_success') return '最近一次执行存在失败表，本次总量可能低于真实值。';
  if (status === 'failed') return '最近一次执行失败，建议先检查历史日志再解读趋势。';
  if (status === 'running') return '任务正在运行中，图上的总量仍是上一次成功结果。';
  return '当前还没有稳定的日级样本，建议先执行一次数据量概览。';
});

function formatCount(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('zh-CN');
}

function getExecutionTone(status?: string): 'default' | 'success' | 'warning' | 'error' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'error';
  if (normalized === 'partial_success' || normalized === 'running') return 'warning';
  return 'default';
}

const chartOptions: ECOption = {
  grid: { top: 20, right: 20, bottom: 28, left: 48, containLabel: false },
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const items = Array.isArray(params) ? params : [params];
      const lines = items.map((item: any) => {
        const value = Number(item.value);
        return `${item.marker}${item.seriesName}：<b>${value.toLocaleString()}</b> 行`;
      });
      return [items[0]?.axisValue, ...lines].join('<br/>');
    }
  },
  xAxis: { type: 'category', data: [] as string[], axisLabel: { fontSize: 11 } },
  yAxis: {
    type: 'value',
    axisLabel: {
      fontSize: 11,
      formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))
    }
  },
  series: [
    {
      type: 'line',
      smooth: true,
      data: [] as number[],
      symbol: 'circle',
      symbolSize: 6,
      name: '数据总量',
      lineStyle: { color: '#0ea5e9', width: 2 },
      itemStyle: { color: '#0ea5e9' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(14,165,233,0.22)' },
            { offset: 1, color: 'rgba(14,165,233,0.02)' }
          ]
        }
      }
    },
    {
      name: '数据增量',
      type: 'line',
      smooth: true,
      data: [] as number[],
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#f97316', width: 2, type: 'dashed' },
      itemStyle: { color: '#f97316' }
    }
  ]
};

const { domRef, updateOptions } = useEcharts(() => chartOptions);

function parseNumber(v: string | number | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function loadData() {
  if (!props.databaseUuid) return;
  startLoading();
  const [overviewRes, trendRes, taskRes, anomalyRes] = await Promise.all([
    fetchGetDatabaseProfileOverview(props.databaseUuid),
    fetchGetDatabaseProfileTrend(props.databaseUuid),
    fetchGetProfileTaskList({
      scopeType: 'database',
      entityUuid: props.databaseUuid,
      pageNum: 1,
      pageSize: 1
    }),
    fetchGetDatabaseProfileAnomalies(props.databaseUuid)
  ]);
  currentTask.value = taskRes.error ? null : (taskRes.data?.rows?.[0] ?? null);
  anomalyItems.value = anomalyRes.error ? [] : (anomalyRes.data ?? []);
  if (!overviewRes.error) overview.value = overviewRes.data ?? null;
  if (!trendRes.error) {
    trendData.value = (trendRes.data ?? []).map(item => ({
      date: String(item.snapshotDate ?? '').slice(0, 10),
      value: parseNumber(item.actualValue)
    }));
    const deltaSeries = trendData.value.map((item, index) => {
      if (index === 0) return 0;
      return item.value - trendData.value[index - 1]!.value;
    });
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = trendData.value.map(item => item.date);
      o.series[0].data = trendData.value.map(item => item.value);
      o.series[1].data = deltaSeries;
      return o;
    });
  } else {
    trendData.value = [];
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = [];
      o.series[0].data = [];
      o.series[1].data = [];
      return o;
    });
  }
  endLoading();
}

async function ensureTaskAndExecute() {
  const existing = currentTask.value;
  if (existing?.taskId) {
    return fetchExecuteProfileTask(existing.taskId);
  }
  return fetchCreateDatabaseProfileTask({
    taskName: `整库数据量概览(${props.databaseName || props.databaseUuid})`,
    scopeType: 'database',
    entityUuid: props.databaseUuid,
    enabled: 1
  }).then(async res => {
    if (res.error || !res.data) return res;
    currentTask.value = {
      taskId: res.data,
      taskName: `整库数据量概览(${props.databaseName || props.databaseUuid})`,
      scopeType: 'database',
      entityUuid: props.databaseUuid,
      datasourceId: 0
    } as Api.Metadata.ProfileTask;
    return fetchExecuteProfileTask(res.data);
  });
}

async function handleTrigger() {
  startTrigger();
  const res = await ensureTaskAndExecute();
  endTrigger();
  if (!res.error) {
    window.$message?.success('整库数据量概览任务已提交，仅统计各表行数和整库总量，稍后点“刷新结果”查看');
  }
}

watch(
  () => props.databaseUuid,
  () => {
    overview.value = null;
    trendData.value = [];
    anomalyItems.value = [];
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = [];
      o.series[0].data = [];
      o.series[1].data = [];
      return o;
    });
    loadData();
  },
  { immediate: true }
);
</script>

<template>
  <div class="profile-page">
    <section class="profile-toolbar">
      <div class="min-w-0">
        <div class="profile-toolbar__title">整库数据量概览</div>
        <div class="profile-toolbar__meta">
          <span>{{ taskModeLabel }}</span>
          <span>{{ taskEnabled ? '任务已启用' : '任务已停用' }}</span>
          <span v-if="overview?.executionStatus">当前状态 {{ overview.executionStatus }}</span>
        </div>
      </div>
      <div class="profile-toolbar__actions flex items-center gap-12px">
        <NButton size="small" type="primary" :loading="triggerLoading" @click="handleTrigger">
          <template #icon>
            <NIcon><icon-mdi-play-circle-outline /></NIcon>
          </template>
          立即执行
        </NButton>

        <div
          class="flex items-center gap-4px rounded-6px bg-gray-50 p-2px ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
        >
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton size="small" quaternary class="!px-8px" :loading="loading" @click="loadData">
                <template #icon>
                  <NIcon><icon-mdi-refresh /></NIcon>
                </template>
              </NButton>
            </template>
            刷新数据
          </NTooltip>

          <NTooltip placement="bottom">
            <template #trigger>
              <NButton size="small" quaternary class="!px-8px" @click="historyVisible = true">
                <template #icon>
                  <NIcon><icon-mdi-history /></NIcon>
                </template>
              </NButton>
            </template>
            历史记录
          </NTooltip>

          <NTooltip placement="bottom">
            <template #trigger>
              <NButton size="small" quaternary class="!px-8px" @click="scheduleVisible = true">
                <template #icon>
                  <NIcon><icon-mdi-calendar-clock-outline /></NIcon>
                </template>
              </NButton>
            </template>
            调度配置
          </NTooltip>
        </div>
      </div>
    </section>

    <NSpin :show="loading" class="min-h-160px">
      <div v-if="overview" class="profile-stack">
        <section
          class="profile-hero flex flex-col gap-12px rounded-16px bg-white p-20px shadow-sm ring-1 ring-gray-100 dark:bg-[#18181c] dark:ring-gray-800"
        >
          <div class="flex flex-col gap-4px md:flex-row md:items-start md:justify-between">
            <div class="flex flex-col gap-6px">
              <div class="flex items-center gap-8px text-16px text-gray-800 font-bold dark:text-gray-100">
                <span class="inline-block h-8px w-8px rounded-full bg-amber-500" />
                整库级数据探索报告
                <NTag size="small" :bordered="false" :type="getExecutionTone(overview.executionStatus)" round>
                  {{ overview.executionStatus || '暂无状态' }}
                </NTag>
              </div>
              <p class="max-w-600px text-13px text-gray-500 leading-relaxed dark:text-gray-400">
                {{ executionSummary }}
              </p>
            </div>

            <div class="mt-12px flex items-center gap-16px text-13px text-gray-600 md:mt-0 dark:text-gray-300">
              <div class="flex flex-col gap-2px md:items-end">
                <span class="text-11px text-gray-400 tracking-wider uppercase">画像批次</span>
                <span class="text-13px font-medium font-mono">{{ overview.latestBatchNo || '未生成' }}</span>
              </div>
              <div class="h-24px w-1px bg-gray-200 dark:bg-gray-800" />
              <div class="flex flex-col gap-2px md:items-end">
                <span class="text-11px text-gray-400 tracking-wider uppercase">最近执行时刻</span>
                <span class="text-13px font-medium font-mono">{{ latestExecuteLabel }}</span>
              </div>
            </div>
          </div>

          <div
            class="grid grid-cols-2 mt-8px gap-16px border-t border-gray-100 pt-16px md:grid-cols-4 md:gap-24px dark:border-gray-800"
          >
            <div
              class="flex flex-col gap-4px rounded-8px bg-gray-50/50 p-12px transition-colors dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50"
            >
              <div class="flex items-center gap-6px text-12px text-gray-400 font-medium">
                <NIcon><icon-mdi-database /></NIcon>
                当前库总行数
              </div>
              <span class="text-24px text-gray-800 font-bold tracking-tight tabular-nums dark:text-gray-100">
                {{ formatCount(overview.databaseRowCountTotal) }}
              </span>
            </div>

            <div
              class="flex flex-col gap-4px rounded-8px bg-gray-50/50 p-12px transition-colors dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50"
            >
              <div class="flex items-center gap-6px text-12px text-gray-400 font-medium">
                <NIcon><icon-mdi-table-multiple /></NIcon>
                画像覆盖表数
              </div>
              <div class="flex items-baseline gap-6px">
                <span class="text-24px text-gray-800 font-bold tracking-tight tabular-nums dark:text-gray-100">
                  {{ formatCount(overview.profiledTableCount) }}
                </span>
                <span class="text-12px text-gray-400 font-medium">成功率 {{ successRatio }}</span>
              </div>
            </div>

            <div
              class="flex flex-col gap-4px rounded-8px p-12px transition-colors"
              :class="
                Number(overview.failedTableCount || 0) > 0
                  ? 'bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
                  : 'bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              "
            >
              <div
                class="flex items-center gap-6px text-12px font-medium"
                :class="
                  Number(overview.failedTableCount || 0) > 0 ? 'text-rose-400 dark:text-rose-500' : 'text-gray-400'
                "
              >
                <NIcon><icon-mdi-alert-circle-outline /></NIcon>
                失败表数
              </div>
              <span
                class="text-24px font-bold tracking-tight tabular-nums"
                :class="
                  Number(overview.failedTableCount || 0) > 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-gray-800 dark:text-gray-100'
                "
              >
                {{ formatCount(overview.failedTableCount) }}
              </span>
            </div>

            <div
              class="flex flex-col gap-4px rounded-8px bg-gray-50/50 p-12px transition-colors dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50"
            >
              <div class="flex items-center gap-6px text-12px text-gray-400 font-medium">
                <NIcon><icon-mdi-swap-vertical /></NIcon>
                行数日增减
              </div>
              <div class="flex items-baseline gap-6px">
                <span class="text-24px font-bold tracking-tight tabular-nums" :class="deltaToneClass">
                  {{ !latestDelta ? '-' : `${latestDelta.delta >= 0 ? '+' : ''}${latestDelta.delta.toLocaleString()}` }}
                </span>
                <span class="text-12px text-gray-400 font-medium">{{ latestDelta?.ratio || '-' }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="anomalyItems.length" class="profile-signal">
          <div class="profile-signal__title">
            <NIcon class="mr-4px align-middle text-amber-500">
              <icon-mdi-alert-outline />
            </NIcon>
            运行信号
          </div>
          <div class="flex flex-col gap-10px">
            <NAlert
              v-for="item in anomalyItems"
              :key="`${item.title}-${item.message}`"
              :type="item.type"
              :title="item.title"
            >
              {{ item.message }}
            </NAlert>
          </div>
        </section>

        <section v-if="trendData.length" class="profile-panel">
          <div class="profile-panel__header">
            <div>
              <div class="profile-panel__eyebrow">趋势曲线</div>
              <div class="profile-panel__title">整库总量与日增量</div>
              <div class="profile-panel__desc">蓝线看每天最后一次总量，橙线看相对前一天的净增减。</div>
            </div>
            <div class="flex flex-wrap gap-8px text-12px">
              <span class="profile-legend profile-legend--primary">
                <span class="h-8px w-8px rounded-full bg-sky-500" />
                数据总量
              </span>
              <span class="profile-legend profile-legend--warning">
                <span class="h-8px w-8px rounded-full bg-orange-500" />
                数据增量
              </span>
            </div>
          </div>
          <div class="profile-panel__body">
            <div ref="domRef" class="h-240px w-full" />
          </div>
        </section>

        <NEmpty v-else-if="!loading" description="尚未执行整库数据量概览" class="py-60px" />
      </div>
    </NSpin>

    <ProfileExecutionDrawer v-model:show="historyVisible" :entity-uuid="databaseUuid" title="整库数据量概览执行历史" />
    <ProfileTaskScheduleDrawer
      v-model:show="scheduleVisible"
      scope-type="database"
      :entity-uuid="databaseUuid"
      :entity-name="overview?.databaseName || databaseName || ''"
      :task="currentTask"
      @saved="loadData"
    />
  </div>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 16px;
  padding: 18px 20px 20px;
}

.profile-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-toolbar__title {
  color: rgb(28, 25, 23);
  font-size: 15px;
  font-weight: 700;
}

.profile-toolbar__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
  color: rgb(120, 113, 108);
  font-size: 12px;
}

.profile-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-stack {
  display: grid;
  gap: 16px;
}

.profile-hero,
.profile-panel,
.profile-signal {
  overflow: hidden;
  border: 1px solid rgba(214, 211, 209, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 20px 40px rgba(28, 25, 23, 0.05);
}

.profile-panel__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgb(120, 113, 108);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.profile-panel__desc {
  color: rgb(120, 113, 108);
}

.profile-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.profile-legend--primary {
  background: rgba(224, 242, 254, 0.96);
  color: rgb(3, 105, 161);
}

.profile-legend--warning {
  background: rgba(255, 237, 213, 0.96);
  color: rgb(194, 65, 12);
}

.profile-signal {
  padding: 16px;
  border-color: rgba(253, 230, 138, 0.7);
  background: rgba(255, 251, 235, 0.86);
}

.profile-signal__title {
  margin-bottom: 10px;
  color: rgb(146, 64, 14);
  font-size: 12px;
  font-weight: 700;
}

.profile-panel__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(214, 211, 209, 0.72);
}

.profile-panel__title {
  margin-top: 6px;
  color: rgb(28, 25, 23);
  font-size: 18px;
  font-weight: 700;
}

.profile-panel__desc {
  margin-top: 4px;
  font-size: 13px;
}

.profile-panel__body {
  padding: 14px 12px;
}

.dark .profile-toolbar__title,
.dark .profile-panel__title {
  color: rgb(250, 250, 249);
}

.dark .profile-toolbar__meta,
.dark .profile-panel__desc,
.dark .profile-panel__eyebrow {
  color: rgb(168, 162, 158);
}

.dark .profile-hero,
.dark .profile-panel,
.dark .profile-signal {
  border-color: rgba(87, 83, 78, 0.72);
  background: rgba(28, 25, 23, 0.78);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
}

.dark .profile-panel__header {
  border-color: rgba(87, 83, 78, 0.7);
}

.dark .profile-legend--primary {
  background: rgba(12, 74, 110, 0.35);
  color: rgb(186, 230, 253);
}

.dark .profile-legend--warning {
  background: rgba(124, 45, 18, 0.34);
  color: rgb(254, 215, 170);
}

.dark .profile-signal {
  background: rgba(69, 26, 3, 0.22);
  border-color: rgba(120, 53, 15, 0.72);
}

@media (max-width: 767px) {
  .profile-page {
    padding: 14px 12px 16px;
  }
}
</style>
