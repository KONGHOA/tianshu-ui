<script setup lang="tsx">
import { ref } from 'vue';
import { NCard, NDataTable, NDropdown, NTag } from 'naive-ui';
import { fetchBatchDeleteIngestJob, fetchExecuteJob, fetchGetIngestJobList } from '@/service/api/dataingest';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import JobOperateDrawer from './modules/JobOperateDrawer.vue';
import JobInstanceDrawer from './modules/JobInstanceDrawer.vue';
import JobSearch from './modules/JobSearch.vue';
import WholeDbJobDrawer from './modules/WholeDbJobDrawer.vue';

defineOptions({
  name: 'DataingestJobList'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Dataingest.IngestJobSearchParams>({
  pageNum: 1,
  pageSize: 10,
  jobName: null,
  jobType: null,
  status: null,
  srcDatasourceId: null,
  sinkDatasourceId: null,
  params: {}
});

const instanceDrawerVisible = ref(false);
const instanceJobId = ref<CommonType.IdType | null>(null);
const instanceJobName = ref('');

const JOB_TYPE_MAP: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  BATCH: { label: '离线批量', type: 'info' },
  STREAM: { label: '实时流式', type: 'success' },
  CDC: { label: 'CDC变更', type: 'warning' }
};

const STATUS_MAP: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  '0': { label: '启用', type: 'success' },
  '1': { label: '停用', type: 'default' }
};

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetIngestJobList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page;
      searchParams.value.pageSize = params.pageSize;
    },
    columns: () => [
      {
        type: 'selection',
        align: 'center',
        width: 48
      },
      {
        key: 'index',
        title: $t('common.index'),
        align: 'center',
        width: 64,
        render: (_, index) => index + 1
      },
      {
        key: 'jobName',
        title: '作业名称',
        align: 'center',
        minWidth: 160
      },
      {
        key: 'jobType',
        title: '作业类型',
        align: 'center',
        width: 100,
        render: row => {
          const cfg = JOB_TYPE_MAP[row.jobType] ?? { label: row.jobType, type: 'default' as const };
          return (
            <NTag type={cfg.type} size="small">
              {cfg.label}
            </NTag>
          );
        }
      },
      {
        key: 'syncMode',
        title: '同步模式',
        align: 'center',
        width: 100,
        render: row => {
          const map: Record<
            string,
            { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' | 'primary' }
          > = {
            SINGLE: { label: '单表同步', type: 'primary' },
            WHOLE_DATABASE: { label: '整库同步', type: 'warning' }
          };
          const cfg = row.syncMode
            ? (map[row.syncMode] ?? { label: row.syncMode, type: 'default' as const })
            : { label: '-', type: 'default' as const };
          return (
            <NTag type={cfg.type} size="small" bordered={false}>
              {cfg.label}
            </NTag>
          );
        }
      },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        width: 80,
        render: row => {
          const cfg = STATUS_MAP[row.status] ?? { label: row.status, type: 'default' as const };
          return (
            <NTag type={cfg.type} size="small">
              {cfg.label}
            </NTag>
          );
        }
      },
      {
        key: 'scheduleType',
        title: '调度方式',
        align: 'center',
        width: 100,
        render: row => row.scheduleType ?? '-'
      },
      {
        key: 'remark',
        title: '备注',
        align: 'center',
        minWidth: 120,
        render: row => row.remark ?? '-'
      },
      {
        key: 'createTime',
        title: '创建时间',
        align: 'center',
        width: 160
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 240,
        render: row => {
          const executeBtn = () => {
            if (!hasAuth('dataingest:job:execute')) return null;
            return (
              <ButtonIcon
                type="success"
                text
                icon="material-symbols:play-arrow-outline"
                tooltipContent="执行"
                onClick={() => handleExecute(row.jobId!)}
              />
            );
          };

          const historyBtn = () => {
            return (
              <ButtonIcon
                text
                type="info"
                icon="material-symbols:history"
                tooltipContent="执行历史"
                onClick={() => handleShowHistory(row.jobId!, row.jobName ?? '')}
              />
            );
          };

          const editBtn = () => {
            if (!hasAuth('dataingest:job:edit')) return null;
            return (
              <ButtonIcon
                type="primary"
                text
                icon="material-symbols:drive-file-rename-outline-outline"
                tooltipContent={$t('common.edit')}
                onClick={() => editRow(row)}
              />
            );
          };

          const deleteBtn = () => {
            if (!hasAuth('dataingest:job:remove')) return null;
            return (
              <ButtonIcon
                text
                type="error"
                icon="material-symbols:delete-outline"
                tooltipContent={$t('common.delete')}
                popconfirmContent={$t('common.confirmDelete')}
                onPositiveClick={() => handleDelete(row.jobId!)}
              />
            );
          };

          return (
            <div class="flex-center gap-8px">
              {executeBtn()}
              {historyBtn()}
              {editBtn()}
              {deleteBtn()}
            </div>
          );
        }
      }
    ]
  });

const { drawerVisible, operateType, editingData, handleEdit, checkedRowKeys, onBatchDeleted, onDeleted } =
  useTableOperate(data, 'jobId', getData);

const currentSyncMode = ref<'SINGLE' | 'WHOLE_DATABASE'>('SINGLE');
const wholeDbDrawerVisible = ref(false);

const addOptions = [
  { label: '单表同步', key: 'SINGLE' },
  { label: '整库同步', key: 'WHOLE_DATABASE' }
];

function handleAddSplit(mode: string) {
  operateType.value = 'add';
  editingData.value = null;
  if (mode === 'WHOLE_DATABASE') {
    wholeDbDrawerVisible.value = true;
  } else {
    currentSyncMode.value = 'SINGLE';
    drawerVisible.value = true;
  }
}

function editRow(row: Api.Dataingest.IngestJob) {
  operateType.value = 'edit';
  editingData.value = row;
  if (row.syncMode === 'WHOLE_DATABASE') {
    wholeDbDrawerVisible.value = true;
  } else {
    handleEdit(row.jobId!);
  }
}

async function handleBatchDelete() {
  const { error } = await fetchBatchDeleteIngestJob(checkedRowKeys.value as number[]);
  if (error) return;
  onBatchDeleted();
}

async function handleDelete(jobId: CommonType.IdType) {
  const { error } = await fetchBatchDeleteIngestJob([jobId]);
  if (error) return;
  onDeleted();
}

function handleShowHistory(jobId: CommonType.IdType, jobName: string) {
  instanceJobId.value = jobId;
  instanceJobName.value = jobName;
  instanceDrawerVisible.value = true;
}

async function handleExecute(jobId: CommonType.IdType) {
  const { error } = await fetchExecuteJob(jobId);
  if (!error) {
    window.$message?.success('作业已提交执行');
    getData();
  }
}
</script>

<template>
  <div class="relative h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <JobSearch v-model:model="searchParams" @reset="getDataByPage" @search="getDataByPage" />

    <NCard title="接入作业列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="false"
          :show-delete="hasAuth('dataingest:job:remove')"
          :show-export="false"
          @delete="handleBatchDelete"
          @refresh="getData"
        >
          <template #prefix>
            <NDropdown :options="addOptions" @select="handleAddSplit">
              <NButton v-if="hasAuth('dataingest:job:add')" size="small" ghost type="primary">
                <template #icon>
                  <icon-material-symbols-add class="text-icon" />
                </template>
                新增作业
              </NButton>
            </NDropdown>
          </template>
        </TableHeaderOperation>
      </template>
      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="row => row.jobId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>
    <JobOperateDrawer
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :row-data="editingData"
      :initial-sync-mode="currentSyncMode"
      @submitted="getData"
    />
    <WholeDbJobDrawer
      v-model:visible="wholeDbDrawerVisible"
      :operate-type="operateType"
      :row-data="editingData"
      @submitted="getData"
    />
    <JobInstanceDrawer v-model:visible="instanceDrawerVisible" :job-id="instanceJobId" :job-name="instanceJobName" />
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
