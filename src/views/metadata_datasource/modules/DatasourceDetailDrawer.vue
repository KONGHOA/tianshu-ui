<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NIcon, NSpin, NTabPane, NTabs, NTag } from 'naive-ui';
import { fetchGetDatasource, fetchRefreshDatasource, fetchTestConnectionById } from '@/service/api/metadata/datasource';
import { useAuth } from '@/hooks/business/auth';
import { getDatasourceIcon } from '@/utils/datasourceIcon';
import CatalogTab from './detail/CatalogTab.vue';
import OverviewTab from './detail/OverviewTab.vue';
import ProfilingTab from './detail/ProfilingTab.vue';
import SchemaChangeTab from './detail/SchemaChangeTab.vue';

defineOptions({ name: 'DatasourceDetailDrawer' });

interface Props {
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:datasourceId', val: null): void;
  (e: 'refresh'): void;
  (e: 'edit', id: CommonType.IdType): void;
}>();

const { hasAuth } = useAuth();

const visible = computed(() => props.datasourceId !== null);
const activeTab = ref('overview');
const detailLoading = ref(false);
const datasource = ref<Api.Metadata.Datasource | null>(null);

watch(
  () => props.datasourceId,
  async id => {
    datasource.value = null;
    if (!id) return;
    activeTab.value = 'overview';
    detailLoading.value = true;
    const { data } = await fetchGetDatasource(id);
    datasource.value = data ?? null;
    detailLoading.value = false;
  },
  { immediate: true }
);

function handleClose() {
  emit('update:datasourceId', null);
}

async function handleTestConnection() {
  if (!props.datasourceId) return;
  const { error, data } = await fetchTestConnectionById(props.datasourceId);
  if (!error && data === true) {
    window.$message?.success('连接成功');
  } else {
    window.$message?.error('连接失败');
  }
}

async function handleRefresh() {
  if (!props.datasourceId) return;
  const { error } = await fetchRefreshDatasource(props.datasourceId);
  if (!error) {
    window.$message?.success('元数据刷新成功');
    emit('refresh');
  }
}

function handleEdit() {
  if (!props.datasourceId) return;
  emit('edit', props.datasourceId);
  handleClose();
}

// getDbIcon 已移除，改用统一的 getDatasourceIcon() 渲染品牌图标

function getTypeTagType(type?: string): 'warning' | 'info' | 'success' | 'default' {
  if (type === 'mysql') return 'warning';
  if (type === 'hive') return 'info';
  if (type === 'clickhouse') return 'success';
  return 'default';
}
</script>

<template>
  <NDrawer :show="visible" :width="860" placement="right" :mask-closable="true" @update:show="v => !v && handleClose()">
    <NDrawerContent :native-scrollbar="false" body-content-class="p-0">
      <!-- 自定义 Header -->
      <template #header>
        <div class="w-full flex items-center justify-between gap-12px">
          <NSpin :show="detailLoading" :size="16" class="flex-1 overflow-hidden">
            <div class="min-h-28px flex items-center gap-12px">
              <div class="h-34px w-34px flex-center flex-shrink-0 rounded-8px bg-gray-50 dark:bg-gray-800">
                <img
                  :src="getDatasourceIcon(datasource?.datasourceType)"
                  :alt="datasource?.datasourceType"
                  class="h-22px w-22px object-contain"
                />
              </div>
              <div class="flex flex-col overflow-hidden leading-snug">
                <span class="truncate text-14px text-gray-900 font-semibold dark:text-gray-100">
                  {{ datasource?.datasourceName || '加载中...' }}
                </span>
                <span class="text-11px text-gray-400">ID: {{ props.datasourceId }}</span>
              </div>
              <NTag
                v-if="datasource?.datasourceType"
                :type="getTypeTagType(datasource.datasourceType)"
                size="small"
                :bordered="false"
                class="ml-2px flex-shrink-0"
              >
                {{ datasource.datasourceType.toUpperCase() }}
              </NTag>
              <NTag
                v-if="datasource?.status"
                :type="datasource.status === '0' ? 'success' : 'error'"
                size="small"
                :bordered="false"
                class="flex-shrink-0"
              >
                {{ datasource.status === '0' ? '运行中' : '已停用' }}
              </NTag>
            </div>
          </NSpin>
          <!-- 操作按钮区 -->
          <div class="flex flex-shrink-0 items-center gap-8px">
            <NButton v-if="hasAuth('metadata:datasource:query')" size="small" secondary @click="handleTestConnection">
              <template #icon>
                <NIcon><div class="i-mdi-connection" /></NIcon>
              </template>
              测试连接
            </NButton>
            <NButton v-if="hasAuth('metadata:datasource:edit')" size="small" secondary @click="handleRefresh">
              <template #icon>
                <NIcon><div class="i-mdi-refresh" /></NIcon>
              </template>
              刷新元数据
            </NButton>
            <NButton v-if="hasAuth('metadata:datasource:edit')" size="small" type="primary" @click="handleEdit">
              <template #icon>
                <NIcon><div class="i-mdi-pencil-outline" /></NIcon>
              </template>
              编辑
            </NButton>
          </div>
        </div>
      </template>

      <!-- Tab 导航 + 内容 -->
      <div class="h-full flex flex-col px-20px pb-20px">
        <NTabs
          v-model:value="activeTab"
          type="line"
          animated
          :tab-style="{ padding: '12px 4px' }"
          pane-wrapper-class="mt-16px flex-1 overflow-y-auto"
        >
          <NTabPane name="overview" tab="概览">
            <OverviewTab :datasource="datasource" :datasource-id="props.datasourceId" />
          </NTabPane>

          <NTabPane name="catalog" tab="数据目录">
            <CatalogTab v-if="activeTab === 'catalog'" :datasource-id="props.datasourceId" />
          </NTabPane>

          <NTabPane name="schemaChange" tab="架构变更">
            <SchemaChangeTab v-if="activeTab === 'schemaChange'" :datasource-id="props.datasourceId" />
          </NTabPane>

          <NTabPane name="profiling" tab="数据质量">
            <ProfilingTab v-if="activeTab === 'profiling'" :datasource-id="props.datasourceId" />
          </NTabPane>
        </NTabs>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
