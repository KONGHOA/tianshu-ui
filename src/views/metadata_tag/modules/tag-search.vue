<script setup lang="ts">
import { onMounted, ref, toRaw } from 'vue';
import { jsonClone } from '@sa/utils';
import { fetchGetAllTagCategories } from '@/service/api/metadata/tag-category';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TagSearch'
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Metadata.TagSearchParams>('model', { required: true });

const defaultModel = jsonClone(toRaw(model.value));

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

onMounted(() => {
  loadCategories();
});

function resetModel() {
  Object.assign(model.value, defaultModel);
}

async function reset() {
  await restoreValidation();
  resetModel();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="tag-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="100">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:8" label="标签名称" path="name" class="pr-24px">
              <NInput v-model:value="model.name" placeholder="请输入标签名称" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" label="所属分类" path="categoryUuid" class="pr-24px">
              <NSelect
                v-model:value="model.categoryUuid"
                placeholder="请选择所属分类"
                :options="categoryOptions"
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" class="pr-24px">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
