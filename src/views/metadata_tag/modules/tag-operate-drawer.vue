<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { jsonClone } from '@sa/utils';
import { fetchAddTag, fetchUpdateTag } from '@/service/api/metadata/tag';
import { fetchGetAllTagCategories } from '@/service/api/metadata/tag-category';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TagOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Metadata.Tag | null;
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
    add: '新增标签',
    edit: '编辑标签'
  };
  return titles[props.operateType];
});

type Model = Api.Metadata.TagOperateParams;

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    tagId: null,
    name: '',
    categoryUuid: ''
  };
}

const categoryOptions = ref<{ label: string; value: string }[]>([]);

async function loadCategories() {
  const { error, data } = await fetchGetAllTagCategories();
  if (!error && data) {
    categoryOptions.value = data.map(item => ({
      label: item.name,
      value: item.uuid
    }));
  }
}

const rules = {
  name: createRequiredRule('标签名称不能为空'),
  categoryUuid: createRequiredRule('所属分类不能为空')
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
    const { error } = await fetchAddTag(model.value);
    if (error) return;
  }

  if (props.operateType === 'edit') {
    const { error } = await fetchUpdateTag(model.value);
    if (error) return;
  }

  window.$message?.success($t('common.updateSuccess'));
  closeDrawer();
  emit('submitted');
}

watch(visible, () => {
  if (visible.value) {
    loadCategories();
    handleUpdateModelWhenEdit();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="500">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="100">
        <NFormItem label="标签名称" path="name">
          <NInput v-model:value="model.name" placeholder="请输入标签名称" />
        </NFormItem>
        <NFormItem label="所属分类" path="categoryUuid">
          <NSelect
            v-model:value="model.categoryUuid"
            :options="categoryOptions"
            placeholder="请选择所属分类"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
