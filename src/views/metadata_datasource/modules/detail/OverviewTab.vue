<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NDescriptions, NDescriptionsItem, NGrid, NGridItem, NIcon, NSkeleton, NTag } from 'naive-ui';
import { fetchGetDatasourceSummary } from '@/service/api/metadata/datasource';

interface Props {
  datasource: Api.Metadata.Datasource | null;
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

const summaryLoading = ref(false);
const summary = ref<Api.Metadata.DatasourceSummary | null>(null);

async function loadSummary() {
  if (!props.datasourceId) return;
  summaryLoading.value = true;
  const { data, error } = await fetchGetDatasourceSummary(props.datasourceId);
  if (!error) summary.value = data ?? null;
  summaryLoading.value = false;
}

onMounted(loadSummary);

const connParam = computed<Api.Metadata.ConnParam | null>(() => {
  if (!props.datasource?.connParams) return null;
  try {
    return JSON.parse(props.datasource.connParams);
  } catch {
    return null;
  }
});

const maskedPassword = computed(() => (connParam.value?.password ? '••••••••' : '-'));

const statCards = computed(() => [
  {
    label: '数据库',
    value: summary.value?.databaseCount ?? '-',
    unit: '个',
    icon: 'i-mdi-database-outline',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20'
  },
  {
    label: '数据表',
    value: summary.value?.tableCount ?? '-',
    unit: '张',
    icon: 'i-mdi-table',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-900/20'
  },
  {
    label: '字段',
    value: summary.value?.columnCount ?? '-',
    unit: '个',
    icon: 'i-mdi-table-column',
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-900/20'
  },
  {
    label: '近7天变更',
    value: summary.value?.recentChangeCount ?? '-',
    unit: '次',
    icon: 'i-mdi-history',
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20'
  }
]);

function getStatusType(status?: string) {
  if (status === '1') return 'success';
  if (status === '2') return 'error';
  return 'default';
}

function getStatusLabel(status?: string) {
  if (status === '1') return '在线';
  if (status === '2') return '离线';
  return '未检测';
}
</script>

<template>
  <div class="flex flex-col gap-20px">
    <!-- 摘要统计卡片 -->
    <NGrid :x-gap="12" :y-gap="12" :cols="4">
      <NGridItem v-for="card in statCards" :key="card.label">
        <div class="flex items-center gap-12px border border-gray-100 rounded-10px p-14px dark:border-gray-800">
          <div class="h-40px w-40px flex-center flex-shrink-0 rounded-8px" :class="[card.bg, card.color]">
            <NIcon size="20"><div :class="card.icon" /></NIcon>
          </div>
          <div class="flex flex-col">
            <span class="text-11px text-gray-400">{{ card.label }}</span>
            <NSkeleton v-if="summaryLoading" text :width="48" :height="20" />
            <div v-else class="flex items-baseline gap-3px">
              <span class="text-20px text-gray-800 font-bold dark:text-gray-100">{{ card.value }}</span>
              <span class="text-11px text-gray-400">{{ card.unit }}</span>
            </div>
          </div>
        </div>
      </NGridItem>
    </NGrid>

    <!-- 最近同步时间 -->
    <div
      v-if="summary?.lastSyncTime"
      class="flex items-center gap-8px rounded-8px bg-gray-50 px-12px py-8px text-12px text-gray-500 dark:bg-[#202024]"
    >
      <NIcon size="14" class="flex-shrink-0"><div class="i-mdi-clock-outline" /></NIcon>
      最近同步：{{ summary.lastSyncTime }}
    </div>

    <!-- 连接信息 + 元数据信息 -->
    <NGrid :x-gap="16" :cols="2">
      <NGridItem>
        <div class="border border-gray-100 rounded-10px p-16px dark:border-gray-800">
          <div class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-medium dark:text-gray-200">
            <NIcon size="15" class="text-blue-500"><div class="i-mdi-server-network" /></NIcon>
            连接信息
          </div>
          <NDescriptions :column="1" label-placement="left" :label-style="{ width: '72px', color: '#9ca3af' }">
            <NDescriptionsItem label="类型">
              <NTag size="small" :bordered="false">{{ datasource?.datasourceType?.toUpperCase() }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="主机">{{ connParam?.host || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="端口">{{ connParam?.port || '-' }}</NDescriptionsItem>
            <NDescriptionsItem v-if="connParam?.database" label="数据库">
              {{ connParam.database }}
            </NDescriptionsItem>
            <NDescriptionsItem label="用户名">{{ connParam?.username || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="密码">{{ maskedPassword }}</NDescriptionsItem>
          </NDescriptions>
        </div>
      </NGridItem>

      <NGridItem>
        <div class="border border-gray-100 rounded-10px p-16px dark:border-gray-800">
          <div class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-medium dark:text-gray-200">
            <NIcon size="15" class="text-violet-500"><div class="i-mdi-information-outline" /></NIcon>
            元数据信息
          </div>
          <NDescriptions :column="1" label-placement="left" :label-style="{ width: '72px', color: '#9ca3af' }">
            <NDescriptionsItem label="状态">
              <NTag size="small" :type="getStatusType(datasource?.status)" :bordered="false">
                {{ getStatusLabel(datasource?.status) }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="备注">{{ datasource?.remark || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ datasource?.createTime || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ datasource?.updateTime || '-' }}</NDescriptionsItem>
          </NDescriptions>
        </div>
      </NGridItem>
    </NGrid>
  </div>
</template>
