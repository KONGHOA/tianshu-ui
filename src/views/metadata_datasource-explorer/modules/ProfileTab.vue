<script setup lang="tsx">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { NButton, NDataTable, NEmpty, NIcon, NSpin, NTag, NTooltip } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import * as echarts from 'echarts/core';
import { useBoolean, useLoading } from '@sa/hooks';
import { fetchGetAllProfiles, fetchGetProfileTrend, fetchTriggerTableProfile } from '@/service/api/metadata/profile';
import type { ECOption } from '@/hooks/common/echarts';
import { useEcharts } from '@/hooks/common/echarts';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  tableUuid: string;
  columns: Api.Metadata.EntityInstance[];
}

const props = defineProps<Props>();

// ─── State ────────────────────────────────────────────────────────────────────
const { loading: profileLoading, startLoading: startProfile, endLoading: endProfile } = useLoading();
const { bool: triggerLoading, setTrue: startTrigger, setFalse: endTrigger } = useBoolean();

const trendData = ref<{ date: string; value: number }[]>([]);
const tableRowCount = ref<number>(0);
const columnProfileMap = ref<Record<string, Record<string, string>>>({});
const loaded = ref(false);

// ─── ECharts 趋势图 ───────────────────────────────────────────────────────────
const chartOptions: ECOption = {
  grid: { top: 20, right: 20, bottom: 28, left: 48, containLabel: false },
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const p = Array.isArray(params) ? params[0] : params;
      return `${p.axisValue}<br/><b>${Number(p.value).toLocaleString()}</b> 行`;
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
    }
  ]
};

const { domRef: trendDomRef, updateOptions } = useEcharts(() => chartOptions);

// ─── 工具函数 ──────────────────────────────────────────────────────────────────
function parseProps(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function pct(count: number, total: number): string {
  if (!total || !count) return '0.00%';
  return `${((count / total) * 100).toFixed(2)}%`;
}

function fmt(v: string | undefined): string {
  return v !== undefined && v !== null && v !== '' ? v : '-';
}

// ─── 数据加载 ─────────────────────────────────────────────────────────────────
async function loadProfiles() {
  if (!props.tableUuid) return;
  startProfile();
  loaded.value = false;

  const [trendRes, ...colResults] = await Promise.all([
    fetchGetProfileTrend(props.tableUuid),
    ...props.columns.map(col => fetchGetAllProfiles(col.uuid))
  ]);

  if (!trendRes.error && trendRes.data) {
    const pts = (trendRes.data ?? []).map(p => ({
      date: p.dataDate ? String(p.dataDate).slice(0, 10) : String(p.createTime).slice(0, 10),
      value: Number(p.actualValue) || 0
    }));
    trendData.value = pts;
    tableRowCount.value = pts.length > 0 ? pts[pts.length - 1].value : 0;
    updateOptions(opts => {
      const o = opts as any;
      o.xAxis.data = pts.map(p => p.date);
      o.series[0].data = pts.map(p => p.value);
      return o;
    });
  }

  const newMap: Record<string, Record<string, string>> = {};
  props.columns.forEach((col, idx) => {
    const res = colResults[idx];
    if (!res.error && res.data) {
      newMap[col.uuid] = Object.fromEntries(res.data.map(p => [p.metricName, p.actualValue ?? '']));
    }
  });
  columnProfileMap.value = newMap;
  loaded.value = true;
  endProfile();
}

async function handleTrigger() {
  startTrigger();
  const res = await fetchTriggerTableProfile(props.tableUuid);
  endTrigger();
  if (!res.error) window.$message?.success('数据概览已触发，后台计算中，请稍后点「刷新结果」');
}

watch(
  () => props.tableUuid,
  () => {
    columnProfileMap.value = {};
    trendData.value = [];
    tableRowCount.value = 0;
    loaded.value = false;
  },
  { immediate: false }
);

// ─── 列表计算属性 ──────────────────────────────────────────────────────────────
interface ColRow {
  uuid: string;
  displayName: string;
  type: string;
  dataType: string;
  nullCount: number;
  notNullCount: number;
  distinctCount: number;
  uniqueCount: number;
  profile: Record<string, string>;
}

const columnRows = computed<ColRow[]>(() =>
  props.columns.map(col => {
    const p = parseProps(col.properties);
    const profile = columnProfileMap.value[col.uuid] ?? {};
    return {
      uuid: col.uuid,
      displayName: col.displayName,
      type: String(p.type ?? '-'),
      dataType: String(p.dataType ?? '').toLowerCase(),
      nullCount: Number(profile.column_null ?? 0),
      notNullCount: Number(profile.column_not_null ?? 0),
      distinctCount: Number(profile.column_distinct ?? 0),
      uniqueCount: Number(profile.column_unique ?? 0),
      profile
    };
  })
);

// ─── Top10 解析 ───────────────────────────────────────────────────────────────
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

// ─── 展开行组件（独立组件，支持 ECharts 生命周期）────────────────────────────
const ExpandedRow = defineComponent({
  name: 'ExpandedRow',
  props: {
    row: { type: Object as PropType<ColRow>, required: true }
  },
  setup(rowProps) {
    const top10ChartRef = ref<HTMLElement | null>(null);
    let chartInstance: echarts.ECharts | null = null;

    const top10Items = computed(() => parseTop10(rowProps.row.profile.column_top10));

    const isNumeric = computed(() =>
      ['int', 'decimal', 'float', 'double', 'bigint', 'tinyint', 'smallint', 'number', 'numeric'].some(t =>
        rowProps.row.dataType.includes(t)
      )
    );
    const isString = computed(() => ['char', 'text', 'varchar', 'blob'].some(t => rowProps.row.dataType.includes(t)));

    const extraMetrics = computed(() => {
      const p = rowProps.row.profile;
      const result: { label: string; value: string }[] = [];
      if (fmt(p.column_max) !== '-' || fmt(p.column_min) !== '-') {
        result.push({ label: '最大值', value: fmt(p.column_max) });
        result.push({ label: '最小值', value: fmt(p.column_min) });
      }
      if (isNumeric.value) {
        if (fmt(p.column_avg) !== '-') result.push({ label: '均值', value: fmt(p.column_avg) });
        if (fmt(p.column_sum) !== '-') result.push({ label: '求和', value: fmt(p.column_sum) });
      }
      if (isString.value) {
        if (fmt(p.column_max_length) !== '-') result.push({ label: '最大长度', value: fmt(p.column_max_length) });
        if (fmt(p.column_min_length) !== '-') result.push({ label: '最小长度', value: fmt(p.column_min_length) });
        if (fmt(p.column_avg_length) !== '-') result.push({ label: '平均长度', value: fmt(p.column_avg_length) });
      }
      return result;
    });

    function initChart() {
      const items = top10Items.value;
      if (!top10ChartRef.value || items.length === 0) return;
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
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11 }
        },
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

    onMounted(() => {
      initChart();
    });

    onUnmounted(() => {
      chartInstance?.dispose();
      chartInstance = null;
    });

    return () => {
      const hasExtra = extraMetrics.value.length > 0;
      const hasTop10 = top10Items.value.length > 0;

      return (
        <div class="flex gap-24px bg-gray-50 px-16px py-12px dark:bg-gray-900/40">
          {hasExtra && (
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

          {hasTop10 && (
            <div class="min-w-0 flex-1">
              <p class="mb-4px text-11px text-gray-400 font-semibold tracking-wide uppercase">Top 10 分布</p>
              <div ref={top10ChartRef} style="height: 180px; width: 100%" />
            </div>
          )}

          {!hasExtra && !hasTop10 && <span class="text-12px text-gray-400">暂无额外指标数据</span>}
        </div>
      );
    };
  }
});

// ─── 表格列定义 ───────────────────────────────────────────────────────────────
function renderCountPct(count: number, total: number) {
  if (!loaded.value) return <span class="text-gray-300">-</span>;
  return (
    <span>
      <span class="font-medium tabular-nums">{count.toLocaleString()}</span>
      <span class="ml-4px text-11px text-gray-400">[{pct(count, total)}]</span>
    </span>
  );
}

const profileCols: DataTableColumns<ColRow> = [
  {
    type: 'expand',
    expandable: row =>
      loaded.value &&
      (Boolean(row.profile.column_max) || Boolean(row.profile.column_top10) || Boolean(row.profile.column_max_length)),
    renderExpand: row => <ExpandedRow row={row} />
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
    render: row => renderCountPct(row.nullCount, row.nullCount + row.notNullCount)
  },
  {
    title: '非空值',
    key: 'notNull',
    width: 130,
    render: row => renderCountPct(row.notNullCount, row.nullCount + row.notNullCount)
  },
  {
    title: '不同值',
    key: 'distinct',
    width: 130,
    render: row => renderCountPct(row.distinctCount, tableRowCount.value)
  },
  {
    title: '唯一值',
    key: 'unique',
    width: 130,
    render: row => renderCountPct(row.uniqueCount, tableRowCount.value)
  }
];
</script>

<template>
  <div class="flex flex-col gap-0">
    <!-- ── 操作栏 ── -->
    <div class="flex items-center gap-10px border-b border-gray-100 px-20px py-12px dark:border-gray-800">
      <NButton size="small" type="primary" secondary :loading="triggerLoading" @click="handleTrigger">
        <template #icon>
          <NIcon><div class="i-mdi-play-circle-outline" /></NIcon>
        </template>
        执行数据概览
      </NButton>
      <NButton size="small" :loading="profileLoading" secondary @click="loadProfiles">
        <template #icon>
          <NIcon><div class="i-mdi-refresh" /></NIcon>
        </template>
        刷新结果
      </NButton>
      <span v-if="!loaded && !profileLoading" class="text-12px text-gray-400">
        点击「执行数据概览」触发计算，完成后点「刷新结果」查看
      </span>
      <span
        v-if="loaded && tableRowCount > 0"
        class="ml-auto flex items-center gap-6px rounded-6px bg-blue-50 px-10px py-4px text-12px dark:bg-blue-900/20"
      >
        <NIcon class="text-blue-500"><div class="i-mdi-table-large" /></NIcon>
        <span class="text-gray-500">总行数</span>
        <span class="text-blue-600 font-bold dark:text-blue-400">{{ tableRowCount.toLocaleString() }}</span>
      </span>
    </div>

    <NSpin :show="profileLoading" class="min-h-120px">
      <!-- ── 趋势折线图 ── -->
      <div v-if="trendData.length >= 1" class="border-b border-gray-100 px-20px pb-16px pt-12px dark:border-gray-800">
        <p class="mb-8px text-12px text-gray-500 font-medium">
          <NIcon class="mr-4px align-middle text-gray-400"><div class="i-mdi-chart-line" /></NIcon>
          表数据量趋势
        </p>
        <div ref="trendDomRef" class="h-140px w-full" />
      </div>

      <!-- ── 列 Profile 表格 ── -->
      <div v-if="loaded">
        <NDataTable
          v-if="columnRows.length"
          :columns="profileCols"
          :data="columnRows"
          :row-key="(r: ColRow) => r.uuid"
          :single-line="false"
          size="small"
          :scroll-x="780"
        />
        <NEmpty v-else description="暂无列信息" class="py-60px" />
      </div>
      <NEmpty v-else-if="!profileLoading" description="尚未执行数据概览" class="py-60px" />
    </NSpin>
  </div>
</template>
