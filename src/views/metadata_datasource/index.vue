<script setup lang="tsx">
import { ref } from 'vue';
import { NCard, NDataTable } from 'naive-ui';
import {
  fetchBatchDeleteDatasource,
  fetchGetDatasourceList,
  fetchRefreshDatasource,
  fetchTestConnectionById
} from '@/service/api/metadata/datasource';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useDownload } from '@/hooks/business/download';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { useDict } from '@/hooks/business/dict';
import DictTag from '@/components/custom/dict-tag.vue';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import DatasourceOperateDrawer from './modules/datasource-operate-drawer.vue';
import DatasourceSearch from './modules/datasource-search.vue';

defineOptions({
  name: 'MetadataDatasourceList'
});

useDict('sys_normal_disable');
const appStore = useAppStore();
const { download } = useDownload();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Metadata.DatasourceSearchParams>({
  pageNum: 1,
  pageSize: 10,
  datasourceName: null,
  datasourceType: null,
  status: null,
  params: {}
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetDatasourceList(searchParams.value),
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
        key: 'datasourceName',
        title: '数据源名称',
        align: 'center',
        minWidth: 160
      },
      {
        key: 'datasourceType',
        title: '数据源类型',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        minWidth: 120,
        render(row) {
          return <DictTag size="small" value={row.status} dictCode="sys_normal_disable" />;
        }
      },
      {
        key: 'createTime',
        title: '创建时间',
        align: 'center',
        minWidth: 120,
        ellipsis: {
          tooltip: true
        }
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 200,
        render: row => {
          const testBtn = () => {
            if (!hasAuth('metadata:datasource:query')) {
              return null;
            }
            return (
              <ButtonIcon
                type="info"
                text
                icon="mdi:connection"
                tooltipContent="测试连接"
                onClick={() => handleTestConnection(row.datasourceId!)}
              />
            );
          };

          const refreshBtn = () => {
            if (!hasAuth('metadata:datasource:query')) {
              return null;
            }
            return (
              <ButtonIcon
                type="primary"
                text
                icon="mdi:refresh"
                tooltipContent="刷新元数据"
                popconfirmContent="确认要刷新元数据吗？"
                onPositiveClick={() => handleRefresh(row.datasourceId!)}
              />
            );
          };

          const editBtn = () => {
            if (!hasAuth('metadata:datasource:edit')) {
              return null;
            }
            return (
              <ButtonIcon
                type="primary"
                text
                icon="material-symbols:drive-file-rename-outline-outline"
                tooltipContent={$t('common.edit')}
                onClick={() => edit(row.datasourceId!)}
              />
            );
          };

          const deleteBtn = () => {
            if (!hasAuth('metadata:datasource:remove')) {
              return null;
            }
            return (
              <ButtonIcon
                text
                type="error"
                icon="material-symbols:delete-outline"
                tooltipContent={$t('common.delete')}
                popconfirmContent={$t('common.confirmDelete')}
                onPositiveClick={() => handleDelete(row.datasourceId!)}
              />
            );
          };

          return (
            <div class="flex-center gap-8px">
              {testBtn()}
              {refreshBtn()}
              {editBtn()}
              {deleteBtn()}
            </div>
          );
        }
      }
    ]
  });

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, checkedRowKeys, onBatchDeleted, onDeleted } =
  useTableOperate(data, 'datasourceId', getData);

async function handleBatchDelete() {
  const { error } = await fetchBatchDeleteDatasource(checkedRowKeys.value);
  if (error) return;
  onBatchDeleted();
}

async function handleDelete(datasourceId: CommonType.IdType) {
  const { error } = await fetchBatchDeleteDatasource([datasourceId]);
  if (error) return;
  onDeleted();
}

async function handleTestConnection(datasourceId: CommonType.IdType) {
  const { error } = await fetchTestConnectionById(datasourceId);
  if (!error) {
    window.$message?.success('连接成功');
  }
}

async function handleRefresh(datasourceId: CommonType.IdType) {
  const { error } = await fetchRefreshDatasource(datasourceId);
  if (!error) {
    window.$message?.success('刷新成功');
    getData();
  }
}

async function edit(datasourceId: CommonType.IdType) {
  handleEdit(datasourceId);
}

function handleExport() {
  download('/metadata/datasource/export', searchParams.value, `数据源信息_${new Date().getTime()}.xlsx`);
}
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <DatasourceSearch v-model:model="searchParams" @reset="getDataByPage" @search="getDataByPage" />
    <NCard title="数据源列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="hasAuth('metadata:datasource:add')"
          :show-delete="hasAuth('metadata:datasource:remove')"
          :show-export="hasAuth('metadata:datasource:export')"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @export="handleExport"
          @refresh="getData"
        />
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
        :row-key="row => row.datasourceId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
      <DatasourceOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
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

@media screen and (max-width: 802px) {
  :deep(.n-data-table-base-table-body) {
    max-height: calc(100vh - 473px - var(--calc-footer-height, 0px));
  }
}

:deep(.n-card-header__main) {
  min-width: 69px !important;
}
</style>
