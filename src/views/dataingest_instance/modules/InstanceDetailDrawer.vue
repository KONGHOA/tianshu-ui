<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NCard,
  NCode,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NGrid,
  NGridItem,
  NScrollbar,
  NSpace,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
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

type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';

const STATUS_MAP: Record<string, { label: string; type: TagType; icon: string; color: string }> = {
  SUCCEED: {
    label: '成功',
    type: 'success',
    icon: 'i-material-symbols:check-circle-outline-rounded',
    color: 'text-success'
  },
  FAILED: { label: '失败', type: 'error', icon: 'i-material-symbols:error-outline-rounded', color: 'text-error' },
  RUNNING: {
    label: '运行中',
    type: 'info',
    icon: 'i-material-symbols:motion-photos-on-outline-rounded',
    color: 'text-primary'
  },
  SUBMITTED: {
    label: '已提交',
    type: 'info',
    icon: 'i-material-symbols:send-time-extension-outline-rounded',
    color: 'text-primary'
  },
  PAUSED: {
    label: '已暂停',
    type: 'warning',
    icon: 'i-material-symbols:pause-circle-outline-rounded',
    color: 'text-warning'
  },
  CANCELLED: {
    label: '已取消',
    type: 'default',
    icon: 'i-material-symbols:cancel-outline-rounded',
    color: 'text-gray-400'
  },
  UNKNOWN: { label: '未知', type: 'default', icon: 'i-material-symbols:help-outline-rounded', color: 'text-gray-400' }
};

const statusCfg = computed(() => STATUS_MAP[detail.value?.jobStatus ?? ''] ?? STATUS_MAP.UNKNOWN);

const durationText = computed(() => {
  const start = detail.value?.startTime;
  const end = detail.value?.endTime;
  if (!start) return '-';
  const endTime = end ? new Date(end).getTime() : Date.now();
  const ms = endTime - new Date(start).getTime();
  if (ms < 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
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

const reconcileInfo = computed(() => {
  const read = detail.value?.readRowCount ?? 0;
  const write = detail.value?.writeRowCount ?? 0;
  const diff = read - write;
  if (read === 0 && write === 0 && (detail.value?.jobStatus === 'SUBMITTED' || detail.value?.jobStatus === 'RUNNING')) {
    return { label: '等待运行...', type: 'default' as TagType, diff: 0 };
  }
  if (read === 0 && write === 0) return { label: '无数据', type: 'default' as TagType, diff: 0 };
  return {
    label: diff === 0 ? '完全一致' : `差异 ${Math.abs(diff)}`,
    type: (diff === 0 ? 'success' : 'warning') as TagType,
    diff
  };
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
  <NDrawer v-model:show="visible" :width="1000" display-directive="show" class="max-w-95%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSpin :show="loading">
        <template v-if="detail">
          <div class="flex flex-col gap-24px pb-24px">
            <!-- 顶部状态栏 -->
            <div
              class="flex items-center justify-between border border-gray-100 rounded-16px bg-gray-50/50 p-16px dark:border-white/10 dark:bg-white/5"
            >
              <div class="flex items-center gap-16px">
                <div
                  class="h-48px w-48px flex-center border border-gray-100 rounded-full bg-white shadow-sm dark:border-white/10 dark:bg-dark-300"
                >
                  <span
                    class="text-24px"
                    :class="[statusCfg.icon, statusCfg.color, { 'animate-spin': detail.jobStatus === 'RUNNING' }]"
                  />
                </div>
                <div>
                  <div class="flex items-center gap-8px">
                    <span class="text-18px font-bold">{{ statusCfg.label }}</span>
                    <NTag :type="statusCfg.type" size="tiny" round tertiary>{{ detail.triggerType || 'Manual' }}</NTag>
                  </div>
                  <div class="mt-2px text-12px font-mono op-50">Instance ID: {{ detail.instanceId }}</div>
                </div>
              </div>
              <NSpace>
                <NButton type="primary" secondary round @click="loadDetail(true)">
                  <template #icon>
                    <span class="i-material-symbols:sync" />
                  </template>
                  同步状态
                </NButton>
              </NSpace>
            </div>

            <!-- 数据统计 -->
            <NGrid :cols="4" :x-gap="16">
              <NGridItem>
                <div class="stat-card-modern border-blue-200 bg-blue-50/30 dark:border-blue-500/30 dark:bg-blue-500/5">
                  <div class="stat-icon bg-blue-500/10 text-blue-600">
                    <span class="i-material-symbols:download-rounded" />
                  </div>
                  <NStatistic label="读取行数">
                    <span class="text-22px text-blue-700 font-bold tabular-nums dark:text-blue-400">
                      {{ detail.readRowCount ?? 0 }}
                    </span>
                  </NStatistic>
                </div>
              </NGridItem>
              <NGridItem>
                <div
                  class="stat-card-modern border-green-200 bg-green-50/30 dark:border-green-500/30 dark:bg-green-500/5"
                >
                  <div class="stat-icon bg-green-500/10 text-green-600">
                    <span class="i-material-symbols:upload-rounded" />
                  </div>
                  <NStatistic label="写入行数">
                    <span class="text-22px text-green-700 font-bold tabular-nums dark:text-green-400">
                      {{ detail.writeRowCount ?? 0 }}
                    </span>
                  </NStatistic>
                </div>
              </NGridItem>
              <NGridItem>
                <div
                  class="stat-card-modern"
                  :class="
                    reconcileInfo.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-500/30 dark:bg-emerald-500/5'
                      : 'border-amber-200 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-500/5'
                  "
                >
                  <div
                    class="stat-icon"
                    :class="
                      reconcileInfo.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    "
                  >
                    <span class="i-material-symbols:balance-rounded" />
                  </div>
                  <NStatistic label="对账状态">
                    <span
                      class="text-22px font-bold"
                      :class="
                        reconcileInfo.type === 'success'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      "
                    >
                      {{ reconcileInfo.label }}
                    </span>
                  </NStatistic>
                </div>
              </NGridItem>
              <NGridItem>
                <div
                  class="stat-card-modern border-indigo-200 bg-indigo-50/30 dark:border-indigo-500/30 dark:bg-indigo-500/5"
                >
                  <div class="stat-icon bg-indigo-500/10 text-indigo-600">
                    <span class="i-material-symbols:schedule-outline-rounded" />
                  </div>
                  <NStatistic label="总耗时">
                    <span class="text-22px text-indigo-700 font-bold tabular-nums dark:text-indigo-400">
                      {{ durationText }}
                    </span>
                  </NStatistic>
                </div>
              </NGridItem>
            </NGrid>

            <!-- 错误信息 -->
            <NCard
              v-if="detail.errorMsg"
              size="small"
              :bordered="false"
              class="border-l-4 border-red-500 bg-red-50 dark:bg-red-500/5"
            >
              <div class="flex items-start gap-12px">
                <span class="i-material-symbols:error-rounded mt-2px text-20px text-red-500" />
                <div class="flex-1">
                  <div class="mb-4px text-red-700 font-bold dark:text-red-400">执行错误信息</div>
                  <div class="text-13px text-red-600 leading-relaxed dark:text-red-300/80">{{ detail.errorMsg }}</div>
                </div>
                <NButton quaternary circle size="small" @click="copyToClipboard(detail.errorMsg, '错误信息')">
                  <template #icon><span class="i-material-symbols:content-copy-outline" /></template>
                </NButton>
              </div>
            </NCard>

            <!-- 基本信息 -->
            <NCard title="基本详情" :bordered="false" size="small" class="rounded-16px bg-gray-50/50 dark:bg-white/5">
              <NDescriptions label-placement="left" :column="3" size="small" label-class="op-60">
                <NDescriptionsItem label="作业 ID">
                  <span class="text-13px font-mono">{{ detail.jobId }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem label="引擎作业 ID">
                  <span class="text-13px font-mono">{{ detail.engineJobId || '-' }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem label="作业版本">
                  <NTag size="small" quaternary round type="info">{{ detail.jobVersion ?? '1.0' }}</NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="开始时间">
                  <span class="font-mono op-80">{{ detail.startTime || '-' }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem label="结束时间">
                  <span class="font-mono op-80">{{ detail.endTime || '-' }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem label="创建人员">
                  <span class="flex items-center gap-4px">
                    <span class="i-material-symbols:person-outline text-14px op-60" />
                    {{ detail.createBy || 'System' }}
                  </span>
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>

            <NCard
              title="增量执行信息"
              :bordered="false"
              size="small"
              class="rounded-16px bg-gray-50/50 dark:bg-white/5"
            >
              <NDescriptions label-placement="left" :column="3" size="small" label-class="op-60">
                <NDescriptionsItem label="执行模式">
                  <NTag :type="detail.incremental ? 'info' : 'default'" size="small" round quaternary>
                    {{ detail.incremental ? '增量' : '全量' }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem label="增量列">
                  <span class="text-13px font-mono">
                    {{ detail.incremental ? detail.incrementalColumn || '未配置' : '-' }}
                  </span>
                </NDescriptionsItem>
                <NDescriptionsItem label="本次水位区间">
                  <span class="text-13px font-mono">
                    {{ detail.incremental ? detail.incrementalRangeText || '未记录' : '-' }}
                  </span>
                </NDescriptionsItem>
                <NDescriptionsItem label="起始水位">
                  <span class="text-13px font-mono">
                    {{ detail.incremental ? detail.incrementalStartValue || '未记录' : '-' }}
                  </span>
                </NDescriptionsItem>
                <NDescriptionsItem label="结束水位">
                  <span class="text-13px font-mono">
                    {{ detail.incremental ? detail.incrementalUpperBound || '未记录' : '-' }}
                  </span>
                </NDescriptionsItem>
                <NDescriptionsItem label="水位状态">
                  <NTag :type="detail.incrementalUpperBound ? 'success' : 'default'" size="small" round quaternary>
                    {{
                      detail.incremental ? (detail.incrementalUpperBound ? '区间已记录' : '区间未记录') : '非增量实例'
                    }}
                  </NTag>
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>

            <!-- 配置与快照 -->
            <div class="border border-gray-100 rounded-16px bg-gray-50/50 p-16px dark:border-white/10 dark:bg-white/5">
              <NTabs type="segment" animated>
                <NTabPane name="metrics" tab="运行指标">
                  <template #tab>
                    <div class="flex items-center gap-6px px-8px">
                      <span class="i-material-symbols:monitoring" />
                      运行指标
                    </div>
                  </template>
                  <div class="group relative mt-12px">
                    <NScrollbar class="code-viewer max-h-400px rounded-12px p-16px shadow-inner">
                      <NCode :code="formattedMetrics" language="json" word-wrap />
                    </NScrollbar>
                    <div class="absolute right-12px top-12px opacity-0 transition-opacity group-hover:opacity-100">
                      <NButton secondary strong size="small" @click="copyToClipboard(detail.metricsJson, '运行指标')">
                        <template #icon><span class="i-material-symbols:content-copy-outline" /></template>
                        复制 JSON
                      </NButton>
                    </div>
                  </div>
                </NTabPane>
                <NTabPane name="mapping" tab="字段映射">
                  <template #tab>
                    <div class="flex items-center gap-6px px-8px">
                      <span class="i-material-symbols:swap-horiz" />
                      字段映射
                    </div>
                  </template>
                  <div class="group relative mt-12px">
                    <NScrollbar class="code-viewer max-h-400px rounded-12px p-16px shadow-inner">
                      <NCode :code="formattedMappings" language="json" word-wrap />
                    </NScrollbar>
                    <div class="absolute right-12px top-12px opacity-0 transition-opacity group-hover:opacity-100">
                      <NButton
                        secondary
                        strong
                        size="small"
                        @click="copyToClipboard(detail.mappingSnapshot, '字段映射')"
                      >
                        <template #icon><span class="i-material-symbols:content-copy-outline" /></template>
                        复制 JSON
                      </NButton>
                    </div>
                  </div>
                </NTabPane>
                <NTabPane name="config" tab="配置快照">
                  <template #tab>
                    <div class="flex items-center gap-6px px-8px">
                      <span class="i-material-symbols:settings-outline" />
                      配置快照
                    </div>
                  </template>
                  <div class="group relative mt-12px">
                    <NScrollbar class="code-viewer max-h-400px rounded-12px p-16px shadow-inner">
                      <NCode :code="detail.configSnapshot || detail.jobConfig || ''" language="hocon" word-wrap />
                    </NScrollbar>
                    <div class="absolute right-12px top-12px opacity-0 transition-opacity group-hover:opacity-100">
                      <NButton
                        secondary
                        strong
                        size="small"
                        @click="copyToClipboard(detail.configSnapshot || detail.jobConfig, '配置快照')"
                      >
                        <template #icon><span class="i-material-symbols:content-copy-outline" /></template>
                        复制配置
                      </NButton>
                    </div>
                  </div>
                </NTabPane>
              </NTabs>
            </div>
          </div>
        </template>

        <NEmpty v-else description="未找到实例详情" class="py-100px">
          <template #icon>
            <span class="i-material-symbols:search-off-rounded text-64px op-20" />
          </template>
          <template #extra>
            <NButton @click="loadDetail()">重试加载</NButton>
          </template>
        </NEmpty>
      </NSpin>

      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton round @click="visible = false">关闭窗口</NButton>
          <NButton type="primary" round @click="loadDetail(true)">
            <template #icon><span class="i-material-symbols:refresh-rounded" /></template>
            刷新数据
          </NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.stat-card-modern {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    font-size: 22px;
  }

  :deep(.n-statistic) {
    .n-statistic-value {
      line-height: 1.2;
    }
    .n-statistic__label {
      font-size: 12px;
      margin-bottom: 2px;
      opacity: 0.7;
    }
  }
}

:deep(.n-tabs) {
  .n-tabs-rail {
    padding: 4px;
    border-radius: 10px;
  }
  .n-tabs-tab {
    border-radius: 8px;
    transition: all 0.2s;
  }
}

.code-viewer {
  background: var(--n-color-embedded, #f5f5f7);
  border: 1px solid var(--n-border-color, #e5e7eb);
}

:deep(.n-code) {
  font-family: 'Fira Code', 'JetBrains Mono', 'Source Code Pro', monospace;
  font-size: 13px !important;
}

.animate-spin {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
