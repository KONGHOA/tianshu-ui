<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NCode,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NScrollbar,
  NSpin,
  NStatistic,
  NTag,
  NTooltip
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

type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';

const STATUS_MAP: Record<string, { label: string; type: TagType }> = {
  SUCCEED: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'error' },
  RUNNING: { label: '运行中', type: 'info' },
  SUBMITTED: { label: '已提交', type: 'info' },
  PAUSED: { label: '已暂停', type: 'warning' },
  CANCELLED: { label: '已取消', type: 'default' },
  UNKNOWN: { label: '未知', type: 'default' }
};

const statusCfg = computed(() => STATUS_MAP[detail.value?.jobStatus ?? ''] ?? { label: '未知', type: 'default' });

const reconcileType = computed<TagType>(() => {
  const read = detail.value?.readRowCount ?? null;
  const write = detail.value?.writeRowCount ?? null;
  if (read === null || write === null) return 'default';
  return read === write ? 'success' : 'warning';
});

const durationText = computed(() => {
  const start = detail.value?.startTime;
  const end = detail.value?.endTime;
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
});

const formattedMetrics = computed(() => {
  const raw = detail.value?.metricsJson;
  if (!raw || raw === '{}') return '{}';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
});

const formattedMappings = computed(() => {
  const raw = detail.value?.mappingSnapshot;
  if (!raw || raw === '[]') return '[]';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
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

async function copyToClipboard(text: string | undefined, label: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success(`${label}已复制`);
  } catch {
    window.$message?.error('复制失败');
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="960" display-directive="show" class="max-w-95%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSpin :show="loading">
        <template v-if="detail">
          <!-- 顶部状态栏 -->
          <div class="mb-16px flex items-center justify-between">
            <div class="flex items-center gap-12px">
              <NTag :type="statusCfg.type" size="medium" round>
                {{ statusCfg.label }}
              </NTag>
              <span class="text-12px op-50">{{ detail.triggerType || '-' }}</span>
              <span class="text-12px op-50">{{ durationText }}</span>
            </div>
            <NButton type="primary" size="small" ghost @click="loadDetail(true)">
              <template #icon>
                <span class="i-material-symbols:sync text-14px" />
              </template>
              同步状态
            </NButton>
          </div>

          <!-- 数据统计卡片 -->
          <div class="grid grid-cols-4 mb-16px gap-12px">
            <div class="stat-card">
              <NStatistic label="读取行数" tabular-nums>
                <template #default>
                  {{ detail.readRowCount ?? '-' }}
                </template>
              </NStatistic>
            </div>
            <div class="stat-card">
              <NStatistic label="写入行数" tabular-nums>
                <template #default>
                  {{ detail.writeRowCount ?? '-' }}
                </template>
              </NStatistic>
            </div>
            <div class="stat-card">
              <NStatistic label="对账状态" tabular-nums>
                <template #default>
                  <NTag :type="reconcileType" size="small">
                    {{
                      detail.readRowCount != null && detail.writeRowCount != null
                        ? detail.readRowCount === detail.writeRowCount
                          ? '一致'
                          : `差值 ${detail.readRowCount - detail.writeRowCount}`
                        : '-'
                    }}
                  </NTag>
                </template>
              </NStatistic>
            </div>
            <div class="stat-card">
              <NStatistic label="耗时" tabular-nums>
                <template #default>
                  {{ durationText }}
                </template>
              </NStatistic>
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="detail.errorMsg" class="error-banner mb-16px">
            <div class="flex items-start gap-8px">
              <span class="i-material-symbols:error-outline mt-2px text-16px text-[var(--error-color)]" />
              <div class="min-w-0 flex-1 text-13px leading-20px">{{ detail.errorMsg }}</div>
            </div>
          </div>

          <!-- 基本信息 -->
          <NDescriptions label-placement="left" :column="2" size="small" bordered class="mb-16px">
            <NDescriptionsItem label="作业ID">
              <span class="text-12px font-mono">{{ detail.jobId }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="引擎作业ID">
              <span class="text-12px font-mono">{{ detail.engineJobId || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="作业版本">{{ detail.jobVersion ?? '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="触发方式">{{ detail.triggerType || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="开始时间">
              <span class="text-12px font-mono">{{ detail.startTime || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="结束时间">
              <span class="text-12px font-mono">{{ detail.endTime || '-' }}</span>
            </NDescriptionsItem>
          </NDescriptions>

          <!-- 运行指标 -->
          <div class="code-panel mb-16px">
            <div class="code-panel-header">
              <span class="flex items-center gap-6px">
                <span class="i-material-symbols:monitoring text-14px op-60" />
                运行指标
              </span>
              <NTooltip>
                <template #trigger>
                  <NButton quaternary size="tiny" @click="copyToClipboard(detail.metricsJson, '运行指标')">
                    <template #icon>
                      <span class="i-material-symbols:content-copy-outline text-13px" />
                    </template>
                  </NButton>
                </template>
                复制
              </NTooltip>
            </div>
            <NScrollbar x-scrollable class="code-panel-body max-h-200px">
              <NCode :code="formattedMetrics" language="json" word-wrap />
            </NScrollbar>
          </div>

          <!-- 字段映射快照 -->
          <div class="code-panel mb-16px">
            <div class="code-panel-header">
              <span class="flex items-center gap-6px">
                <span class="i-material-symbols:swap-horiz text-14px op-60" />
                字段映射快照
              </span>
              <NTooltip>
                <template #trigger>
                  <NButton quaternary size="tiny" @click="copyToClipboard(detail.mappingSnapshot, '字段映射')">
                    <template #icon>
                      <span class="i-material-symbols:content-copy-outline text-13px" />
                    </template>
                  </NButton>
                </template>
                复制
              </NTooltip>
            </div>
            <NScrollbar x-scrollable class="code-panel-body max-h-220px">
              <NCode :code="formattedMappings" language="json" word-wrap />
            </NScrollbar>
          </div>

          <!-- 配置快照 -->
          <div class="code-panel">
            <div class="code-panel-header">
              <span class="flex items-center gap-6px">
                <span class="i-material-symbols:settings-outline text-14px op-60" />
                配置快照
              </span>
              <NTooltip>
                <template #trigger>
                  <NButton
                    quaternary
                    size="tiny"
                    @click="copyToClipboard(detail.configSnapshot || detail.jobConfig, '配置快照')"
                  >
                    <template #icon>
                      <span class="i-material-symbols:content-copy-outline text-13px" />
                    </template>
                  </NButton>
                </template>
                复制
              </NTooltip>
            </div>
            <NScrollbar x-scrollable class="code-panel-body max-h-280px">
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

<style scoped lang="scss">
.stat-card {
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid var(--n-border-color, #e5e7eb);
  background: var(--n-color, #fff);

  :deep(.n-statistic .n-statistic-value) {
    font-size: 20px;
  }

  :deep(.n-statistic .n-statistic__label) {
    font-size: 12px;
    opacity: 0.6;
  }
}

.error-banner {
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid var(--error-color, #cb2634);
  background: color-mix(in srgb, var(--error-color, #cb2634) 6%, transparent);
  color: var(--error-color, #cb2634);
}

.code-panel {
  border-radius: 6px;
  border: 1px solid var(--n-border-color, #e5e7eb);
  overflow: hidden;
}

.code-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--n-border-color, #e5e7eb);
  background: var(--n-action-color, #fafafa);
}

.code-panel-body {
  padding: 10px 14px;
  font-size: 12px;
  background: var(--n-color-embedded, #f8f8fa);
}

:deep(.n-code) {
  font-size: 12px !important;
}
</style>
