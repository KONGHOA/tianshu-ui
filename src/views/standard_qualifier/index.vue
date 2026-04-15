<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NTag } from 'naive-ui';
import {
  fetchAbolishStdQualifier,
  fetchChangeStdQualifier,
  fetchCreateStdQualifier,
  fetchGetStdQualifier,
  fetchGetStdQualifierHistory,
  fetchGetStdQualifierList,
  fetchSubmitStdQualifier,
  fetchUpdateStdQualifier
} from '@/service/api/metadata/standard-qualifier';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardQualifier'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = reactive<Api.Metadata.StdQualifierSearchParams>({
  pageNum: 1,
  pageSize: 10,
  qualifierName: null,
  internalIdentifier: null,
  qualifierSymbol: null,
  lifecycleStatus: null,
  standardCategory: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdQualifierList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  columns: () => []
});

const formRef = ref<FormInst | null>(null);
const modalVisible = ref(false);
const modalLoading = ref(false);
const historyVisible = ref(false);
const historyLoading = ref(false);
const editingId = ref<CommonType.IdType | null>(null);
const historyList = ref<Api.Metadata.StdQualifierVersion[]>([]);
const historyTitle = ref('');

const formModel = reactive<Api.Metadata.StdQualifierOperateParams>({
  qualifierId: undefined,
  qualifierName: '',
  englishName: '',
  pinyinName: '',
  qualifierSymbol: '',
  description: '',
  context: '',
  version: '1.0',
  lifecycleStatus: 'ORIGIN',
  submissionOrg: '',
  registrationOrg: '',
  responsiblePerson: '',
  standardCategory: '',
  standardNumber: '',
  standardName: '',
  standardStatus: '',
  remark: ''
});

const rules: FormRules = {
  qualifierName: { required: true, message: '请输入限定词名称', trigger: ['blur', 'input'] }
};

function resetForm() {
  editingId.value = null;
  Object.assign(formModel, {
    qualifierId: undefined,
    qualifierName: '',
    englishName: '',
    pinyinName: '',
    qualifierSymbol: '',
    description: '',
    context: '',
    version: '1.0',
    lifecycleStatus: 'ORIGIN',
    submissionOrg: '',
    registrationOrg: '',
    responsiblePerson: '',
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
  searchParams.qualifierName = null;
  searchParams.internalIdentifier = null;
  searchParams.qualifierSymbol = null;
  searchParams.lifecycleStatus = null;
  searchParams.standardCategory = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(qualifierId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdQualifier(qualifierId);
  if (error || !detail) return;
  editingId.value = qualifierId;
  Object.assign(formModel, detail);
  modalVisible.value = true;
}

async function handleHistory(row: Api.Metadata.StdQualifier) {
  historyTitle.value = row.qualifierName;
  historyVisible.value = true;
  historyLoading.value = true;
  const { data: history } = await fetchGetStdQualifierHistory(row.bizId);
  historyList.value = history || [];
  historyLoading.value = false;
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingId.value ? fetchUpdateStdQualifier(formModel) : fetchCreateStdQualifier(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

async function handleWorkflowSubmit(row: Api.Metadata.StdQualifier) {
  const { error } = await fetchSubmitStdQualifier({
    id: row.qualifierId,
    bizId: row.bizId,
    flowCode: 'std_qualifier',
    submitReason: `提交限定词《${row.qualifierName}》进入审批流程`
  });
  if (error) return;
  window.$message?.success('提交审批成功');
  getData();
}

async function handleWorkflowChange(row: Api.Metadata.StdQualifier) {
  const { error } = await fetchChangeStdQualifier({
    id: row.qualifierId,
    bizId: row.bizId,
    flowCode: 'std_qualifier',
    submitReason: `发起限定词《${row.qualifierName}》变更审批`
  });
  if (error) return;
  window.$message?.success('变更申请已提交');
  getData();
}

async function handleWorkflowAbolish(row: Api.Metadata.StdQualifier) {
  const { error } = await fetchAbolishStdQualifier({
    id: row.qualifierId,
    bizId: row.bizId,
    flowCode: 'std_qualifier',
    submitReason: `发起限定词《${row.qualifierName}》废止审批`
  });
  if (error) return;
  window.$message?.success('废止申请已提交');
  getData();
}

const columns = computed<DataTableColumns<Api.Metadata.StdQualifier>>(() => [
  { key: 'internalIdentifier', title: '内部标识符', minWidth: 120 },
  { key: 'qualifierName', title: '限定词名称', minWidth: 180 },
  { key: 'qualifierSymbol', title: '标识符', minWidth: 140 },
  { key: 'version', title: '版本号', width: 90 },
  {
    key: 'lifecycleStatus',
    title: '状态',
    width: 100,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.lifecycleStatus === 'STANDARD' ? 'success' : 'warning' },
        { default: () => row.lifecycleStatus || '-' }
      )
  },
  { key: 'standardCategory', title: '标准分类', width: 120 },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
  {
    key: 'operate',
    title: '操作',
    width: 180,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        hasAuth('metadata:standard:qualifier:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.qualifierId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:qualifier:submit') && ['ORIGIN', 'REJECTED'].includes(row.lifecycleStatus || '')
          ? h(
              NButton,
              { text: true, type: 'success', onClick: () => handleWorkflowSubmit(row) },
              { default: () => '提交' }
            )
          : null,
        hasAuth('metadata:standard:qualifier:change') && row.lifecycleStatus === 'STANDARD'
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleWorkflowChange(row) },
              { default: () => '变更' }
            )
          : null,
        hasAuth('metadata:standard:qualifier:abolish') && row.lifecycleStatus === 'STANDARD'
          ? h(
              NButton,
              { text: true, type: 'error', onClick: () => handleWorkflowAbolish(row) },
              { default: () => '废止' }
            )
          : null,
        h(NButton, { text: true, onClick: () => handleHistory(row) }, { default: () => '历史' })
      ])
  }
]);

const historyColumns: DataTableColumns<Api.Metadata.StdQualifierVersion> = [
  { key: 'versionNo', title: '版本号', width: 100 },
  { key: 'actionType', title: '操作类型', width: 100 },
  { key: 'qualifierName', title: '名称', minWidth: 160 },
  { key: 'qualifierSymbol', title: '标识符', minWidth: 140 },
  { key: 'lifecycleStatus', title: '状态', width: 100 },
  { key: 'isCurrent', title: '当前版本', width: 90 }
];
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="限定词检索" :bordered="false" size="small">
      <div class="flex flex-wrap gap-12px">
        <NInput v-model:value="searchParams.qualifierName" placeholder="限定词名称" class="w-180px" clearable />
        <NInput v-model:value="searchParams.internalIdentifier" placeholder="内部标识符" class="w-180px" clearable />
        <NInput v-model:value="searchParams.qualifierSymbol" placeholder="标识符" class="w-180px" clearable />
        <NInput v-model:value="searchParams.lifecycleStatus" placeholder="状态" class="w-140px" clearable />
        <NInput v-model:value="searchParams.standardCategory" placeholder="标准分类" class="w-160px" clearable />
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleReset">重置</NButton>
        </NSpace>
      </div>
    </NCard>

    <NCard title="限定词列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:qualifier:add')" type="primary" @click="handleAdd">
            新增限定词
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
        :row-key="row => row.qualifierId"
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" :title="editingId ? '编辑限定词' : '新增限定词'" class="w-780px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="100">
        <div class="grid grid-cols-2 gap-x-16px">
          <NFormItem label="限定词名称" path="qualifierName">
            <NInput v-model:value="formModel.qualifierName" />
          </NFormItem>
          <NFormItem label="英文名称"><NInput v-model:value="formModel.englishName" /></NFormItem>
          <NFormItem label="拼音名称"><NInput v-model:value="formModel.pinyinName" /></NFormItem>
          <NFormItem label="标识符"><NInput v-model:value="formModel.qualifierSymbol" /></NFormItem>
          <NFormItem label="语境"><NInput v-model:value="formModel.context" /></NFormItem>
          <NFormItem label="状态"><NInput v-model:value="formModel.lifecycleStatus" /></NFormItem>
          <NFormItem label="提出机构"><NInput v-model:value="formModel.submissionOrg" /></NFormItem>
          <NFormItem label="登记机构"><NInput v-model:value="formModel.registrationOrg" /></NFormItem>
          <NFormItem label="责任人"><NInput v-model:value="formModel.responsiblePerson" /></NFormItem>
          <NFormItem label="标准分类"><NInput v-model:value="formModel.standardCategory" /></NFormItem>
          <NFormItem label="标准号"><NInput v-model:value="formModel.standardNumber" /></NFormItem>
          <NFormItem label="标准名称"><NInput v-model:value="formModel.standardName" /></NFormItem>
          <NFormItem label="标准状态"><NInput v-model:value="formModel.standardStatus" /></NFormItem>
          <NFormItem label="说明" class="col-span-2">
            <NInput v-model:value="formModel.description" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
          <NFormItem label="备注" class="col-span-2"><NInput v-model:value="formModel.remark" /></NFormItem>
        </div>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="modalLoading" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="historyVisible" preset="card" :title="`历史版本 - ${historyTitle}`" class="w-760px">
      <NDataTable :columns="historyColumns" :data="historyList" :loading="historyLoading" :pagination="false" />
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
