<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NCode,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NScrollbar,
  NSpin,
  NTag
} from 'naive-ui';
import { fetchGetJobInstanceDetail, fetchSyncInstanceStatus } from '@/service/api/dataingest';

defineOptions({
  name: 'InstanceDetailDrawer'
});

interface Props {
  instanceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);
const detail = ref<Api.Dataingest.IngestJobInstance | null>(null);

const title = computed(() => `执行实例详情${detail.value?.instanceId ? ` #${detail.value.instanceId}` : ''}`);

const reconcileText = computed(() => {
  const read = detail.value?.readRowCount ?? null;
  const write = detail.value?.writeRowCount ?? null;
  if (read === null || write === null) return '暂无对账数据';
  if (read === write) return `读写一致：${read}`;
  return `读写不一致：读取 ${read}，写入 ${write}，差值 ${read - write}`;
});

const statusTagType = computed<'default' | 'info' | 'success' | 'warning' | 'error'>(() => {
  const status = detail.value?.jobStatus;
  switch (status) {
    case 'SUCCEED':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'RUNNING':
    case 'SUBMITTED':
      return 'info';
    case 'PAUSED':
      return 'warning';
    default:
      return 'default';
  }
});

watch(
  () => [visible.value, props.instanceId] as const,
  ([show, instanceId]) => {
    if (show && instanceId) {
      loadDetail();
    }
  },
  { immediate: true }
);

async function loadDetail(sync = false) {
  if (!props.instanceId) return;
  loading.value = true;
  if (sync) {
    await fetchSyncInstanceStatus(props.instanceId);
  }
  const { data, error } = await fetchGetJobInstanceDetail(props.instanceId);
  loading.value = false;
  if (!error) {
    detail.value = data ?? null;
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="960" display-directive="show" class="max-w-95%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSpin :show="loading">
        <template v-if="detail">
          <div class="mb-12px flex items-center justify-between gap-12px">
            <NTag :type="statusTagType" size="medium">
              {{ detail.jobStatus }}
            </NTag>
            <NButton type="primary" ghost @click="loadDetail(true)">同步最新状态</NButton>
          </div>

          <NAlert class="mb-12px" type="info" :show-icon="false">
            {{ reconcileText }}
          </NAlert>

          <NDescriptions label-placement="left" :column="2" size="small" bordered class="mb-12px">
            <NDescriptionsItem label="作业ID">{{ detail.jobId }}</NDescriptionsItem>
            <NDescriptionsItem label="引擎作业ID">{{ detail.engineJobId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="作业版本">{{ detail.jobVersion ?? '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="触发方式">{{ detail.triggerType || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="读取行数">{{ detail.readRowCount ?? '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="写入行数">{{ detail.writeRowCount ?? '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="开始时间">{{ detail.startTime || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="结束时间">{{ detail.endTime || '-' }}</NDescriptionsItem>
          </NDescriptions>

          <NAlert v-if="detail.errorMsg" class="mb-12px" type="error" title="错误信息">
            {{ detail.errorMsg }}
          </NAlert>

          <div class="mb-12px">
            <div class="mb-8px text-14px font-600">运行指标</div>
            <NScrollbar x-scrollable class="max-h-180px rounded-8px bg-#0f172a px-12px py-8px">
              <NCode :code="detail.metricsJson || '{}'" language="json" word-wrap />
            </NScrollbar>
          </div>

          <div class="mb-12px">
            <div class="mb-8px text-14px font-600">字段映射快照</div>
            <NScrollbar x-scrollable class="max-h-220px rounded-8px bg-#0f172a px-12px py-8px">
              <NCode :code="detail.mappingSnapshot || '[]'" language="json" word-wrap />
            </NScrollbar>
          </div>

          <div>
            <div class="mb-8px text-14px font-600">配置快照</div>
            <NScrollbar x-scrollable class="max-h-260px rounded-8px bg-#0f172a px-12px py-8px">
              <NCode :code="detail.configSnapshot || detail.jobConfig || ''" language="hocon" word-wrap />
            </NScrollbar>
          </div>
        </template>

        <NEmpty v-else description="暂无实例详情" class="py-60px" />
      </NSpin>

      <template #footer>
        <NButton @click="visible = false">关闭</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
