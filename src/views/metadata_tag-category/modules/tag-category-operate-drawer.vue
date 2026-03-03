<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { jsonClone } from '@sa/utils';
import { fetchAddTagCategory, fetchUpdateTagCategory } from '@/service/api/metadata/tag-category';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TagCategoryOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Metadata.TagCategory | null;
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
const { createRequiredRule } = useFormRules();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: '新增标签分类',
    edit: '编辑标签分类'
  };
  return titles[props.operateType];
});

type Model = Api.Metadata.TagCategoryOperateParams;

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    categoryId: null,
    name: ''
  };
}

const rules = {
  name: createRequiredRule('标签分类名称不能为空')
};

function handleUpdateModelWhenEdit() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, jsonClone(props.rowData));
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();

  // request
  if (props.operateType === 'add') {
    const { error } = await fetchAddTagCategory(model.value);
    if (error) return;
  }

  if (props.operateType === 'edit') {
    const { error } = await fetchUpdateTagCategory(model.value);
    if (error) return;
  }

  window.$message?.success($t('common.updateSuccess'));
  closeDrawer();
  emit('submitted');
}

watch(visible, () => {
  if (visible.value) {
    handleUpdateModelWhenEdit();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="500" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="120">
        <NFormItem label="标签分类名称" path="name">
          <NInput v-model:value="model.name" placeholder="请输入标签分类名称" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace :size="16" justify="space-between" class="w-full">
          <div></div>
          <NSpace :size="16">
            <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
            <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
