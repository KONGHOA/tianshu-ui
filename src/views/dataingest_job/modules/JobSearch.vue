<script setup lang="ts">
import { NButton, NFormItem, NInput, NSelect } from 'naive-ui';

defineOptions({
  name: 'JobSearch'
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Dataingest.IngestJobSearchParams>('model', { required: true });

const jobTypeOptions = [
  { label: '离线批量', value: 'BATCH' },
  { label: '实时流式', value: 'STREAM' },
  { label: 'CDC变更', value: 'CDC' }
];

const statusOptions = [
  { label: '启用', value: '0' },
  { label: '停用', value: '1' }
];

function reset() {
  model.value.jobName = null;
  model.value.jobType = null;
  model.value.status = null;
  emit('reset');
}
</script>

<template>
  <div class="flex-col gap-16px pt-8px">
    <NFormItem label="作业名称" label-placement="left" :label-width="80">
      <NInput v-model:value="model.jobName" placeholder="请输入作业名称" clearable @keydown.enter="emit('search')" />
    </NFormItem>
    <NFormItem label="作业类型" label-placement="left" :label-width="80">
      <NSelect
        v-model:value="model.jobType"
        :options="jobTypeOptions"
        placeholder="请选择作业类型"
        clearable
        @update:value="emit('search')"
      />
    </NFormItem>
    <NFormItem label="状态" label-placement="left" :label-width="80">
      <NSelect
        v-model:value="model.status"
        :options="statusOptions"
        placeholder="请选择状态"
        clearable
        @update:value="emit('search')"
      />
    </NFormItem>
    <div class="mt-8px flex items-center justify-end gap-12px">
      <NButton @click="reset">重置</NButton>
      <NButton type="primary" @click="emit('search')">查询</NButton>
    </div>
  </div>
</template>
