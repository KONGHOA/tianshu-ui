<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NCode, NDataTable, NDrawer, NDrawerContent, NEmpty, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { useLoading } from '@sa/hooks';
import { fetchGetProfileExecutionList, fetchGetProfileExecutionLog } from '@/service/api/metadata/profile-execution';

interface Props {
  show: boolean;
  entityUuid: string;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '执行历史'
});

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const { loading, startLoading, endLoading } = useLoading();
const rows = ref<Api.Metadata.ProfileExecution[]>([]);
const logVisible = ref(false);
const currentExecution = ref<Api.Metadata.ProfileExecution | null>(null);
const executionLog = ref('');
const logLoading = ref(false);

const visible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

function formatDateTime(value?: string) {
  if (!value) return '-';
  return value.slice(0, 19).replace('T', ' ');
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

function getStatusMeta(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return { type: 'success' as const, label: '成功' };
  if (normalized === 'failed') return { type: 'error' as const, label: '失败' };
  if (normalized === 'running') return { type: 'warning' as const, label: '运行中' };
  if (normalized === 'partial_success') return { type: 'warning' as const, label: '部分成功' };
  if (normalized === 'pending') return { type: 'default' as const, label: '排队中' };
  if (normalized === 'cancelled') return { type: 'default' as const, label: '已取消' };
  return { type: 'default' as const, label: status || '-' };
}

async function loadExecutions() {
  if (!props.entityUuid) {
    rows.value = [];
    return;
  }
  startLoading();
  const res = await fetchGetProfileExecutionList({
    entityUuid: props.entityUuid,
    pageNum: 1,
    pageSize: 20
  });
  rows.value = res.error ? [] : (res.data?.rows ?? []);
  endLoading();
}

async function handleViewLog(row: Api.Metadata.ProfileExecution) {
  currentExecution.value = row;
  executionLog.value = '';
  logVisible.value = true;
  logLoading.value = true;
  const res = await fetchGetProfileExecutionLog(row.executionId);
  executionLog.value = res.error ? '' : (res.data ?? '');
  logLoading.value = false;
}

watch(
  () => [props.show, props.entityUuid],
  ([show]) => {
    if (show) {
      loadExecutions();
    }
  }
);

const columns: DataTableColumns<Api.Metadata.ProfileExecution> = [
  {
    title: '批次号',
    key: 'batchNo',
    width: 260,
    ellipsis: { tooltip: true },
    render: row => <span class="text-12px font-mono">{row.batchNo || '-'}</span>
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render: row => {
      const meta = getStatusMeta(row.status);
      return (
        <NTag size="small" bordered={false} type={meta.type}>
          {meta.label}
        </NTag>
      );
    }
  },
  {
    title: '开始时间',
    key: 'startTime',
    width: 170,
    render: row => formatDateTime(row.startTime)
  },
  {
    title: '结束时间',
    key: 'endTime',
    width: 170,
    render: row => formatDateTime(row.endTime)
  },
  {
    title: '耗时',
    key: 'durationMs',
    width: 100,
    render: row => formatDuration(row.durationMs)
  },
  {
    title: '表数统计',
    key: 'tableStats',
    width: 180,
    render: row => {
      const total = row.profiledTableCount ?? 0;
      const success = row.successTableCount ?? 0;
      const failed = row.failedTableCount ?? 0;
      if (!total && !success && !failed) return '-';
      return `总 ${total} / 成 ${success} / 败 ${failed}`;
    }
  },
  {
    title: '错误信息',
    key: 'errorMessage',
    minWidth: 240,
    ellipsis: { tooltip: true },
    render: row => row.errorMessage || '-'
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
    render: row => (
      <NButton text type="primary" onClick={() => handleViewLog(row)}>
        查看日志
      </NButton>
    )
  }
];
</script>

<template>
  <NDrawer v-model:show="visible" :width="960" display-directive="show" class="max-w-95%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <div class="mb-12px flex items-center justify-end">
        <NButton size="small" secondary :loading="loading" @click="loadExecutions">刷新</NButton>
      </div>

      <NAlert type="info" class="mb-12px">当前展示最近 20 次画像执行记录，包含批次号、状态、耗时和错误信息。</NAlert>

      <NDataTable
        v-if="rows.length"
        :columns="columns"
        :data="rows"
        :loading="loading"
        :single-line="false"
        size="small"
        :scroll-x="1100"
        :row-key="row => row.executionId"
      />
      <NEmpty v-else-if="!loading" description="暂无执行历史" class="py-60px" />
    </NDrawerContent>
  </NDrawer>

  <NDrawer v-model:show="logVisible" :width="820" display-directive="show" class="max-w-95%">
    <NDrawerContent :title="`执行日志 · ${currentExecution?.batchNo || '-'}`" :native-scrollbar="false" closable>
      <div class="mb-12px flex items-center justify-between">
        <span class="text-12px text-gray-500">
          {{ currentExecution?.status || '-' }} · {{ formatDateTime(currentExecution?.startTime) }}
        </span>
        <NButton
          size="small"
          secondary
          :loading="logLoading"
          :disabled="!currentExecution?.executionId"
          @click="currentExecution?.executionId && handleViewLog(currentExecution)"
        >
          刷新日志
        </NButton>
      </div>

      <NEmpty v-if="!logLoading && !executionLog" description="暂无执行日志" class="py-60px" />
      <NCode
        v-else
        :code="executionLog || '日志加载中...'"
        language="text"
        word-wrap
        show-line-numbers
        class="max-h-70vh overflow-auto rounded-8px bg-gray-950/95 p-12px text-12px"
      />
    </NDrawerContent>
  </NDrawer>
</template>
