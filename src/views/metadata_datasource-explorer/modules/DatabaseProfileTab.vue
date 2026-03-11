<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NEmpty, NIcon, NSpin } from 'naive-ui';
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
  <div class="flex flex-col gap-0">
    <div
      class="flex flex-wrap items-center justify-between gap-12px border-b border-gray-100 px-20px py-14px dark:border-gray-800"
    >
      <div class="min-w-0">
        <div class="text-15px text-stone-900 font-semibold dark:text-stone-50">整库数据量概览</div>
        <div
          class="mt-4px flex flex-wrap items-center gap-x-12px gap-y-4px text-12px text-stone-500 dark:text-stone-400"
        >
          <span>{{ taskModeLabel }}</span>
          <span>{{ taskEnabled ? '任务已启用' : '任务已停用' }}</span>
          <span v-if="overview?.executionStatus">当前状态 {{ overview.executionStatus }}</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-8px">
        <NButton size="small" type="primary" :loading="triggerLoading" @click="handleTrigger">
          <template #icon>
            <NIcon><div class="i-mdi-play-circle-outline" /></NIcon>
          </template>
          立即执行
        </NButton>
        <NButton size="small" quaternary :loading="loading" @click="loadData">刷新</NButton>
        <NButton size="small" quaternary @click="historyVisible = true">历史</NButton>
        <NButton size="small" quaternary @click="scheduleVisible = true">调度</NButton>
      </div>
    </div>

    <NSpin :show="loading" class="min-h-160px">
      <div v-if="overview" class="px-20px py-18px">
        <div
          class="overflow-hidden border border-stone-200/80 rounded-24px bg-[linear-gradient(135deg,rgba(250,245,235,0.95),rgba(255,251,245,0.98)_55%,rgba(238,247,242,0.94))] dark:border-stone-700/70 dark:bg-[linear-gradient(135deg,rgba(38,32,28,0.96),rgba(28,26,24,0.98)_55%,rgba(22,30,26,0.96))]"
        >
          <div class="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_380px]">
            <div
              class="border-b border-stone-200/70 px-20px py-18px lg:border-b-0 lg:border-r dark:border-stone-700/60"
            >
              <div
                class="mb-10px flex items-center gap-10px text-11px text-stone-500 font-semibold tracking-[0.22em] dark:text-stone-400"
              >
                <span class="inline-block h-8px w-8px rounded-full bg-amber-500" />
                数据量快照
              </div>
              <div class="max-w-720px">
                <div class="text-13px text-stone-500 dark:text-stone-400">整库最新总量</div>
                <div class="mt-4px flex flex-wrap items-end gap-x-14px gap-y-8px">
                  <div
                    class="text-[clamp(2.6rem,6vw,4.8rem)] text-stone-900 font-semibold leading-none tracking-[-0.05em] dark:text-stone-50"
                  >
                    {{ Number(overview.databaseRowCountTotal || 0).toLocaleString() }}
                  </div>
                  <div class="pb-8px text-13px text-stone-500 dark:text-stone-400">行</div>
                </div>
                <div class="mt-10px flex flex-wrap items-center gap-10px text-12px">
                  <span
                    class="rounded-full bg-stone-900 px-10px py-4px text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                  >
                    {{ overview.latestBatchNo || '未生成批次' }}
                  </span>
                  <span class="text-stone-500 dark:text-stone-400">最近执行 {{ latestExecuteLabel }}</span>
                </div>
                <p class="mt-14px max-w-2xl text-14px text-stone-600 leading-6 dark:text-stone-300">
                  {{ executionSummary }}
                </p>
              </div>
            </div>

            <div class="px-20px py-18px">
              <div class="grid gap-16px">
                <div>
                  <div class="text-11px text-stone-500 font-semibold tracking-[0.2em] dark:text-stone-400">日增量</div>
                  <div class="mt-6px flex items-end gap-8px">
                    <div class="text-3xl font-semibold tracking-[-0.04em]" :class="deltaToneClass">
                      {{
                        !latestDelta ? '-' : `${latestDelta.delta >= 0 ? '+' : ''}${latestDelta.delta.toLocaleString()}`
                      }}
                    </div>
                    <div class="pb-1 text-12px text-stone-500 dark:text-stone-400">
                      {{ latestDelta?.ratio || '至少需要两个日样本' }}
                    </div>
                  </div>
                </div>
                <div class="grid gap-10px border-t border-stone-200/70 pt-14px text-13px dark:border-stone-700/60">
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">覆盖表数</span>
                    <span class="text-stone-900 font-medium dark:text-stone-100">
                      {{ overview.profiledTableCount || 0 }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">成功率</span>
                    <span class="text-stone-900 font-medium dark:text-stone-100">{{ successRatio }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">失败表数</span>
                    <span
                      class="font-medium"
                      :class="
                        Number(overview.failedTableCount || 0) > 0
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-stone-900 dark:text-stone-100'
                      "
                    >
                      {{ overview.failedTableCount || 0 }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">执行状态</span>
                    <span class="text-stone-900 font-medium uppercase dark:text-stone-100">
                      {{ overview.executionStatus || '-' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="anomalyItems.length" class="px-20px pb-4px">
        <div
          class="border border-amber-200/80 rounded-20px bg-amber-50/70 px-16px py-14px dark:border-amber-900/60 dark:bg-amber-950/20"
        >
          <div class="mb-10px text-12px text-amber-800 font-medium dark:text-amber-200">
            <NIcon class="mr-4px align-middle text-amber-600 dark:text-amber-300">
              <div class="i-mdi-alert-outline" />
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
        </div>
      </div>

      <div v-if="trendData.length" class="px-20px py-18px">
        <div
          class="overflow-hidden border border-stone-200/80 rounded-24px bg-stone-50/75 dark:border-stone-700/60 dark:bg-stone-900/35"
        >
          <div
            class="flex flex-wrap items-end justify-between gap-12px border-b border-stone-200/80 px-18px py-16px dark:border-stone-700/60"
          >
            <div>
              <div class="text-11px text-stone-500 font-semibold tracking-[0.22em] dark:text-stone-400">趋势曲线</div>
              <div class="mt-6px text-18px text-stone-900 font-semibold dark:text-stone-50">整库总量与日增量</div>
              <div class="mt-4px text-13px text-stone-500 dark:text-stone-400">
                蓝线看每天最后一次总量，橙线看相对前一天的净增减。
              </div>
            </div>
            <div class="flex flex-wrap gap-8px text-12px">
              <span
                class="inline-flex items-center gap-6px rounded-full bg-sky-100 px-10px py-5px text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <span class="h-8px w-8px rounded-full bg-sky-500" />
                数据总量
              </span>
              <span
                class="inline-flex items-center gap-6px rounded-full bg-orange-100 px-10px py-5px text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
              >
                <span class="h-8px w-8px rounded-full bg-orange-500" />
                数据增量
              </span>
            </div>
          </div>
          <div class="px-12px py-14px">
            <div ref="domRef" class="h-240px w-full" />
          </div>
        </div>
      </div>

      <NEmpty v-else-if="!loading" description="尚未执行整库数据量概览" class="py-60px" />
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
