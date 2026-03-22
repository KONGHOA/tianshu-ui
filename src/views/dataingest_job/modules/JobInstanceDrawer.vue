<script setup lang="tsx">
import { ref, watch } from 'vue';
import { NButton, NDataTable, NDrawer, NDrawerContent, NTag } from 'naive-ui';
import { fetchCancelJobInstance, fetchGetJobInstanceList, fetchSyncInstanceStatus } from '@/service/api/dataingest';
import ButtonIcon from '@/components/custom/button-icon.vue';
import InstanceDetailDrawer from '@/views/dataingest_instance/modules/InstanceDetailDrawer.vue';

defineOptions({ name: 'JobInstanceDrawer' });

interface Props {
  jobId: CommonType.IdType | null;
  jobName?: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { default: false });

const loading = ref(false);
const data = ref<Api.Dataingest.IngestJobInstance[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const detailVisible = ref(false);
const currentInstanceId = ref<CommonType.IdType | null>(null);

type JobStatus = Api.Dataingest.IngestJobInstance['jobStatus'];

const STATUS_CONFIG: Record<JobStatus, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> =
  {
    SUBMITTED: { label: '已提交', type: 'info' },
    RUNNING: { label: '运行中', type: 'info' },
    SUCCEED: { label: '成功', type: 'success' },
    FAILED: { label: '失败', type: 'error' },
    CANCELLED: { label: '已取消', type: 'default' },
    PAUSED: { label: '已暂停', type: 'warning' },
    UNKNOWN: { label: '未知', type: 'default' }
  };

const columns = [
  {
    key: 'index',
    title: '#',
    align: 'center' as const,
    width: 48,
    render: (_: any, index: number) => (page.value - 1) * pageSize.value + index + 1
  },
  {
    key: 'jobStatus',
    title: '状态',
    align: 'center' as const,
    width: 80,
    render: (row: Api.Dataingest.IngestJobInstance) => {
      const cfg = STATUS_CONFIG[row.jobStatus] ?? { label: row.jobStatus, type: 'default' as const };
      return (
        <NTag type={cfg.type} size="small">
          {cfg.label}
        </NTag>
      );
    }
  },
  {
    key: 'triggerType',
    title: '触发方式',
    align: 'center' as const,
    width: 80,
    render: (row: Api.Dataingest.IngestJobInstance) => row.triggerType ?? '-'
  },
  {
    key: 'startTime',
    title: '开始时间',
    align: 'center' as const,
    width: 155,
    render: (row: Api.Dataingest.IngestJobInstance) => row.startTime ?? '-'
  },
  {
    key: 'endTime',
    title: '结束时间',
    align: 'center' as const,
    width: 155,
    render: (row: Api.Dataingest.IngestJobInstance) => row.endTime ?? '-'
  },
  {
    key: 'readRowCount',
    title: '读取',
    align: 'center' as const,
    width: 70,
    render: (row: Api.Dataingest.IngestJobInstance) => row.readRowCount ?? '-'
  },
  {
    key: 'writeRowCount',
    title: '写入',
    align: 'center' as const,
    width: 70,
    render: (row: Api.Dataingest.IngestJobInstance) => row.writeRowCount ?? '-'
  },
  {
    key: 'operate',
    title: '操作',
    align: 'center' as const,
    width: 100,
    render: (row: Api.Dataingest.IngestJobInstance) => {
      const canCancel = row.jobStatus === 'RUNNING' || row.jobStatus === 'SUBMITTED';
      return (
        <div class="flex-center gap-4px">
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:visibility-outline-rounded"
            tooltipContent="详情"
            onClick={() => handleDetail(row.instanceId!)}
          />
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:sync"
            tooltipContent="同步状态"
            onClick={() => handleSync(row.instanceId!)}
          />
          {canCancel && (
            <ButtonIcon
              text
              type="error"
              icon="material-symbols:stop-circle-outline"
              tooltipContent="取消"
              popconfirmContent="确认取消该实例？"
              onPositiveClick={() => handleCancel(row.instanceId!)}
            />
          )}
        </div>
      );
    }
  }
];

watch(
  () => [visible.value, props.jobId] as const,
  ([show, jobId]) => {
    if (show && jobId) {
      page.value = 1;
      loadData();
    }
  },
  { immediate: true }
);

async function loadData() {
  if (!props.jobId) return;
  loading.value = true;
  const { data: resp, error } = await fetchGetJobInstanceList({
    jobId: String(props.jobId),
    jobStatus: null,
    triggerType: null,
    pageNum: page.value,
    pageSize: pageSize.value,
    params: {}
  });
  loading.value = false;
  if (!error && resp) {
    data.value = resp.rows ?? [];
    total.value = resp.total ?? 0;
  }
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handleDetail(instanceId: CommonType.IdType) {
  currentInstanceId.value = instanceId;
  detailVisible.value = true;
}

async function handleSync(instanceId: CommonType.IdType) {
  const { error } = await fetchSyncInstanceStatus(instanceId);
  if (!error) {
    window.$message?.success('状态已同步');
    loadData();
  }
}

async function handleCancel(instanceId: CommonType.IdType) {
  const { error } = await fetchCancelJobInstance(instanceId);
  if (!error) {
    window.$message?.success('取消成功');
    loadData();
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="880" display-directive="show" class="max-w-95%">
    <NDrawerContent :native-scrollbar="false" closable>
      <template #header>
        <span>执行历史</span>
        <span v-if="props.jobName" class="ml-8px text-14px text-gray-400 font-normal">{{ props.jobName }}</span>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :loading="loading"
        :row-key="(row: Api.Dataingest.IngestJobInstance) => row.instanceId"
        :pagination="{
          page,
          pageSize,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 50],
          onUpdatePage: handlePageChange,
          onUpdatePageSize: handlePageSizeChange
        }"
        remote
      />
      <template #footer>
        <NButton @click="visible = false">关闭</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
  <InstanceDetailDrawer v-model:visible="detailVisible" :instance-id="currentInstanceId" />
</template>
