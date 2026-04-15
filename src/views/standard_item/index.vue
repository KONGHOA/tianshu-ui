<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NPopconfirm, NTag } from 'naive-ui';
import {
  fetchCreateStdDataItem,
  fetchDeleteStdDataItem,
  fetchGetStdDataItem,
  fetchGetStdDataItemList,
  fetchPreviewStdDataItem,
  fetchUpdateStdDataItem
} from '@/service/api/metadata/standard-item';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardItem'
});

type ItemFormModel = Api.Metadata.StdDataItemOperateParams & {
  qualifierText: string;
};

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = reactive<Api.Metadata.StdDataItemSearchParams>({
  pageNum: 1,
  pageSize: 10,
  itemName: null,
  itemIdentifier: null,
  dataElementId: null,
  sourceType: null,
  mappingStatus: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdDataItemList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  columns: () => []
});

const modalVisible = ref(false);
const modalLoading = ref(false);
const previewLoading = ref(false);
const editingId = ref<CommonType.IdType | null>(null);
const formRef = ref<FormInst | null>(null);
const preview = ref<Api.Metadata.StdDataItemPreview | null>(null);

const formModel = reactive<ItemFormModel>({
  itemId: undefined,
  itemName: '',
  itemIdentifier: '',
  dataElementId: undefined,
  dataElementName: '',
  dataElementSymbol: '',
  qualifiers: [],
  qualifierText: '',
  description: '',
  baseItemType: '',
  sourceType: 'MANUAL',
  mappingStatus: 'UNMAPPED',
  standardCategory: '',
  standardNumber: '',
  standardName: '',
  standardStatus: '',
  remark: ''
});

const rules: FormRules = {
  dataElementId: { required: true, message: '请输入数据元ID', trigger: ['blur', 'input'] },
  dataElementName: { required: true, message: '请输入数据元名称', trigger: ['blur', 'input'] },
  dataElementSymbol: { required: true, message: '请输入数据元标识符', trigger: ['blur', 'input'] }
};

function toNumberValue(value: CommonType.IdType | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function parseQualifiers(text: string): Api.Metadata.StdQualifierRef[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [qualifierId, qualifierName, qualifierSymbol] = line.split('|').map(item => item?.trim());
      return {
        qualifierId: Number(qualifierId),
        qualifierName: qualifierName || '',
        qualifierSymbol: qualifierSymbol || '',
        sortNum: index + 1
      };
    })
    .filter(item => item.qualifierId && item.qualifierName && item.qualifierSymbol);
}

function fillQualifierText(qualifiers?: Api.Metadata.StdQualifierRef[]) {
  return (qualifiers || []).map(item => `${item.qualifierId}|${item.qualifierName}|${item.qualifierSymbol}`).join('\n');
}

function resetForm() {
  editingId.value = null;
  preview.value = null;
  Object.assign(formModel, {
    itemId: undefined,
    itemName: '',
    itemIdentifier: '',
    dataElementId: undefined,
    dataElementName: '',
    dataElementSymbol: '',
    qualifiers: [],
    qualifierText: '',
    description: '',
    baseItemType: '',
    sourceType: 'MANUAL',
    mappingStatus: 'UNMAPPED',
    standardCategory: '',
    standardNumber: '',
    standardName: '',
    standardStatus: '',
    remark: ''
  });
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleReset() {
  searchParams.itemName = null;
  searchParams.itemIdentifier = null;
  searchParams.dataElementId = null;
  searchParams.sourceType = null;
  searchParams.mappingStatus = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(itemId: CommonType.IdType) {
  resetForm();
  const { data: item, error } = await fetchGetStdDataItem(itemId);
  if (error || !item) return;
  editingId.value = itemId;
  Object.assign(formModel, item, {
    qualifierText: fillQualifierText(item.qualifiers)
  });
  modalVisible.value = true;
}

async function handleDelete(itemId: CommonType.IdType) {
  const { error } = await fetchDeleteStdDataItem([itemId]);
  if (error) return;
  window.$message?.success('删除成功');
  getData();
}

async function handlePreview() {
  previewLoading.value = true;
  const { data: result, error } = await fetchPreviewStdDataItem({
    dataElementId: Number(formModel.dataElementId),
    dataElementName: formModel.dataElementName || '',
    dataElementSymbol: formModel.dataElementSymbol || '',
    qualifiers: parseQualifiers(formModel.qualifierText)
  });
  previewLoading.value = false;
  if (error || !result) return;
  preview.value = result;
  formModel.itemName = result.itemName;
  formModel.itemIdentifier = result.itemIdentifier;
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const payload: Api.Metadata.StdDataItemOperateParams = {
    ...formModel,
    qualifiers: parseQualifiers(formModel.qualifierText)
  };
  const request = editingId.value ? fetchUpdateStdDataItem(payload) : fetchCreateStdDataItem(payload);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

const columns = computed<DataTableColumns<Api.Metadata.StdDataItem>>(() => [
  {
    key: 'itemName',
    title: '数据项名称',
    minWidth: 180
  },
  {
    key: 'itemIdentifier',
    title: '数据项标识符',
    minWidth: 180
  },
  {
    key: 'dataElementId',
    title: '数据元ID',
    width: 110
  },
  {
    key: 'sourceType',
    title: '来源类型',
    width: 100,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.sourceType === 'FIELD_MAPPING' ? 'success' : 'default' },
        { default: () => row.sourceType || '-' }
      )
  },
  {
    key: 'mappingStatus',
    title: '映射状态',
    width: 100
  },
  {
    key: 'referenceCount',
    title: '引用次数',
    width: 90
  },
  {
    key: 'createTime',
    title: '创建时间',
    minWidth: 160
  },
  {
    key: 'operate',
    title: '操作',
    width: 180,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        hasAuth('metadata:standard:item:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.itemId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:item:remove')
          ? h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row.itemId) },
              {
                trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '删除' }),
                default: () => '确认删除该数据项吗？'
              }
            )
          : null
      ])
  }
]);
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="数据项检索" :bordered="false" size="small">
      <div class="flex flex-wrap gap-12px">
        <NInput v-model:value="searchParams.itemName" placeholder="数据项名称" class="w-220px" clearable />
        <NInput v-model:value="searchParams.itemIdentifier" placeholder="数据项标识符" class="w-220px" clearable />
        <NInputNumber
          :value="toNumberValue(searchParams.dataElementId)"
          placeholder="数据元ID"
          class="w-180px"
          clearable
          @update:value="value => (searchParams.dataElementId = value ?? null)"
        />
        <NInput v-model:value="searchParams.sourceType" placeholder="来源类型" class="w-140px" clearable />
        <NInput v-model:value="searchParams.mappingStatus" placeholder="映射状态" class="w-140px" clearable />
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleReset">重置</NButton>
        </NSpace>
      </div>
    </NCard>

    <NCard title="数据项列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:item:add')" type="primary" @click="handleAdd">新增数据项</NButton>
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
        :row-key="row => row.itemId"
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" :title="editingId ? '编辑数据项' : '新增数据项'" class="w-820px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="110">
        <div class="grid grid-cols-2 gap-x-16px">
          <NFormItem label="数据元ID" path="dataElementId">
            <NInputNumber
              :value="toNumberValue(formModel.dataElementId)"
              class="w-full"
              clearable
              @update:value="value => (formModel.dataElementId = value ?? undefined)"
            />
          </NFormItem>
          <NFormItem label="数据元名称" path="dataElementName">
            <NInput v-model:value="formModel.dataElementName" />
          </NFormItem>
          <NFormItem label="数据元标识符" path="dataElementSymbol">
            <NInput v-model:value="formModel.dataElementSymbol" />
          </NFormItem>
          <NFormItem label="基本类型">
            <NInput v-model:value="formModel.baseItemType" />
          </NFormItem>
          <NFormItem label="来源类型">
            <NInput v-model:value="formModel.sourceType" />
          </NFormItem>
          <NFormItem label="映射状态">
            <NInput v-model:value="formModel.mappingStatus" />
          </NFormItem>
          <NFormItem label="标准分类">
            <NInput v-model:value="formModel.standardCategory" />
          </NFormItem>
          <NFormItem label="标准号">
            <NInput v-model:value="formModel.standardNumber" />
          </NFormItem>
          <NFormItem label="标准名称" class="col-span-2">
            <NInput v-model:value="formModel.standardName" />
          </NFormItem>
          <NFormItem label="标准状态">
            <NInput v-model:value="formModel.standardStatus" />
          </NFormItem>
          <NFormItem label="备注">
            <NInput v-model:value="formModel.remark" />
          </NFormItem>
          <NFormItem label="限定词快照" class="col-span-2">
            <NInput
              v-model:value="formModel.qualifierText"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 6 }"
              placeholder="每行一个限定词，格式：限定词ID|限定词名称|限定词标识符"
            />
          </NFormItem>
          <NFormItem label="说明" class="col-span-2">
            <NInput v-model:value="formModel.description" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
        </div>
      </NForm>

      <div class="mb-16px rounded-8px bg-#f7f8fa p-12px">
        <div class="mb-8px flex items-center justify-between">
          <span class="text-14px font-600">生成预览</span>
          <NButton secondary size="small" :loading="previewLoading" @click="handlePreview">刷新预览</NButton>
        </div>
        <div class="text-13px text-#666">
          <div>数据项名称：{{ preview?.itemName || formModel.itemName || '-' }}</div>
          <div>数据项标识符：{{ preview?.itemIdentifier || formModel.itemIdentifier || '-' }}</div>
          <div>限定词签名：{{ preview?.qualifierSignature || '-' }}</div>
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
