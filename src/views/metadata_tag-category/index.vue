<script setup lang="tsx">
import { ref } from 'vue';
import { NCard, NDataTable } from 'naive-ui';
import { fetchDeleteTagCategory, fetchGetTagCategoryList } from '@/service/api/metadata/tag-category';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import TagCategoryOperateDrawer from './modules/tag-category-operate-drawer.vue';
import TagCategorySearch from './modules/tag-category-search.vue';

defineOptions({
  name: 'MetadataTagCategoryList'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Metadata.TagCategorySearchParams>({
  pageNum: 1,
  pageSize: 10,
  name: null
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetTagCategoryList(searchParams.value),
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
        key: 'categoryId',
        title: '分类ID',
        align: 'center',
        minWidth: 100
      },
      {
        key: 'name',
        title: '标签分类名称',
        align: 'center',
        minWidth: 160
      },
      {
        key: 'uuid',
        title: 'UUID',
        align: 'center',
        minWidth: 200,
        ellipsis: {
          tooltip: true
        }
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 150,
        render: row => {
          const editBtn = () => {
            if (!hasAuth('metadata:tagCategory:edit')) {
              return null;
            }
            return (
              <ButtonIcon
                type="primary"
                text
                icon="material-symbols:drive-file-rename-outline-outline"
                tooltipContent={$t('common.edit')}
                onClick={() => edit(row.categoryId!)}
              />
            );
          };

          const deleteBtn = () => {
            if (!hasAuth('metadata:tagCategory:remove')) {
              return null;
            }
            return (
              <ButtonIcon
                text
                type="error"
                icon="material-symbols:delete-outline"
                tooltipContent={$t('common.delete')}
                popconfirmContent={$t('common.confirmDelete')}
                onPositiveClick={() => handleDelete(row.categoryId!)}
              />
            );
          };

          return (
            <div class="flex-center gap-8px">
              {editBtn()}
              {deleteBtn()}
            </div>
          );
        }
      }
    ]
  });

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, checkedRowKeys, onBatchDeleted, onDeleted } =
  useTableOperate(data, 'categoryId', getData);

async function handleBatchDelete() {
  const { error } = await fetchDeleteTagCategory(checkedRowKeys.value as (string | number)[]);
  if (error) return;
  onBatchDeleted();
}

async function handleDelete(categoryId: CommonType.IdType) {
  const { error } = await fetchDeleteTagCategory([categoryId]);
  if (error) return;
  onDeleted();
}

async function edit(categoryId: CommonType.IdType) {
  handleEdit(categoryId);
}
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <TagCategorySearch v-model:model="searchParams" @reset="getDataByPage" @search="getDataByPage" />
    <NCard title="标签分类列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="hasAuth('metadata:tagCategory:add')"
          :show-delete="hasAuth('metadata:tagCategory:remove')"
          @add="handleAdd"
          @delete="handleBatchDelete"
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
        :row-key="row => row.categoryId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
      <TagCategoryOperateDrawer
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
