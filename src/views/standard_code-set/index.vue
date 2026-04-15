<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NPopconfirm, NTag } from 'naive-ui';
import {
  fetchCreateStdCodeItem,
  fetchCreateStdCodeSet,
  fetchDeleteStdCodeItem,
  fetchDeleteStdCodeSet,
  fetchGetStdCodeItems,
  fetchGetStdCodeSet,
  fetchGetStdCodeSetList,
  fetchPublishStdCodeSet,
  fetchUpdateStdCodeItem,
  fetchUpdateStdCodeSet
} from '@/service/api/metadata/standard-code-set';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardCodeSet'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = reactive<Api.Metadata.StdCodeSetSearchParams>({
  pageNum: 1,
  pageSize: 10,
  codeSetCode: null,
  codeSetName: null,
  publishStatus: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdCodeSetList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  columns: () => []
});

const formRef = ref<FormInst | null>(null);
const itemFormRef = ref<FormInst | null>(null);
const modalVisible = ref(false);
const itemModalVisible = ref(false);
const modalLoading = ref(false);
const itemModalLoading = ref(false);
const editingCodeSetId = ref<CommonType.IdType | null>(null);
const editingCodeItemId = ref<CommonType.IdType | null>(null);
const currentCodeSetId = ref<CommonType.IdType | null>(null);
const currentCodeSetName = ref('');
const codeItems = ref<Api.Metadata.StdCodeItem[]>([]);

const formModel = reactive<Api.Metadata.StdCodeSetOperateParams>({
  codeSetId: undefined,
  codeSetCode: '',
  codeSetName: '',
  description: '',
  version: '1.0',
  source: '',
  publishStatus: 'DRAFT',
  standardCategory: '',
  standardNumber: '',
  standardName: '',
  standardStatus: '',
  remark: ''
});

const itemFormModel = reactive<Api.Metadata.StdCodeItemOperateParams>({
  codeItemId: undefined,
  codeSetId: undefined,
  codeValue: '',
  codeName: '',
  description: '',
  sortNum: 1,
  enabledFlag: '1'
});

const rules: FormRules = {
  codeSetCode: { required: true, message: '请输入代码集编码', trigger: ['blur', 'input'] },
  codeSetName: { required: true, message: '请输入代码集名称', trigger: ['blur', 'input'] }
};

const itemRules: FormRules = {
  codeValue: { required: true, message: '请输入代码值', trigger: ['blur', 'input'] },
  codeName: { required: true, message: '请输入代码名称', trigger: ['blur', 'input'] }
};

function resetForm() {
  editingCodeSetId.value = null;
  Object.assign(formModel, {
    codeSetId: undefined,
    codeSetCode: '',
    codeSetName: '',
    description: '',
    version: '1.0',
    source: '',
    publishStatus: 'DRAFT',
    standardCategory: '',
    standardNumber: '',
    standardName: '',
    standardStatus: '',
    remark: ''
  });
}

function resetItemForm() {
  editingCodeItemId.value = null;
  Object.assign(itemFormModel, {
    codeItemId: undefined,
    codeSetId: currentCodeSetId.value || undefined,
    codeValue: '',
    codeName: '',
    description: '',
    sortNum: codeItems.value.length + 1,
    enabledFlag: '1'
  });
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleReset() {
  searchParams.codeSetCode = null;
  searchParams.codeSetName = null;
  searchParams.publishStatus = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(codeSetId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdCodeSet(codeSetId);
  if (error || !detail) return;
  editingCodeSetId.value = codeSetId;
  Object.assign(formModel, detail);
  modalVisible.value = true;
}

async function handleDelete(codeSetId: CommonType.IdType) {
  const { error } = await fetchDeleteStdCodeSet([codeSetId]);
  if (error) return;
  window.$message?.success('删除成功');
  getData();
}

async function handlePublish(codeSetId: CommonType.IdType) {
  const { error } = await fetchPublishStdCodeSet(codeSetId);
  if (error) return;
  window.$message?.success('发布成功');
  getData();
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingCodeSetId.value ? fetchUpdateStdCodeSet(formModel) : fetchCreateStdCodeSet(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingCodeSetId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

async function openItemModal(codeSetId: CommonType.IdType, codeSetName: string) {
  currentCodeSetId.value = codeSetId;
  currentCodeSetName.value = codeSetName;
  const { data: items, error } = await fetchGetStdCodeItems(codeSetId);
  if (error) return;
  codeItems.value = items || [];
  resetItemForm();
  itemModalVisible.value = true;
}

function handleAddCodeItem() {
  resetItemForm();
}

function handleEditCodeItem(row: Api.Metadata.StdCodeItem) {
  editingCodeItemId.value = row.codeItemId;
  Object.assign(itemFormModel, row);
}

async function handleSubmitCodeItem() {
  await itemFormRef.value?.validate();
  itemModalLoading.value = true;
  itemFormModel.codeSetId = currentCodeSetId.value || undefined;
  const request = editingCodeItemId.value
    ? fetchUpdateStdCodeItem(itemFormModel)
    : fetchCreateStdCodeItem(itemFormModel);
  const { error } = await request;
  itemModalLoading.value = false;
  if (error || !currentCodeSetId.value) return;
  window.$message?.success(editingCodeItemId.value ? '代码项修改成功' : '代码项新增成功');
  const { data: items } = await fetchGetStdCodeItems(currentCodeSetId.value);
  codeItems.value = items || [];
  resetItemForm();
  getData();
}

async function handleDeleteCodeItem(codeItemId: CommonType.IdType) {
  const { error } = await fetchDeleteStdCodeItem([codeItemId]);
  if (error || !currentCodeSetId.value) return;
  window.$message?.success('代码项删除成功');
  const { data: items } = await fetchGetStdCodeItems(currentCodeSetId.value);
  codeItems.value = items || [];
  resetItemForm();
  getData();
}

const columns = computed<DataTableColumns<Api.Metadata.StdCodeSet>>(() => [
  { key: 'codeSetCode', title: '代码集编码', minWidth: 160 },
  { key: 'codeSetName', title: '代码集名称', minWidth: 180 },
  { key: 'version', title: '版本号', width: 90 },
  { key: 'codeCount', title: '代码项数量', width: 100 },
  {
    key: 'publishStatus',
    title: '发布状态',
    width: 100,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.publishStatus === 'PUBLISHED' ? 'success' : 'warning' },
        { default: () => row.publishStatus || '-' }
      )
  },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
  {
    key: 'operate',
    title: '操作',
    width: 260,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h(
          NButton,
          { text: true, type: 'primary', onClick: () => openItemModal(row.codeSetId, row.codeSetName) },
          { default: () => '代码项' }
        ),
        hasAuth('metadata:standard:codeSet:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.codeSetId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:codeSet:publish') && row.publishStatus !== 'PUBLISHED'
          ? h(
              NButton,
              { text: true, type: 'success', onClick: () => handlePublish(row.codeSetId) },
              { default: () => '发布' }
            )
          : null,
        hasAuth('metadata:standard:codeSet:remove')
          ? h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row.codeSetId) },
              {
                trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '删除' }),
                default: () => '确认删除该代码集吗？'
              }
            )
          : null
      ])
  }
]);

const itemColumns = computed<DataTableColumns<Api.Metadata.StdCodeItem>>(() => [
  { key: 'codeValue', title: '代码值', minWidth: 120 },
  { key: 'codeName', title: '代码名称', minWidth: 160 },
  { key: 'sortNum', title: '排序', width: 80 },
  {
    key: 'enabledFlag',
    title: '状态',
    width: 80,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.enabledFlag === '1' ? 'success' : 'default' },
        { default: () => (row.enabledFlag === '1' ? '启用' : '停用') }
      )
  },
  {
    key: 'operate',
    title: '操作',
    width: 120,
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h(NButton, { text: true, type: 'primary', onClick: () => handleEditCodeItem(row) }, { default: () => '编辑' }),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteCodeItem(row.codeItemId) },
          {
            trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该代码项吗？'
          }
        )
      ])
  }
]);
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="代码集检索" :bordered="false" size="small">
      <div class="flex flex-wrap gap-12px">
        <NInput v-model:value="searchParams.codeSetCode" placeholder="代码集编码" class="w-220px" clearable />
        <NInput v-model:value="searchParams.codeSetName" placeholder="代码集名称" class="w-220px" clearable />
        <NInput v-model:value="searchParams.publishStatus" placeholder="发布状态" class="w-160px" clearable />
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleReset">重置</NButton>
        </NSpace>
      </div>
    </NCard>

    <NCard title="代码集列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:codeSet:add')" type="primary" @click="handleAdd">
            新增代码集
          </NButton>
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
        :row-key="row => row.codeSetId"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingCodeSetId ? '编辑代码集' : '新增代码集'"
      class="w-760px"
    >
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <div class="grid grid-cols-2 gap-x-16px">
          <NFormItem label="代码集编码" path="codeSetCode">
            <NInput v-model:value="formModel.codeSetCode" />
          </NFormItem>
          <NFormItem label="代码集名称" path="codeSetName">
            <NInput v-model:value="formModel.codeSetName" />
          </NFormItem>
          <NFormItem label="版本号">
            <NInput v-model:value="formModel.version" />
          </NFormItem>
          <NFormItem label="来源">
            <NInput v-model:value="formModel.source" />
          </NFormItem>
          <NFormItem label="发布状态">
            <NInput v-model:value="formModel.publishStatus" />
          </NFormItem>
          <NFormItem label="标准分类">
            <NInput v-model:value="formModel.standardCategory" />
          </NFormItem>
          <NFormItem label="标准号">
            <NInput v-model:value="formModel.standardNumber" />
          </NFormItem>
          <NFormItem label="标准状态">
            <NInput v-model:value="formModel.standardStatus" />
          </NFormItem>
          <NFormItem label="标准名称" class="col-span-2">
            <NInput v-model:value="formModel.standardName" />
          </NFormItem>
          <NFormItem label="代码集说明" class="col-span-2">
            <NInput v-model:value="formModel.description" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
          <NFormItem label="备注" class="col-span-2">
            <NInput v-model:value="formModel.remark" />
          </NFormItem>
        </div>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="modalLoading" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="itemModalVisible" preset="card" :title="`代码项维护 - ${currentCodeSetName}`" class="w-980px">
      <div class="grid grid-cols-[1.3fr_1fr] gap-16px">
        <NCard title="代码项列表" :bordered="false" size="small">
          <template #header-extra>
            <NButton type="primary" size="small" @click="handleAddCodeItem">新增代码项</NButton>
          </template>
          <NDataTable :columns="itemColumns" :data="codeItems" :pagination="false" :row-key="row => row.codeItemId" />
        </NCard>
        <NCard title="代码项表单" :bordered="false" size="small">
          <NForm ref="itemFormRef" :model="itemFormModel" :rules="itemRules" label-placement="left" label-width="80">
            <NFormItem label="代码值" path="codeValue">
              <NInput v-model:value="itemFormModel.codeValue" />
            </NFormItem>
            <NFormItem label="代码名称" path="codeName">
              <NInput v-model:value="itemFormModel.codeName" />
            </NFormItem>
            <NFormItem label="排序">
              <NInputNumber v-model:value="itemFormModel.sortNum" class="w-full" />
            </NFormItem>
            <NFormItem label="状态">
              <NInput v-model:value="itemFormModel.enabledFlag" placeholder="1=启用 0=停用" />
            </NFormItem>
            <NFormItem label="说明">
              <NInput
                v-model:value="itemFormModel.description"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 4 }"
              />
            </NFormItem>
          </NForm>
          <NSpace justify="end">
            <NButton @click="resetItemForm">重置</NButton>
            <NButton type="primary" :loading="itemModalLoading" @click="handleSubmitCodeItem">保存代码项</NButton>
          </NSpace>
        </NCard>
      </div>
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
