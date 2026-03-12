<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { NForm, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui';

defineOptions({
  name: 'BasicInfoStep'
});

interface Props {
  model: Api.Dataingest.IngestJobOperateParams;
  jobTypeOptions: { label: string; value: string }[];
  scheduleTypeOptions: { label: string; value: string }[];
  statusOptions: { label: string; value: string }[];
}

defineProps<Props>();
</script>

<template>
  <NForm :model="model" label-placement="left" :label-width="110">
    <NFormItem label="作业名称">
      <NInput v-model:value="model.jobName" placeholder="请输入作业名称" />
    </NFormItem>
    <NFormItem label="作业类型">
      <NSelect v-model:value="model.jobType" :options="jobTypeOptions" />
    </NFormItem>
    <NFormItem label="调度方式">
      <NSelect v-model:value="model.scheduleType" :options="scheduleTypeOptions" />
    </NFormItem>
    <NFormItem v-if="model.scheduleType === 'CRON'" label="Cron 表达式">
      <NInput v-model:value="model.scheduleExpression" placeholder="例：0 0 2 * * ?" />
    </NFormItem>
    <NFormItem label="并行度">
      <NInputNumber v-model:value="model.parallelism" :min="1" :max="32" class="w-full" />
    </NFormItem>
    <NFormItem label="最大重试次数">
      <NInputNumber v-model:value="model.maxRetryTimes" :min="0" :max="10" class="w-full" />
    </NFormItem>
    <NFormItem label="状态">
      <NSelect v-model:value="model.status" :options="statusOptions" />
    </NFormItem>
    <NFormItem label="备注">
      <NInput v-model:value="model.remark" type="textarea" :rows="2" placeholder="备注信息" />
    </NFormItem>
  </NForm>
</template>
