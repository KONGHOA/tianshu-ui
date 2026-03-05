<script setup lang="ts">
import { toRaw } from 'vue';
import { NSelect } from 'naive-ui';
import { jsonClone } from '@sa/utils';
import { useNaiveForm } from '@/hooks/common/form';

const levelOptions = [
  { label: '库级变更', value: 'database' },
  { label: '表级变更', value: 'table' },
  { label: '列级变更', value: 'column' }
];

defineOptions({
  name: 'SchemaChangeSearch'
});

interface Emits {
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Metadata.SchemaChangeSearchParams>('model', { required: true });

const defaultModel = jsonClone(toRaw(model.value));

function resetModel() {
  Object.assign(model.value, defaultModel);
}

async function reset() {
  await restoreValidation();
  resetModel();
  emit('search');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem title="搜索" name="schema-change-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="变更层级" path="entityLevel" class="pr-24px">
              <NSelect v-model:value="model.entityLevel" :options="levelOptions" placeholder="全部层级" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="数据库名" path="databaseName" class="pr-24px">
              <NInput v-model:value="model.databaseName" placeholder="请输入数据库名" clearable @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="表名" path="tableName" class="pr-24px">
              <NInput v-model:value="model.tableName" placeholder="请输入表名" clearable @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 m:6" class="pr-24px">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  重置
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  搜索
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
