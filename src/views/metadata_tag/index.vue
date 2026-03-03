<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable } from 'naive-ui';
import { fetchDeleteTag, fetchGetTagList } from '@/service/api/metadata/tag';
import { fetchGetAllTagCategories } from '@/service/api/metadata/tag-category';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useDownload } from '@/hooks/business/download';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import TagOperateDrawer from './modules/tag-operate-drawer.vue';
import TagSearch from './modules/tag-search.vue';

defineOptions({
  name: 'MetadataTagList'
});

const appStore = useAppStore();
const { download } = useDownload();
const { hasAuth } = useAuth();

const searchParams = ref<Api.Metadata.TagSearchParams>({
  pageNum: 1,
  pageSize: 10,
  name: null,
  categoryUuid: null,
  params: {}
});

const categoryMap = ref<Record<string, string>>({});

async function loadCategories() {
  const { error, data } = await fetchGetAllTagCategories();
  if (!error && data) {
    const map: Record<string, string> = {};
    data.forEach(item => {
      map[item.uuid] = item.name;
    });
    categoryMap.value = map;
  }
}

onMounted(() => {
  loadCategories();
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination, scrollX } =
  useNaivePaginatedTable({
    api: () => fetchGetTagList(searchParams.value),
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
        key: 'name',
        title: '标签名称',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'categoryUuid',
        title: '所属分类',
        align: 'center',
        minWidth: 120,
        render: row => categoryMap.value[row.categoryUuid] || row.categoryUuid
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 150,
        render: row => {
          const editBtn = () => {
            if (!hasAuth('metadata:tag:edit')) {
              return null;
            }
            return (
              <ButtonIcon
                type="primary"
                text
                icon="material-symbols:drive-file-rename-outline-outline"
                tooltipContent={$t('common.edit')}
                onClick={() => edit(row.tagId!)}
              />
            );
          };

          const deleteBtn = () => {
            if (!hasAuth('metadata:tag:remove')) {
              return null;
            }
            return (
              <ButtonIcon
                text
                type="error"
                icon="material-symbols:delete-outline"
                tooltipContent={$t('common.delete')}
                popconfirmContent={$t('common.confirmDelete')}
                onPositiveClick={() => handleDelete(row.tagId!)}
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
  useTableOperate(data, 'tagId', getData);

async function handleBatchDelete() {
  const { error } = await fetchDeleteTag(checkedRowKeys.value as number[]);
  if (error) return;
  onBatchDeleted();
}

async function handleDelete(tagId: CommonType.IdType) {
  const { error } = await fetchDeleteTag(tagId);
  if (error) return;
  onDeleted();
}

async function edit(tagId: CommonType.IdType) {
  handleEdit(tagId);
}

function handleExport() {
  download('/metadata/tag/export', searchParams.value, `标签信息_${new Date().getTime()}.xlsx`);
}
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <TagSearch v-model:model="searchParams" @reset="getDataByPage" @search="getDataByPage" />
    <NCard title="标签列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          :show-add="hasAuth('metadata:tag:add')"
          :show-delete="hasAuth('metadata:tag:remove')"
          :show-export="hasAuth('metadata:tag:export')"
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
        :row-key="row => row.tagId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
      <TagOperateDrawer
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
