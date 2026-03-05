<script setup lang="tsx">
import { ref } from 'vue';
import { NTag } from 'naive-ui';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';
import { useAppStore } from '@/store/modules/app';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import SchemaChangeSearch from './modules/schema-change-search.vue';

defineOptions({
  name: 'MetadataSchemaChange'
});

const appStore = useAppStore();

const searchParams = ref<Api.Metadata.SchemaChangeSearchParams>({
  pageNum: 1,
  pageSize: 10,
  datasourceId: null,
  entityLevel: null,
  databaseName: null,
  tableName: null
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetSchemaChangeList(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value.pageNum = params.page;
      searchParams.value.pageSize = params.pageSize;
    },
    columns: () => [
      {
        key: 'index',
        title: '序号',
        align: 'center',
        width: 64,
        render: (_, index) => index + 1
      },
      {
        key: 'entityLevel',
        title: '变更层级',
        align: 'center',
        width: 100,
        render: row => {
          const map: Record<string, { text: string; type: 'default' | 'info' | 'warning' | 'success' }> = {
            database: { text: '库', type: 'info' },
            table: { text: '表', type: 'warning' },
            column: { text: '列', type: 'default' }
          };
          const m = map[row.entityLevel ?? ''] ?? { text: row.entityLevel ?? '-', type: 'default' };
          return (
            <NTag size="small" type={m.type} bordered={false}>
              {m.text}
            </NTag>
          );
        }
      },
      {
        key: 'changeType',
        title: '变更类型',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'databaseName',
        title: '数据库名',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'tableName',
        title: '表名',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'columnName',
        title: '列名',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'changeBefore',
        title: '变更前',
        align: 'center',
        minWidth: 150
      },
      {
        key: 'changeAfter',
        title: '变更后',
        align: 'center',
        minWidth: 150
      },
      {
        key: 'createTime',
        title: '创建时间',
        align: 'center',
        width: 170
      }
    ]
  });
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <SchemaChangeSearch v-model:model="searchParams" @search="getDataByPage" />
    <NCard title="Schema变更列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="true"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          :show-export="false"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="row => row.changeId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>

<style scoped></style>
