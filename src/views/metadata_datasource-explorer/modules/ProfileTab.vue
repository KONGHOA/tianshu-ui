<script setup lang="tsx">
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { NAlert, NButton, NDataTable, NEmpty, NIcon, NSpin, NTag, NTooltip } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import * as echarts from 'echarts/core';
import { useBoolean, useLoading } from '@sa/hooks';
import {
  fetchGetColumnProfileDetail,
  fetchGetTableProfileAnomalies,
  fetchGetTableProfileOverview,
  fetchGetTableProfileTrend
} from '@/service/api/metadata/profile-query';
import { fetchGetProfileTaskList } from '@/service/api/metadata/profile-task';
import type { ECOption } from '@/hooks/common/echarts';
import { useEcharts } from '@/hooks/common/echarts';
import ProfileExecutionDrawer from './ProfileExecutionDrawer.vue';
import ProfileExecuteModal from './ProfileExecuteModal.vue';
import ProfileTaskScheduleDrawer from './ProfileTaskScheduleDrawer.vue';

interface Props {
  tableUuid: string;
  columns: Api.Metadata.EntityInstance[];
}

interface ColRow {
  uuid: string;
  displayName: string;
  type: string;
  dataType: string;
  nullCount: number;
  nullPercentage: string;
  notNullCount: number;
  notNullPercentage: string;
  distinctCount: number;
  distinctPercentage: string;
  uniqueCount: number;
  uniquePercentage: string;
}

type ColumnDetail =
  | Api.Metadata.ColumnStringProfile
  | Api.Metadata.ColumnNumericProfile
  | Api.Metadata.ColumnDateTimeProfile;

const props = defineProps<Props>();

const { loading: profileLoading, startLoading: startProfile, endLoading: endProfile } = useLoading();
const { bool: triggerLoading, setTrue: startTrigger, setFalse: endTrigger } = useBoolean();

const overview = ref<Api.Metadata.TableProfileOverview | null>(null);
const trendData = ref<{ date: string; value: number }[]>([]);
const loaded = ref(false);
const detailCache = ref<Record<string, ColumnDetail | null>>({});
const historyVisible = ref(false);
const executeVisible = ref(false);
const scheduleVisible = ref(false);
const currentTask = ref<Api.Metadata.ProfileTask | null>(null);
const anomalyItems = ref<Api.Metadata.ProfileAnomaly[]>([]);

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
      name: '数据总量',
      type: 'line',
      smooth: true,
      data: [] as number[],
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#5470c6', width: 2 },
      itemStyle: { color: '#5470c6' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(84,112,198,0.25)' },
            { offset: 1, color: 'rgba(84,112,198,0.02)' }
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

const { domRef: trendDomRef, updateOptions } = useEcharts(() => chartOptions);

function parseProps(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function fmt(v: string | undefined): string {
  return v !== undefined && v !== null && v !== '' ? v : '-';
}

function parseNumber(v: string | number | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const taskModeLabel = computed(() => (currentTask.value?.cronExpression ? '定时任务' : '手动任务'));
const taskEnabled = computed(() => currentTask.value?.enabled !== 0);
const latestStatusType = computed(() => {
  const status = String(overview.value?.executionStatus || '').toLowerCase();
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'partial_success') return 'warning';
  if (status === 'running') return 'warning';
  return 'default';
});
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
const deltaToneClass = computed(() => {
  if (!latestDelta.value) return 'text-stone-900 dark:text-stone-50';
  return latestDelta.value.delta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300';
});
const profileSummary = computed(() => {
  const status = String(overview.value?.executionStatus || '').toLowerCase();
  if (status === 'success') return '最近一次画像已完成，可以直接查看当前列分布与日级变化。';
  if (status === 'partial_success') return '最近一次画像存在部分失败字段，建议结合执行历史确认是否需要重跑。';
  if (status === 'failed') return '最近一次画像失败，建议先查看执行日志，再解读当前结果。';
  if (status === 'running') return '任务正在运行中，页面展示的仍是上一次成功批次。';
  return '执行一次数据概览后，这里会展示表总量变化和列画像摘要。';
});

async function loadProfiles() {
  if (!props.tableUuid) return;
  startProfile();
  loaded.value = false;
  detailCache.value = {};

  const [overviewRes, trendRes, taskRes, anomalyRes] = await Promise.all([
    fetchGetTableProfileOverview(props.tableUuid),
    fetchGetTableProfileTrend(props.tableUuid),
    fetchGetProfileTaskList({
      scopeType: 'table',
      entityUuid: props.tableUuid,
      pageNum: 1,
      pageSize: 1
    }),
    fetchGetTableProfileAnomalies(props.tableUuid)
  ]);

  currentTask.value = taskRes.error ? null : (taskRes.data?.rows?.[0] ?? null);
  anomalyItems.value = anomalyRes.error ? [] : (anomalyRes.data ?? []);

  if (!overviewRes.error) {
    overview.value = overviewRes.data ?? null;
  }

  if (!trendRes.error && trendRes.data) {
    const pts = (trendRes.data ?? []).map(p => ({
      date: String(p.snapshotDate ?? '').slice(0, 10),
      value: parseNumber(p.actualValue)
    }));
    const deltaSeries = pts.map((item, index) => {
      if (index === 0) return 0;
      return item.value - pts[index - 1]!.value;
    });
    trendData.value = pts;
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = pts.map(p => p.date);
      o.series[0].data = pts.map(p => p.value);
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

  loaded.value = true;
  endProfile();
}

function handleTrigger() {
  executeVisible.value = true;
}

async function handleExecuted() {
  startTrigger();
  await loadProfiles();
  endTrigger();
}

watch(
  () => props.tableUuid,
  () => {
    overview.value = null;
    trendData.value = [];
    loaded.value = false;
    detailCache.value = {};
    anomalyItems.value = [];
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = [];
      o.series[0].data = [];
      o.series[1].data = [];
      return o;
    });
    loadProfiles();
  },
  { immediate: true }
);

const columnRows = computed<ColRow[]>(() => {
  const overviewMap = Object.fromEntries((overview.value?.columnProfiles ?? []).map(item => [item.uuid, item]));
  return props.columns.map(col => {
    const p = parseProps(col.properties);
    const profile = overviewMap[col.uuid] ?? ({} as Api.Metadata.ColumnProfileBase);
    return {
      uuid: col.uuid,
      displayName: col.displayName,
      type: String(p.type ?? profile.type ?? '-'),
      dataType: String(p.dataType ?? profile.dataType ?? '').toLowerCase(),
      nullCount: parseNumber(profile.nullCount),
      nullPercentage: profile.nullPercentage ?? '0.00%',
      notNullCount: parseNumber(profile.notNullCount),
      notNullPercentage: profile.notNullPercentage ?? '0.00%',
      distinctCount: parseNumber(profile.distinctCount),
      distinctPercentage: profile.distinctPercentage ?? '0.00%',
      uniqueCount: parseNumber(profile.uniqueCount),
      uniquePercentage: profile.uniquePercentage ?? '0.00%'
    };
  });
});

interface Top10Item {
  name: string;
  count: number;
  pct: string;
}

function parseTop10(raw: string | undefined): Top10Item[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Top10Item[];
  } catch {
    return [];
  }
}

const ExpandedRow = defineComponent({
  name: 'ExpandedRow',
  props: {
    row: { type: Object as PropType<ColRow>, required: true },
    batchNo: { type: String, default: '' }
  },
  setup(rowProps) {
    const detail = ref<ColumnDetail | null>(null);
    const detailLoading = ref(false);
    const top10ChartRef = ref<HTMLElement | null>(null);
    let chartInstance: echarts.ECharts | null = null;

    async function loadDetail() {
      if (detailCache.value[rowProps.row.uuid] !== undefined) {
        detail.value = detailCache.value[rowProps.row.uuid];
        await nextTick();
        initChart();
        return;
      }
      detailLoading.value = true;
      const res = await fetchGetColumnProfileDetail(rowProps.row.uuid, rowProps.batchNo || undefined);
      detailLoading.value = false;
      detail.value = res.error ? null : (res.data ?? null);
      detailCache.value[rowProps.row.uuid] = detail.value;
      await nextTick();
      initChart();
    }

    const top10Items = computed(() => parseTop10((detail.value as any)?.top10Json));

    const extraMetrics = computed(() => {
      const d: any = detail.value ?? {};
      const metrics: { label: string; value: string }[] = [];
      if (fmt(d.maxValue) !== '-') metrics.push({ label: '最大值', value: fmt(d.maxValue) });
      if (fmt(d.minValue) !== '-') metrics.push({ label: '最小值', value: fmt(d.minValue) });
      if (fmt(d.avgValue) !== '-') metrics.push({ label: '均值', value: fmt(d.avgValue) });
      if (fmt(d.sumValue) !== '-') metrics.push({ label: '求和', value: fmt(d.sumValue) });
      if (fmt(d.maxLength) !== '-') metrics.push({ label: '最大长度', value: fmt(d.maxLength) });
      if (fmt(d.minLength) !== '-') metrics.push({ label: '最小长度', value: fmt(d.minLength) });
      if (fmt(d.avgLength) !== '-') metrics.push({ label: '平均长度', value: fmt(d.avgLength) });
      return metrics;
    });

    function initChart() {
      const items = top10Items.value;
      if (!top10ChartRef.value || items.length === 0) {
        chartInstance?.dispose();
        chartInstance = null;
        return;
      }
      chartInstance?.dispose();
      chartInstance = echarts.init(top10ChartRef.value);
      chartInstance.setOption({
        grid: { top: 16, right: 12, bottom: 48, left: 12, containLabel: true },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            return `${p.name}<br/><b>${Number(p.value).toLocaleString()}</b> 次`;
          }
        },
        xAxis: {
          type: 'category',
          data: items.map(i => i.name),
          axisLabel: {
            fontSize: 11,
            rotate: 30,
            formatter: (val: string) => (val.length > 12 ? `${val.slice(0, 12)}…` : val)
          }
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
        series: [
          {
            type: 'bar',
            data: items.map(i => i.count),
            itemStyle: { color: '#5470c6', borderRadius: [3, 3, 0, 0] },
            label: {
              show: true,
              position: 'top',
              fontSize: 10,
              formatter: (p: any) => Number(p.value).toLocaleString()
            }
          }
        ]
      });
    }

    onMounted(loadDetail);
    onUnmounted(() => {
      chartInstance?.dispose();
      chartInstance = null;
    });

    return () => (
      <NSpin show={detailLoading.value} class="min-h-80px">
        <div class="flex gap-24px bg-gray-50 px-16px py-12px dark:bg-gray-900/40">
          {extraMetrics.value.length > 0 && (
            <div class="w-180px flex-shrink-0">
              <p class="mb-8px text-11px text-gray-400 font-semibold tracking-wide uppercase">额外指标</p>
              <div class="flex flex-col gap-4px">
                {extraMetrics.value.map(m => (
                  <div key={m.label} class="flex items-center justify-between gap-8px text-12px">
                    <span class="text-gray-500">{m.label}</span>
                    <NTooltip>
                      {{
                        default: () => m.value,
                        trigger: () => (
                          <span class="max-w-100px truncate text-gray-800 font-medium font-mono dark:text-gray-200">
                            {m.value}
                          </span>
                        )
                      }}
                    </NTooltip>
                  </div>
                ))}
              </div>
            </div>
          )}
          {top10Items.value.length > 0 && (
            <div class="min-w-0 flex-1">
              <p class="mb-4px text-11px text-gray-400 font-semibold tracking-wide uppercase">Top 10 分布</p>
              <div ref={top10ChartRef} style="height: 180px; width: 100%" />
            </div>
          )}
          {!detailLoading.value && extraMetrics.value.length === 0 && top10Items.value.length === 0 && (
            <span class="text-12px text-gray-400">暂无额外指标数据</span>
          )}
        </div>
      </NSpin>
    );
  }
});

const profileCols: DataTableColumns<ColRow> = [
  {
    type: 'expand',
    renderExpand: row => <ExpandedRow row={row} batchNo={overview.value?.latestColumnBatchNo ?? ''} />
  },
  {
    title: '字段名',
    key: 'displayName',
    width: 160,
    fixed: 'left',
    render: row => <span class="text-gray-800 font-medium dark:text-gray-200">{row.displayName}</span>
  },
  {
    title: '类型',
    key: 'type',
    width: 140,
    render: row => (
      <NTag size="small" bordered={false} type="info">
        {row.type}
      </NTag>
    )
  },
  {
    title: '空值',
    key: 'null',
    width: 130,
    render: row => (
      <span>
        <span class="font-medium tabular-nums">{row.nullCount.toLocaleString()}</span>
        <span class="ml-4px text-11px text-gray-400">[{row.nullPercentage}]</span>
      </span>
    )
  },
  {
    title: '非空值',
    key: 'notNull',
    width: 130,
    render: row => (
      <span>
        <span class="font-medium tabular-nums">{row.notNullCount.toLocaleString()}</span>
        <span class="ml-4px text-11px text-gray-400">[{row.notNullPercentage}]</span>
      </span>
    )
  },
  {
    title: '不同值',
    key: 'distinct',
    width: 130,
    render: row => (
      <span>
        <span class="font-medium tabular-nums">{row.distinctCount.toLocaleString()}</span>
        <span class="ml-4px text-11px text-gray-400">[{row.distinctPercentage}]</span>
      </span>
    )
  },
  {
    title: '唯一值',
    key: 'unique',
    width: 130,
    render: row => (
      <span>
        <span class="font-medium tabular-nums">{row.uniqueCount.toLocaleString()}</span>
        <span class="ml-4px text-11px text-gray-400">[{row.uniquePercentage}]</span>
      </span>
    )
  }
];
</script>

<template>
  <div class="flex flex-col gap-0">
    <div
      class="flex flex-wrap items-center justify-between gap-12px border-b border-gray-100 px-20px py-14px dark:border-gray-800"
    >
      <div class="min-w-0">
        <div class="text-15px text-stone-900 font-semibold dark:text-stone-50">表数据概览</div>
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
        <NButton size="small" quaternary :loading="profileLoading" @click="loadProfiles">刷新</NButton>
        <NButton size="small" quaternary @click="historyVisible = true">历史</NButton>
        <NButton size="small" quaternary @click="scheduleVisible = true">调度</NButton>
      </div>
    </div>

    <NSpin :show="profileLoading" class="min-h-120px">
      <div v-if="loaded && overview" class="px-20px py-18px">
        <div
          class="overflow-hidden border border-stone-200/80 rounded-24px bg-[linear-gradient(135deg,rgba(244,247,252,0.96),rgba(255,250,244,0.96)_58%,rgba(242,248,245,0.94))] dark:border-stone-700/60 dark:bg-[linear-gradient(135deg,rgba(24,27,35,0.96),rgba(35,27,24,0.96)_58%,rgba(20,32,28,0.96))]"
        >
          <div class="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_360px]">
            <div
              class="border-b border-stone-200/70 px-20px py-18px lg:border-b-0 lg:border-r dark:border-stone-700/60"
            >
              <div
                class="mb-10px flex items-center gap-10px text-11px text-stone-500 font-semibold tracking-[0.22em] dark:text-stone-400"
              >
                <span class="inline-block h-8px w-8px rounded-full bg-sky-500" />
                表级快照
              </div>
              <div class="text-13px text-stone-500 dark:text-stone-400">最新总行数</div>
              <div class="mt-4px flex flex-wrap items-end gap-x-14px gap-y-8px">
                <div
                  class="text-[clamp(2.5rem,6vw,4.5rem)] text-stone-900 font-semibold leading-none tracking-[-0.05em] dark:text-stone-50"
                >
                  {{ Number(overview.tableRowCount || 0).toLocaleString() }}
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
                {{ profileSummary }}
              </p>
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
                    <span class="text-stone-500 dark:text-stone-400">执行状态</span>
                    <span
                      class="font-medium uppercase"
                      :class="
                        latestStatusType === 'error'
                          ? 'text-rose-700 dark:text-rose-300'
                          : latestStatusType === 'warning'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-stone-900 dark:text-stone-100'
                      "
                    >
                      {{ overview.executionStatus || '-' }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">画像字段数</span>
                    <span class="text-stone-900 font-medium dark:text-stone-100">{{ columnRows.length }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">空值风险字段</span>
                    <span class="text-stone-900 font-medium dark:text-stone-100">
                      {{ columnRows.filter(row => row.nullCount > 0).length }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-10px">
                    <span class="text-stone-500 dark:text-stone-400">唯一值字段</span>
                    <span class="text-stone-900 font-medium dark:text-stone-100">
                      {{ columnRows.filter(row => row.uniqueCount > 0).length }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="anomalyItems.length" class="border-b border-gray-100 px-20px py-16px dark:border-gray-800">
        <div class="mb-10px text-12px text-gray-500 font-medium">
          <NIcon class="mr-4px align-middle text-gray-400"><div class="i-mdi-alert-outline" /></NIcon>
          异常提示
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

      <div v-if="trendData.length >= 1" class="px-20px py-18px">
        <div
          class="overflow-hidden border border-stone-200/80 rounded-24px bg-stone-50/75 dark:border-stone-700/60 dark:bg-stone-900/35"
        >
          <div
            class="flex flex-wrap items-end justify-between gap-12px border-b border-stone-200/80 px-18px py-16px dark:border-stone-700/60"
          >
            <div>
              <div class="text-11px text-stone-500 font-semibold tracking-[0.22em] dark:text-stone-400">趋势曲线</div>
              <div class="mt-6px text-18px text-stone-900 font-semibold dark:text-stone-50">表总量与日增量</div>
              <div class="mt-4px text-13px text-stone-500 dark:text-stone-400">
                蓝线看每天最后一次表总量，橙线看相对前一天的净增减。
              </div>
            </div>
            <div class="flex flex-wrap gap-8px text-12px">
              <span
                class="inline-flex items-center gap-6px rounded-full bg-indigo-100 px-10px py-5px text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <span class="h-8px w-8px rounded-full bg-indigo-500" />
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
            <div ref="trendDomRef" class="h-220px w-full" />
          </div>
        </div>
      </div>

      <div v-if="loaded">
        <div class="border-t border-gray-100 px-20px py-18px dark:border-gray-800">
          <div class="mb-12px flex flex-wrap items-end justify-between gap-12px">
            <div>
              <div class="text-11px text-stone-500 font-semibold tracking-[0.22em] dark:text-stone-400">列画像</div>
              <div class="mt-5px text-18px text-stone-900 font-semibold dark:text-stone-50">字段摘要与分布细节</div>
            </div>
            <div class="text-12px text-stone-500 dark:text-stone-400">展开字段可查看额外指标和 Top 10 分布</div>
          </div>
          <div
            class="overflow-hidden border border-stone-200/90 rounded-20px bg-white/95 shadow-[0_18px_34px_rgba(15,23,42,0.04)] dark:border-stone-700/70 dark:bg-stone-950/25"
          >
            <NDataTable
              v-if="columnRows.length"
              :columns="profileCols"
              :data="columnRows"
              :row-key="(r: ColRow) => r.uuid"
              :single-line="false"
              size="small"
              :scroll-x="780"
            />
            <NEmpty v-else description="暂无列画像数据" class="py-60px" />
          </div>
        </div>
      </div>
      <NEmpty v-else-if="!profileLoading" description="尚未执行数据概览" class="py-60px" />
    </NSpin>

    <ProfileExecutionDrawer v-model:show="historyVisible" :entity-uuid="tableUuid" title="表数据概览执行历史" />
    <ProfileExecuteModal
      v-model:show="executeVisible"
      :table-uuid="tableUuid"
      :table-name="overview?.tableName || ''"
      :columns="columns"
      :task="currentTask"
      @executed="handleExecuted"
    />
    <ProfileTaskScheduleDrawer
      v-model:show="scheduleVisible"
      scope-type="table"
      :entity-uuid="tableUuid"
      :entity-name="overview?.tableName || ''"
      :task="currentTask"
      @saved="loadProfiles"
    />
  </div>
</template>
