<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NTag } from 'naive-ui';
import {
  fetchAbolishStdDataElement,
  fetchChangeStdDataElement,
  fetchCreateStdDataElement,
  fetchGetStdDataElement,
  fetchGetStdDataElementHistory,
  fetchGetStdDataElementList,
  fetchSubmitStdDataElement,
  fetchUpdateStdDataElement
} from '@/service/api/metadata/standard-element';
import { fetchGetStdCodeSetList } from '@/service/api/metadata/standard-code-set';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardElement'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const dataElementTypeOptions = [
  { label: '基础数据元', value: 'BASIC' },
  { label: '业务数据元', value: 'BUSINESS' },
  { label: '共享数据元', value: 'SHARED' }
];

const searchParams = reactive<Api.Metadata.StdDataElementSearchParams>({
  pageNum: 1,
  pageSize: 10,
  chineseName: null,
  internalIdentifier: null,
  symbol: null,
  lifecycleStatus: null,
  standardCategory: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdDataElementList(searchParams),
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
const codeSetVisible = ref(false);
const codeSetLoading = ref(false);
const editingId = ref<CommonType.IdType | null>(null);
const historyList = ref<Api.Metadata.StdDataElementVersion[]>([]);
const historyTitle = ref('');
const codeSetList = ref<Api.Metadata.StdCodeSet[]>([]);

const formModel = reactive<Api.Metadata.StdDataElementOperateParams>({
  dataElementId: undefined,
  bizId: '',
  dataElementType: '',
  internalIdentifier: '',
  chineseName: '',
  englishName: '',
  pinyinName: '',
  keywordFieldName: '',
  publishedName: '',
  language: '',
  symbol: '',
  context: '',
  version: '1.0',
  synonym: '',
  definition: '',
  objectTerm: '',
  featureTerm: '',
  applicationConstraint: '',
  applicationContext: '',
  classificationScheme: '',
  classificationValue: '',
  relationship: '',
  relationshipDescription: '',
  representationTerm: '',
  dataType: '',
  dataFormat: '',
  normalizedIdentifier: '',
  codeSetId: undefined,
  codeSetCode: '',
  codeSetName: '',
  valueRange: '',
  measurementUnit: '',
  fusionUnitType: '',
  fusionUnitCode: '',
  lifecycleStatus: 'ORIGIN',
  submissionOrg: '',
  registrationOrg: '',
  responsiblePerson: '',
  standardCategory: '',
  standardNumber: '',
  standardName: '',
  standardStatus: '',
  description: '',
  remark: ''
});

const rules: FormRules = {
  dataElementType: { required: true, message: '请选择数据元类型', trigger: ['change', 'blur'] },
  chineseName: { required: true, message: '请输入中文名称', trigger: ['blur', 'input'] },
  symbol: { required: true, message: '请输入标识符', trigger: ['blur', 'input'] },
  definition: { required: true, message: '请输入说明', trigger: ['blur', 'input'] },
  submissionOrg: { required: true, message: '请输入提交机构', trigger: ['blur', 'input'] }
};

function resetForm() {
  editingId.value = null;
  Object.assign(formModel, {
    dataElementId: undefined,
    bizId: '',
    dataElementType: '',
    internalIdentifier: '',
    chineseName: '',
    englishName: '',
    pinyinName: '',
    keywordFieldName: '',
    publishedName: '',
    language: '',
    symbol: '',
    context: '',
    version: '1.0',
    synonym: '',
    definition: '',
    objectTerm: '',
    featureTerm: '',
    applicationConstraint: '',
    applicationContext: '',
    classificationScheme: '',
    classificationValue: '',
    relationship: '',
    relationshipDescription: '',
    representationTerm: '',
    dataType: '',
    dataFormat: '',
    normalizedIdentifier: '',
    codeSetId: undefined,
    codeSetCode: '',
    codeSetName: '',
    valueRange: '',
    measurementUnit: '',
    fusionUnitType: '',
    fusionUnitCode: '',
    lifecycleStatus: 'ORIGIN',
    submissionOrg: '',
    registrationOrg: '',
    responsiblePerson: '',
    standardCategory: '',
    standardNumber: '',
    standardName: '',
    standardStatus: '',
    description: '',
    remark: ''
  });
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleReset() {
  searchParams.chineseName = null;
  searchParams.internalIdentifier = null;
  searchParams.symbol = null;
  searchParams.lifecycleStatus = null;
  searchParams.standardCategory = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(dataElementId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdDataElement(dataElementId);
  if (error || !detail) return;
  editingId.value = dataElementId;
  Object.assign(formModel, detail);
  modalVisible.value = true;
}

async function handleHistory(row: Api.Metadata.StdDataElement) {
  historyTitle.value = row.chineseName;
  historyVisible.value = true;
  historyLoading.value = true;
  const { data: history } = await fetchGetStdDataElementHistory(row.bizId);
  historyList.value = history || [];
  historyLoading.value = false;
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingId.value ? fetchUpdateStdDataElement(formModel) : fetchCreateStdDataElement(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

async function handleWorkflowSubmit(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchSubmitStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `提交数据元《${row.chineseName}》进入审批流程`
  });
  if (error) return;
  window.$message?.success('提交审批成功');
  getData();
}

async function handleWorkflowChange(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchChangeStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `发起数据元《${row.chineseName}》变更审批`
  });
  if (error) return;
  window.$message?.success('变更申请已提交');
  getData();
}

async function handleWorkflowAbolish(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchAbolishStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `发起数据元《${row.chineseName}》废止审批`
  });
  if (error) return;
  window.$message?.success('废止申请已提交');
  getData();
}

async function openCodeSetSelector() {
  codeSetVisible.value = true;
  if (codeSetList.value.length > 0) return;
  codeSetLoading.value = true;
  const { data: list } = await fetchGetStdCodeSetList({ pageNum: 1, pageSize: 200, params: {} });
  codeSetList.value = list?.rows || [];
  codeSetLoading.value = false;
}

function selectCodeSet(row: Api.Metadata.StdCodeSet) {
  formModel.codeSetId = row.codeSetId;
  formModel.codeSetCode = row.codeSetCode;
  formModel.codeSetName = row.codeSetName;
  codeSetVisible.value = false;
}

function clearCodeSet() {
  formModel.codeSetId = undefined;
  formModel.codeSetCode = '';
  formModel.codeSetName = '';
}

function handleSimilaritySuggest() {
  window.$message?.info('相似推荐待接入');
}

function handleFormatAssist() {
  window.$message?.info('表示格式模板输入能力待接入');
}

const columns = computed<DataTableColumns<Api.Metadata.StdDataElement>>(() => [
  { key: 'internalIdentifier', title: '内部标识符', minWidth: 120 },
  { key: 'chineseName', title: '中文名称', minWidth: 180 },
  { key: 'symbol', title: '标识符', minWidth: 140 },
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
        hasAuth('metadata:standard:element:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.dataElementId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:element:submit') && ['ORIGIN', 'REJECTED'].includes(row.lifecycleStatus || '')
          ? h(
              NButton,
              { text: true, type: 'success', onClick: () => handleWorkflowSubmit(row) },
              { default: () => '提交' }
            )
          : null,
        hasAuth('metadata:standard:element:change') && row.lifecycleStatus === 'STANDARD'
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleWorkflowChange(row) },
              { default: () => '变更' }
            )
          : null,
        hasAuth('metadata:standard:element:abolish') && row.lifecycleStatus === 'STANDARD'
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

const historyColumns: DataTableColumns<Api.Metadata.StdDataElementVersion> = [
  { key: 'versionNo', title: '版本号', width: 100 },
  { key: 'actionType', title: '操作类型', width: 100 },
  { key: 'chineseName', title: '名称', minWidth: 160 },
  { key: 'symbol', title: '标识符', minWidth: 140 },
  { key: 'lifecycleStatus', title: '状态', width: 100 },
  { key: 'isCurrent', title: '当前版本', width: 90 }
];

const codeSetColumns: DataTableColumns<Api.Metadata.StdCodeSet> = [
  { key: 'codeSetCode', title: '代码集编码', width: 140 },
  { key: 'codeSetName', title: '代码集名称', minWidth: 220 },
  { key: 'version', title: '版本', width: 80 },
  {
    key: 'operate',
    title: '选择',
    width: 90,
    render: row =>
      h(NButton, { size: 'small', type: 'primary', onClick: () => selectCodeSet(row) }, { default: () => '选择' })
  }
];
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard
      :bordered="false"
      size="small"
      class="search-card rounded-12px border-none bg-white shadow-sm dark:bg-transparent"
    >
      <NForm
        :model="searchParams"
        label-placement="left"
        label-width="84"
        class="pb-0 pl-8px pr-8px pt-8px"
        @keyup.enter="handleSearch"
      >
        <NGrid :x-gap="24" :y-gap="8" cols="1 s:2 m:3 xl:4" responsive="screen">
          <NGridItem>
            <NFormItem label="中文名称" path="chineseName">
              <NInput v-model:value="searchParams.chineseName" placeholder="请输入中文名称..." clearable />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="内部标识符" path="internalIdentifier">
              <NInput v-model:value="searchParams.internalIdentifier" placeholder="请输入内部标识符..." clearable />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="标识符" path="symbol">
              <NInput v-model:value="searchParams.symbol" placeholder="请输入标识符..." clearable />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="状态" path="lifecycleStatus">
              <NInput v-model:value="searchParams.lifecycleStatus" placeholder="请输入状态..." clearable />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="标准分类" path="standardCategory">
              <NInput v-model:value="searchParams.standardCategory" placeholder="请输入标准分类..." clearable />
            </NFormItem>
          </NGridItem>
          <NGridItem suffix class="flex justify-end pt-4px">
            <NSpace>
              <NButton type="primary" @click="handleSearch">
                <template #icon><icon-mdi-magnify /></template>
                查询
              </NButton>
              <NButton @click="handleReset">
                <template #icon><icon-mdi-refresh /></template>
                重置
              </NButton>
            </NSpace>
          </NGridItem>
        </NGrid>
      </NForm>
    </NCard>

    <NCard title="数据元列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:element:add')" type="primary" @click="handleAdd">
            新增数据元
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
        :row-key="row => row.dataElementId"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '数据元编辑' : '数据元新增'"
      class="std-element-modal"
    >
      <NForm
        ref="formRef"
        :model="formModel"
        :rules="rules"
        label-placement="left"
        label-width="98"
        require-mark-placement="left"
      >
        <div class="std-element-grid">
          <NFormItem label="数据元类型" path="dataElementType">
            <NSelect
              v-model:value="formModel.dataElementType"
              :options="dataElementTypeOptions"
              placeholder="请选择数据元类型"
              clearable
            />
          </NFormItem>
          <NFormItem label="内部标识符">
            <NInput v-model:value="formModel.internalIdentifier" placeholder="新增后系统自动生成" readonly />
          </NFormItem>
          <NFormItem label="中文名称" path="chineseName">
            <div class="inline-field">
              <NInput v-model:value="formModel.chineseName" maxlength="200" show-count placeholder="请输入中文名" />
              <NButton secondary type="primary" @click="handleSimilaritySuggest">暂无相似推荐</NButton>
            </div>
          </NFormItem>

          <NFormItem label="英文名称">
            <NInput v-model:value="formModel.englishName" maxlength="200" show-count />
          </NFormItem>
          <NFormItem label="中文全拼">
            <NInput v-model:value="formModel.pinyinName" maxlength="200" show-count />
          </NFormItem>
          <NFormItem label="标识符" path="symbol">
            <NInput v-model:value="formModel.symbol" maxlength="100" show-count placeholder="请输入标识符" />
          </NFormItem>

          <NFormItem label="关键字段名称">
            <NInput v-model:value="formModel.keywordFieldName" maxlength="100" show-count />
          </NFormItem>
          <NFormItem label="发布名称">
            <NInput v-model:value="formModel.publishedName" maxlength="100" show-count />
          </NFormItem>
          <NFormItem label="语境">
            <NInput v-model:value="formModel.language" maxlength="50" show-count />
          </NFormItem>

          <NFormItem label="版本">
            <NInput v-model:value="formModel.version" />
          </NFormItem>
          <NFormItem label="同义名称">
            <NInput v-model:value="formModel.synonym" />
          </NFormItem>
          <NFormItem label="说明" path="definition">
            <NInput v-model:value="formModel.definition" maxlength="255" show-count placeholder="请输入说明" />
          </NFormItem>

          <NFormItem label="对象类词">
            <NInput v-model:value="formModel.objectTerm" />
          </NFormItem>
          <NFormItem label="特性词">
            <NInput v-model:value="formModel.featureTerm" />
          </NFormItem>
          <NFormItem label="应用约束">
            <NInput v-model:value="formModel.applicationConstraint" maxlength="200" show-count />
          </NFormItem>

          <NFormItem label="分类方案">
            <NInput v-model:value="formModel.classificationScheme" placeholder="请输入关键词" />
          </NFormItem>
          <NFormItem label="分类方案值">
            <NInput v-model:value="formModel.classificationValue" placeholder="请输入关键词" />
          </NFormItem>
          <NFormItem label="关系">
            <NInput v-model:value="formModel.relationship" maxlength="200" show-count />
          </NFormItem>

          <NFormItem label="表示词">
            <NInput v-model:value="formModel.representationTerm" />
          </NFormItem>
          <NFormItem label="数据类型">
            <NInput v-model:value="formModel.dataType" />
          </NFormItem>
          <NFormItem label="表示格式">
            <div class="inline-field">
              <NInput v-model:value="formModel.dataFormat" placeholder="请输入表示格式" />
              <NButton secondary type="primary" @click="handleFormatAssist">输入</NButton>
            </div>
          </NFormItem>

          <NFormItem label="归一化标识">
            <NInput v-model:value="formModel.normalizedIdentifier" maxlength="50" show-count />
          </NFormItem>
          <NFormItem label="代码集">
            <div class="inline-field">
              <NInput :value="formModel.codeSetName || ''" placeholder="请选择代码集" readonly />
              <NButton secondary type="primary" @click="openCodeSetSelector">选择</NButton>
              <NButton @click="clearCodeSet">清除</NButton>
            </div>
          </NFormItem>
          <NFormItem label="值域">
            <NInput v-model:value="formModel.valueRange" maxlength="1000" show-count />
          </NFormItem>

          <NFormItem label="计量单位">
            <NInput v-model:value="formModel.measurementUnit" placeholder="请输入关键词" />
          </NFormItem>
          <NFormItem label="融合单位类型">
            <NInput v-model:value="formModel.fusionUnitType" maxlength="200" show-count />
          </NFormItem>
          <NFormItem label="融合单位编码">
            <NInput v-model:value="formModel.fusionUnitCode" maxlength="200" show-count />
          </NFormItem>

          <NFormItem label="提交机构" path="submissionOrg">
            <NInput v-model:value="formModel.submissionOrg" maxlength="200" show-count />
          </NFormItem>
          <NFormItem label="注册机构">
            <NInput v-model:value="formModel.registrationOrg" maxlength="200" show-count />
          </NFormItem>
          <NFormItem label="主要起草人">
            <NInput v-model:value="formModel.responsiblePerson" maxlength="20" show-count />
          </NFormItem>

          <NFormItem label="描述" class="span-2">
            <NInput
              v-model:value="formModel.description"
              type="textarea"
              placeholder="请输入描述"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </div>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="modalLoading" @click="handleSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="codeSetVisible" preset="card" title="选择代码集" class="w-880px">
      <NDataTable
        :columns="codeSetColumns"
        :data="codeSetList"
        :loading="codeSetLoading"
        :pagination="false"
        :row-key="row => row.codeSetId"
      />
    </NModal>

    <NModal v-model:show="historyVisible" preset="card" :title="`历史版本 - ${historyTitle}`" class="w-860px">
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

:global(.std-element-modal) {
  width: min(1320px, 88vw) !important;
}

:global(.std-element-modal) .n-card__content {
  overflow: visible;
}

.std-element-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 18px;
}

.inline-field {
  display: flex;
  gap: 8px;
  width: 100%;
}

.inline-field :deep(.n-input) {
  flex: 1;
}

.span-2 {
  grid-column: span 2;
}

@media (max-width: 1200px) {
  .std-element-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .std-element-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2 {
    grid-column: auto;
  }

  .inline-field {
    flex-wrap: wrap;
  }
}
</style>
