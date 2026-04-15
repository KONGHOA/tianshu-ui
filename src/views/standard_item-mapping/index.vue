<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NPopconfirm, NTag } from 'naive-ui';
import {
  fetchCreateStdDataItemMapping,
  fetchDeleteStdDataItemMapping,
  fetchGetStdDataItemMapping,
  fetchGetStdDataItemMappingList,
  fetchRecommendStdDataItemMapping,
  fetchUpdateStdDataItemMapping
} from '@/service/api/metadata/standard-item-mapping';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardItemMapping'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = reactive<Api.Metadata.StdDataItemMappingSearchParams>({
  pageNum: 1,
  pageSize: 10,
  datasourceId: null,
  tableName: null,
  columnName: null,
  itemId: null,
  status: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdDataItemMappingList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  columns: () => []
});

const modalVisible = ref(false);
const modalLoading = ref(false);
const recommendLoading = ref(false);
const editingId = ref<CommonType.IdType | null>(null);
const formRef = ref<FormInst | null>(null);
const recommendResult = ref<Api.Metadata.StdMappingRecommend | null>(null);

const formModel = reactive<Api.Metadata.StdDataItemMappingOperateParams>({
  mappingId: undefined,
  datasourceId: undefined,
  databaseName: '',
  schemaName: '',
  tableName: '',
  columnName: '',
  columnComment: '',
  entityUuid: '',
  attributeUuid: '',
  itemId: undefined,
  dataElementId: undefined,
  mappingBasis: '',
  mappingConfidence: 0.8,
  status: 'MAPPED'
});

const rules: FormRules = {
  tableName: { required: true, message: '请输入表名称', trigger: ['blur', 'input'] },
  columnName: { required: true, message: '请输入字段名称', trigger: ['blur', 'input'] },
  itemId: { required: true, message: '请输入数据项ID', trigger: ['blur', 'input'] },
  dataElementId: { required: true, message: '请输入数据元ID', trigger: ['blur', 'input'] }
};

function toNumberValue(value: CommonType.IdType | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function resetForm() {
  editingId.value = null;
  recommendResult.value = null;
  Object.assign(formModel, {
    mappingId: undefined,
    datasourceId: undefined,
    databaseName: '',
    schemaName: '',
    tableName: '',
    columnName: '',
    columnComment: '',
    entityUuid: '',
    attributeUuid: '',
    itemId: undefined,
    dataElementId: undefined,
    mappingBasis: '',
    mappingConfidence: 0.8,
    status: 'MAPPED'
  });
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleReset() {
  searchParams.datasourceId = null;
  searchParams.tableName = null;
  searchParams.columnName = null;
  searchParams.itemId = null;
  searchParams.status = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(mappingId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdDataItemMapping(mappingId);
  if (error || !detail) return;
  editingId.value = mappingId;
  Object.assign(formModel, detail);
  modalVisible.value = true;
}

async function handleDelete(mappingId: CommonType.IdType) {
  const { error } = await fetchDeleteStdDataItemMapping([mappingId]);
  if (error) return;
  window.$message?.success('解绑成功');
  getData();
}

async function handleRecommend() {
  recommendLoading.value = true;
  const { data: result, error } = await fetchRecommendStdDataItemMapping({
    datasourceId: formModel.datasourceId ?? undefined,
    databaseName: formModel.databaseName || undefined,
    schemaName: formModel.schemaName || undefined,
    tableName: formModel.tableName || '',
    columnName: formModel.columnName || '',
    columnComment: formModel.columnComment || undefined
  });
  recommendLoading.value = false;
  if (error || !result) return;
  recommendResult.value = result;
  if (result.itemId) formModel.itemId = result.itemId;
  if (result.dataElementId) formModel.dataElementId = result.dataElementId;
  if (result.mappingBasis) formModel.mappingBasis = result.mappingBasis;
  if (result.mappingConfidence !== undefined) formModel.mappingConfidence = result.mappingConfidence;
}

async function handleRecommendForRow(row: Api.Metadata.StdDataItemMapping) {
  resetForm();
  Object.assign(formModel, row);
  modalVisible.value = true;
  await handleRecommend();
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingId.value ? fetchUpdateStdDataItemMapping(formModel) : fetchCreateStdDataItemMapping(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '映射修改成功' : '映射绑定成功');
  modalVisible.value = false;
  getData();
}

const columns = computed<DataTableColumns<Api.Metadata.StdDataItemMapping>>(() => [
  { key: 'datasourceId', title: '数据源ID', width: 90 },
  { key: 'databaseName', title: '数据库', minWidth: 120 },
  { key: 'schemaName', title: 'Schema', minWidth: 120 },
  { key: 'tableName', title: '表名称', minWidth: 140 },
  { key: 'columnName', title: '字段名称', minWidth: 140 },
  { key: 'columnComment', title: '字段注释', minWidth: 180 },
  { key: 'itemId', title: '数据项ID', width: 90 },
  { key: 'dataElementId', title: '数据元ID', width: 90 },
  {
    key: 'status',
    title: '状态',
    width: 90,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.status === 'CONFIRMED' ? 'success' : 'warning' },
        { default: () => row.status || '-' }
      )
  },
  { key: 'mappedTime', title: '映射时间', minWidth: 160 },
  {
    key: 'operate',
    title: '操作',
    width: 220,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        hasAuth('metadata:standard:item:map')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.mappingId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:item:map')
          ? h(
              NButton,
              { text: true, type: 'success', onClick: () => handleRecommendForRow(row) },
              { default: () => '推荐' }
            )
          : null,
        hasAuth('metadata:standard:item:map')
          ? h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row.mappingId) },
              {
                trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '解绑' }),
                default: () => '确认解除该字段映射吗？'
              }
            )
          : null
      ])
  }
]);
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="字段映射检索" :bordered="false" size="small">
      <div class="flex flex-wrap gap-12px">
        <NInputNumber
          :value="toNumberValue(searchParams.datasourceId)"
          placeholder="数据源ID"
          class="w-160px"
          clearable
          @update:value="value => (searchParams.datasourceId = value ?? null)"
        />
        <NInput v-model:value="searchParams.tableName" placeholder="表名称" class="w-180px" clearable />
        <NInput v-model:value="searchParams.columnName" placeholder="字段名称" class="w-180px" clearable />
        <NInputNumber
          :value="toNumberValue(searchParams.itemId)"
          placeholder="数据项ID"
          class="w-160px"
          clearable
          @update:value="value => (searchParams.itemId = value ?? null)"
        />
        <NInput v-model:value="searchParams.status" placeholder="状态" class="w-140px" clearable />
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleReset">重置</NButton>
        </NSpace>
      </div>
    </NCard>

    <NCard title="字段映射工作台" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:item:map')" type="primary" @click="handleAdd">新增映射</NButton>
          <NButton @click="getData">刷新</NButton>
        </NSpace>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        :flex-height="!appStore.isMobile"
        remote
        :row-key="row => row.mappingId"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '编辑字段映射' : '新增字段映射'"
      class="w-860px"
    >
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="100">
        <div class="grid grid-cols-2 gap-x-16px">
          <NFormItem label="数据源ID">
            <NInputNumber
              :value="toNumberValue(formModel.datasourceId)"
              class="w-full"
              clearable
              @update:value="value => (formModel.datasourceId = value ?? undefined)"
            />
          </NFormItem>
          <NFormItem label="数据库">
            <NInput v-model:value="formModel.databaseName" />
          </NFormItem>
          <NFormItem label="Schema">
            <NInput v-model:value="formModel.schemaName" />
          </NFormItem>
          <NFormItem label="表名称" path="tableName">
            <NInput v-model:value="formModel.tableName" />
          </NFormItem>
          <NFormItem label="字段名称" path="columnName">
            <NInput v-model:value="formModel.columnName" />
          </NFormItem>
          <NFormItem label="字段注释">
            <NInput v-model:value="formModel.columnComment" />
          </NFormItem>
          <NFormItem label="实体UUID">
            <NInput v-model:value="formModel.entityUuid" />
          </NFormItem>
          <NFormItem label="属性UUID">
            <NInput v-model:value="formModel.attributeUuid" />
          </NFormItem>
          <NFormItem label="数据项ID" path="itemId">
            <NInputNumber
              :value="toNumberValue(formModel.itemId)"
              class="w-full"
              clearable
              @update:value="value => (formModel.itemId = value ?? undefined)"
            />
          </NFormItem>
          <NFormItem label="数据元ID" path="dataElementId">
            <NInputNumber
              :value="toNumberValue(formModel.dataElementId)"
              class="w-full"
              clearable
              @update:value="value => (formModel.dataElementId = value ?? undefined)"
            />
          </NFormItem>
          <NFormItem label="映射状态">
            <NInput v-model:value="formModel.status" />
          </NFormItem>
          <NFormItem label="映射置信度">
            <NInputNumber v-model:value="formModel.mappingConfidence" class="w-full" :min="0" :max="1" :step="0.1" />
          </NFormItem>
          <NFormItem label="映射依据" class="col-span-2">
            <NInput v-model:value="formModel.mappingBasis" type="textarea" :autosize="{ minRows: 3, maxRows: 4 }" />
          </NFormItem>
        </div>
      </NForm>

      <div class="mb-16px rounded-8px bg-#f7f8fa p-12px">
        <div class="mb-8px flex items-center justify-between">
          <span class="text-14px font-600">推荐结果</span>
          <NButton secondary size="small" :loading="recommendLoading" @click="handleRecommend">获取推荐</NButton>
        </div>
        <div class="text-13px text-#666">
          <div>建议数据项ID：{{ recommendResult?.itemId || '-' }}</div>
          <div>建议数据元ID：{{ recommendResult?.dataElementId || '-' }}</div>
          <div>建议数据项：{{ recommendResult?.itemName || '-' }}</div>
          <div>建议标识符：{{ recommendResult?.itemIdentifier || '-' }}</div>
          <div>推荐依据：{{ recommendResult?.mappingBasis || '-' }}</div>
          <div>推荐置信度：{{ recommendResult?.mappingConfidence ?? '-' }}</div>
        </div>
      </div>

      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="modalLoading" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
:deep(.n-data-table-wrapper),
:deep(.n-data-table-base-table),
:deep(.n-data-table-base-table-body) {
  height: 100%;
}
</style>
