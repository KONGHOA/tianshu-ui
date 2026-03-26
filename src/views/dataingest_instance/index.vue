<script setup lang="tsx">
import { ref } from 'vue';
import { NCard, NDataTable, NDrawer, NDrawerContent, NTag } from 'naive-ui';
import { fetchCancelJobInstance, fetchGetJobInstanceList, fetchSyncInstanceStatus } from '@/service/api/dataingest';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import InstanceSearch from './modules/InstanceSearch.vue';
import InstanceDetailDrawer from './modules/InstanceDetailDrawer.vue';

defineOptions({
  name: 'DataingestInstanceList'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Dataingest.IngestJobInstanceSearchParams>({
  pageNum: 1,
  pageSize: 10,
  jobId: null,
  jobStatus: null,
  triggerType: null,
  params: {}
});

const detailVisible = ref(false);
const currentInstanceId = ref<CommonType.IdType | null>(null);
const searchDrawerVisible = ref(false);

function handleSearch() {
  getDataByPage();
  searchDrawerVisible.value = false;
}

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

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetJobInstanceList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page;
      searchParams.value.pageSize = params.pageSize;
    },
    columns: () => [
      {
        key: 'index',
        title: $t('common.index'),
        align: 'center',
        width: 64,
        render: (_, index) => index + 1
      },
      {
        key: 'instanceId',
        title: '实例ID',
        align: 'center',
        width: 90
      },
      {
        key: 'jobName',
        title: '作业名称',
        align: 'center',
        minWidth: 140,
        render: row => row.jobName ?? String(row.jobId)
      },
      {
        key: 'jobStatus',
        title: '执行状态',
        align: 'center',
        width: 90,
        render: row => {
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
        align: 'center',
        width: 90,
        render: row => row.triggerType ?? '-'
      },
      {
        key: 'startTime',
        title: '开始时间',
        align: 'center',
        width: 155,
        render: row => row.startTime ?? '-'
      },
      {
        key: 'endTime',
        title: '结束时间',
        align: 'center',
        width: 155,
        render: row => row.endTime ?? '-'
      },
      {
        key: 'readRowCount',
        title: '读取行数',
        align: 'center',
        width: 90,
        render: row => (row.readRowCount !== undefined && row.readRowCount !== null ? row.readRowCount : '-')
      },
      {
        key: 'writeRowCount',
        title: '写入行数',
        align: 'center',
        width: 90,
        render: row => (row.writeRowCount !== undefined && row.writeRowCount !== null ? row.writeRowCount : '-')
      },
      {
        key: 'incrementalColumn',
        title: '增量列',
        align: 'center',
        width: 120,
        render: row =>
          row.incremental ? (
            <NTag size="small" type="info" round bordered={false}>
              <span class="font-mono">{row.incrementalColumn ?? '未配置'}</span>
            </NTag>
          ) : (
            '-'
          )
      },
      {
        key: 'incrementalRangeText',
        title: '本次水位区间',
        align: 'center',
        minWidth: 240,
        render: row =>
          row.incremental ? (
            <div class="text-left text-12px leading-18px">
              <div class="font-mono">{row.incrementalStartValue ?? '起始未记录'}</div>
              <div class="op-50">至</div>
              <div class="font-mono">{row.incrementalUpperBound ?? '结束未记录'}</div>
            </div>
          ) : (
            '-'
          )
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 130,
        render: row => {
          const syncBtn = () => {
            if (!hasAuth('dataingest:instance:query')) return null;
            return (
              <ButtonIcon
                text
                type="primary"
                icon="material-symbols:sync"
                tooltipContent="同步状态"
                onClick={() => handleSync(row.instanceId!)}
              />
            );
          };

          const detailBtn = () => {
            if (!hasAuth('dataingest:instance:list')) return null;
            return (
              <ButtonIcon
                text
                type="primary"
                icon="material-symbols:visibility-outline-rounded"
                tooltipContent="详情"
                onClick={() => handleDetail(row.instanceId!)}
              />
            );
          };

          const cancelBtn = () => {
            if (!hasAuth('dataingest:instance:cancel')) return null;
            const canCancel = row.jobStatus === 'RUNNING' || row.jobStatus === 'SUBMITTED';
            if (!canCancel) return null;
            return (
              <ButtonIcon
                text
                type="error"
                icon="material-symbols:stop-circle-outline"
                tooltipContent="取消"
                popconfirmContent="确认取消该实例？"
                onPositiveClick={() => handleCancel(row.instanceId!)}
              />
            );
          };

          return (
            <div class="flex-center gap-8px">
              {detailBtn()}
              {syncBtn()}
              {cancelBtn()}
            </div>
          );
        }
      }
    ]
  });

async function handleSync(instanceId: CommonType.IdType) {
  const { error } = await fetchSyncInstanceStatus(instanceId);
  if (!error) {
    window.$message?.success('状态已同步');
    getData();
  }
}

async function handleCancel(instanceId: CommonType.IdType) {
  const { error } = await fetchCancelJobInstance(instanceId);
  if (!error) {
    window.$message?.success('取消成功');
    getData();
  }
}

function handleDetail(instanceId: CommonType.IdType) {
  currentInstanceId.value = instanceId;
  detailVisible.value = true;
}
</script>

<template>
  <div class="relative h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="执行历史" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="true"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          :show-export="false"
          @refresh="getData"
        >
          <template #after>
            <NButton size="small" @click="searchDrawerVisible = true">
              <template #icon>
                <icon-material-symbols-filter-alt-outline class="text-icon" />
              </template>
              筛选
            </NButton>
          </template>
        </TableHeaderOperation>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="row => row.instanceId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>
    <InstanceDetailDrawer v-model:visible="detailVisible" :instance-id="currentInstanceId" />
    <NDrawer v-model:show="searchDrawerVisible" :width="360" display-directive="show">
      <NDrawerContent title="筛选条件" :native-scrollbar="false" closable>
        <InstanceSearch v-model:model="searchParams" @reset="getDataByPage" @search="handleSearch" />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped lang="scss">
:deep(.n-data-table-wrapper),
:deep(.n-data-table-base-table),
:deep(.n-data-table-base-table-body) {
  height: 100%;
}

@media screen and (max-width: 800px) {
  :deep(.n-data-table-base-table-body) {
    max-height: calc(100vh - 400px - var(--calc-footer-height, 0px));
  }
}

:deep(.n-card-header__main) {
  min-width: 69px !important;
}
</style>
