<script setup lang="ts">
import { reactive, watch } from 'vue';
import { fetchAddCategory, fetchEditCategory } from '@/service/api/metadata/datasourceCategory';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'CategoryOperateDrawer'
});

interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData?: any;
  treeData?: any[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

type Model = {
  categoryId?: number;
  parentId: number;
  categoryName: string;
  orderNum: number;
};

const model: Model = reactive(createDefaultModel());

function createDefaultModel(): Model {
  return {
    parentId: 0,
    categoryName: '',
    orderNum: 0
  };
}

type RuleKey = Exclude<keyof Model, 'categoryId'>;

const rules: Record<RuleKey, App.Global.FormRule> = {
  parentId: defaultRequiredRule,
  categoryName: defaultRequiredRule,
  orderNum: defaultRequiredRule
};

function handleInitModel() {
  Object.assign(model, createDefaultModel());

  if (props.rowData) {
    Object.assign(model, props.rowData);
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();

  const submitFn = props.operateType === 'add' ? fetchAddCategory : fetchEditCategory;
  const { error } = await submitFn(model);
  if (!error) {
    window.$message?.success($t('common.updateSuccess'));
    closeDrawer();
    emit('submitted');
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="360">
    <NDrawerContent :title="operateType === 'add' ? '新增分类' : '编辑分类'" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="100">
        <NFormItem label="上级分类" path="parentId">
          <NTreeSelect
            v-model:value="model.parentId"
            :options="treeData"
            key-field="id"
            label-field="name"
            children-field="children"
            :default-value="0"
            placeholder="请选择上级分类"
          />
        </NFormItem>
        <NFormItem label="分类名称" path="categoryName">
          <NInput v-model:value="model.categoryName" placeholder="请输入分类名称" />
        </NFormItem>
        <NFormItem label="显示顺序" path="orderNum">
          <NInputNumber v-model:value="model.orderNum" placeholder="请输入显示顺序" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
