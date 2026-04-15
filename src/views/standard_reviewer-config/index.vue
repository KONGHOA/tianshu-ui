<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { NButton, NCard, NDataTable, NTag } from 'naive-ui';
import {
  fetchCreateStdReviewerConfig,
  fetchDeleteStdReviewerConfig,
  fetchGetStdReviewerConfig,
  fetchGetStdReviewerConfigList,
  fetchUpdateStdReviewerConfig
} from '@/service/api/metadata/standard-reviewer';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';

defineOptions({
  name: 'StandardReviewerConfig'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const searchParams = reactive<Api.Metadata.StdReviewerConfigSearchParams>({
  pageNum: 1,
  pageSize: 10,
  businessType: null,
  actionType: null,
  flowCode: null,
  stageCode: null,
  enabledFlag: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdReviewerConfigList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  columns: () => []
});

const modalVisible = ref(false);
const modalLoading = ref(false);
const formRef = ref<FormInst | null>(null);
const editingId = ref<CommonType.IdType | null>(null);

const formModel = reactive<Api.Metadata.StdReviewerConfigOperateParams>({
  reviewerConfigId: undefined,
  businessType: 'DATA_ELEMENT',
  actionType: 'CREATE',
  flowCode: 'std_data_element',
  stageCode: 'draft_review',
  stageName: '形式审查',
  roleId: undefined,
  roleName: '',
  userId: undefined,
  userName: '',
  sortNum: 1,
  enabledFlag: '1',
  remark: ''
});

const rules: FormRules = {
  businessType: { required: true, message: '请选择业务类型', trigger: ['blur', 'change'] },
  actionType: { required: true, message: '请选择操作类型', trigger: ['blur', 'change'] },
  flowCode: { required: true, message: '请输入流程编码', trigger: ['blur', 'input'] },
  stageCode: { required: true, message: '请输入阶段编码', trigger: ['blur', 'input'] },
  stageName: { required: true, message: '请输入阶段名称', trigger: ['blur', 'input'] }
};

function resetForm() {
  editingId.value = null;
  Object.assign(formModel, {
    reviewerConfigId: undefined,
    businessType: 'DATA_ELEMENT',
    actionType: 'CREATE',
    flowCode: 'std_data_element',
    stageCode: 'draft_review',
    stageName: '形式审查',
    roleId: undefined,
    roleName: '',
    userId: undefined,
    userName: '',
    sortNum: 1,
    enabledFlag: '1',
    remark: ''
  });
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleReset() {
  searchParams.businessType = null;
  searchParams.actionType = null;
  searchParams.flowCode = null;
  searchParams.stageCode = null;
  searchParams.enabledFlag = null;
  handleSearch();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(reviewerConfigId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdReviewerConfig(reviewerConfigId);
  if (error || !detail) return;
  editingId.value = reviewerConfigId;
  Object.assign(formModel, detail);
  modalVisible.value = true;
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingId.value ? fetchUpdateStdReviewerConfig(formModel) : fetchCreateStdReviewerConfig(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

async function handleDelete(reviewerConfigId: CommonType.IdType) {
  const { error } = await fetchDeleteStdReviewerConfig(reviewerConfigId);
  if (error) return;
  window.$message?.success('删除成功');
  getData();
}

const columns = computed<DataTableColumns<Api.Metadata.StdReviewerConfig>>(() => [
  { key: 'businessType', title: '业务类型', width: 120 },
  { key: 'actionType', title: '操作类型', width: 120 },
  { key: 'flowCode', title: '流程编码', minWidth: 140 },
  { key: 'stageCode', title: '阶段编码', minWidth: 140 },
  { key: 'stageName', title: '阶段名称', minWidth: 140 },
  { key: 'roleName', title: '角色', minWidth: 120 },
  { key: 'userName', title: '用户', minWidth: 120 },
  { key: 'sortNum', title: '排序', width: 80 },
  {
    key: 'enabledFlag',
    title: '状态',
    width: 90,
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
    width: 140,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        hasAuth('metadata:standard:reviewer:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', onClick: () => handleEdit(row.reviewerConfigId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:reviewer:remove')
          ? h(
              NButton,
              { text: true, type: 'error', onClick: () => handleDelete(row.reviewerConfigId) },
              { default: () => '删除' }
            )
          : null
      ])
  }
]);
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="审批专家配置检索" :bordered="false" size="small">
      <div class="flex flex-wrap gap-12px">
        <NInput v-model:value="searchParams.businessType" placeholder="业务类型" class="w-160px" clearable />
        <NInput v-model:value="searchParams.actionType" placeholder="操作类型" class="w-160px" clearable />
        <NInput v-model:value="searchParams.flowCode" placeholder="流程编码" class="w-180px" clearable />
        <NInput v-model:value="searchParams.stageCode" placeholder="阶段编码" class="w-180px" clearable />
        <NInput v-model:value="searchParams.enabledFlag" placeholder="启用标志" class="w-140px" clearable />
        <NSpace>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton @click="handleReset">重置</NButton>
        </NSpace>
      </div>
    </NCard>

    <NCard title="审批专家配置列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('metadata:standard:reviewer:add')" type="primary" @click="handleAdd">新增配置</NButton>
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
        :row-key="row => row.reviewerConfigId"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '编辑审批专家配置' : '新增审批专家配置'"
      class="w-820px"
    >
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="100">
        <div class="grid grid-cols-2 gap-x-16px">
          <NFormItem label="业务类型" path="businessType"><NInput v-model:value="formModel.businessType" /></NFormItem>
          <NFormItem label="操作类型" path="actionType"><NInput v-model:value="formModel.actionType" /></NFormItem>
          <NFormItem label="流程编码" path="flowCode"><NInput v-model:value="formModel.flowCode" /></NFormItem>
          <NFormItem label="阶段编码" path="stageCode"><NInput v-model:value="formModel.stageCode" /></NFormItem>
          <NFormItem label="阶段名称" path="stageName"><NInput v-model:value="formModel.stageName" /></NFormItem>
          <NFormItem label="排序号">
            <NInputNumber v-model:value="formModel.sortNum" class="w-full" :min="1" />
          </NFormItem>
          <NFormItem label="角色ID">
            <NInput
              :value="formModel.roleId == null ? '' : String(formModel.roleId)"
              @update:value="value => (formModel.roleId = value ? Number(value) : undefined)"
            />
          </NFormItem>
          <NFormItem label="角色名称"><NInput v-model:value="formModel.roleName" /></NFormItem>
          <NFormItem label="用户ID">
            <NInput
              :value="formModel.userId == null ? '' : String(formModel.userId)"
              @update:value="value => (formModel.userId = value ? Number(value) : undefined)"
            />
          </NFormItem>
          <NFormItem label="用户名称"><NInput v-model:value="formModel.userName" /></NFormItem>
          <NFormItem label="启用标志">
            <NInput v-model:value="formModel.enabledFlag" placeholder="1=启用，0=停用" />
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
  </div>
</template>

<style scoped lang="scss">
:deep(.n-data-table-wrapper),
:deep(.n-data-table-base-table),
:deep(.n-data-table-base-table-body) {
  height: 100%;
}
</style>
