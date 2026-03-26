<script setup lang="ts">
import { NButton, NFormItem, NInput, NSelect } from 'naive-ui';

defineOptions({
  name: 'InstanceSearch'
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Dataingest.IngestJobInstanceSearchParams>('model', { required: true });

const statusOptions = [
  { label: '已提交', value: 'SUBMITTED' },
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCEED' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '已暂停', value: 'PAUSED' },
  { label: '未知', value: 'UNKNOWN' }
];

const triggerTypeOptions = [
  { label: '手动', value: 'MANUAL' },
  { label: '定时', value: 'SCHEDULE' },
  { label: 'API', value: 'API' }
];

function reset() {
  model.value.jobId = null;
  model.value.jobStatus = null;
  model.value.triggerType = null;
  emit('reset');
}
</script>

<template>
  <div class="flex-col gap-16px pt-8px">
    <NFormItem label="作业ID" label-placement="left" :label-width="80">
      <NInput v-model:value="model.jobId" placeholder="请输入作业ID" clearable @keydown.enter="emit('search')" />
    </NFormItem>
    <NFormItem label="执行状态" label-placement="left" :label-width="80">
      <NSelect
        v-model:value="model.jobStatus"
        :options="statusOptions"
        placeholder="请选择状态"
        clearable
        @update:value="emit('search')"
      />
    </NFormItem>
    <NFormItem label="触发方式" label-placement="left" :label-width="80">
      <NSelect
        v-model:value="model.triggerType"
        :options="triggerTypeOptions"
        placeholder="请选择触发方式"
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
