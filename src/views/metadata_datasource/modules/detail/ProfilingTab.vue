<script setup lang="ts">
import { h, onMounted, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NGrid, NGridItem, NIcon, NSelect, NSpin, NTag, NText } from 'naive-ui';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import { fetchGetDatabases, fetchGetTables } from '@/service/api/metadata/catalog';
import { fetchGetAllProfiles } from '@/service/api/metadata/profile';

interface Props {
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

// 级联选择状态
const dbOptions = ref<SelectOption[]>([]);
const tableOptions = ref<SelectOption[]>([]);
const selectedDbUuid = ref<string | null>(null);
const selectedTableUuid = ref<string | null>(null);

// 数据加载状态
const dbLoading = ref(false);
const tableLoading = ref(false);
const profileLoading = ref(false);

// Profile 数据
const profiles = ref<Api.Metadata.EntityProfile[]>([]);
const queried = ref(false);

async function loadDatabases() {
  if (!props.datasourceId) return;
  dbLoading.value = true;
  const { data, error } = await fetchGetDatabases(props.datasourceId);
  if (!error && data) {
    dbOptions.value = data.map(db => ({
      label: db.displayName || db.fullyQualifiedName,
      value: db.uuid
    }));
  }
  dbLoading.value = false;
}

async function handleDbChange(uuid: string | null) {
  selectedDbUuid.value = uuid;
  selectedTableUuid.value = null;
  tableOptions.value = [];
  profiles.value = [];
  queried.value = false;
  if (!uuid) return;
  tableLoading.value = true;
  const { data, error } = await fetchGetTables(uuid);
  if (!error && data) {
    tableOptions.value = data.map(t => ({
      label: t.displayName || t.fullyQualifiedName,
      value: t.uuid
    }));
  }
  tableLoading.value = false;
}

async function handleQuery() {
  if (!selectedTableUuid.value) {
    window.$message?.warning('请先选择数据表');
    return;
  }
  profileLoading.value = true;
  queried.value = true;
  const { data, error } = await fetchGetAllProfiles(selectedTableUuid.value);
  if (!error) profiles.value = data ?? [];
  profileLoading.value = false;
}

watch(
  () => props.datasourceId,
  () => {
    dbOptions.value = [];
    tableOptions.value = [];
    selectedDbUuid.value = null;
    selectedTableUuid.value = null;
    profiles.value = [];
    queried.value = false;
    loadDatabases();
  }
);

onMounted(loadDatabases);

function getValueTypeTag(valueType: string): 'info' | 'success' | 'warning' | 'default' {
  if (valueType === 'long' || valueType === 'double') return 'info';
  if (valueType === 'percentage') return 'success';
  if (valueType === 'string') return 'warning';
  return 'default';
}

const columns: DataTableColumns<Api.Metadata.EntityProfile> = [
  {
    title: '指标名称',
    key: 'metricName',
    width: 180,
    render: row => h('span', { class: 'font-medium text-gray-700 dark:text-gray-200' }, row.metricName)
  },
  {
    title: '指标值',
    key: 'actualValue',
    width: 140,
    render: row => h('span', { class: 'text-gray-800 font-mono dark:text-gray-100' }, row.actualValue ?? '-')
  },
  {
    title: '值类型',
    key: 'actualValueType',
    width: 100,
    render: row =>
      h(
        NTag,
        { size: 'small', type: getValueTypeTag(row.actualValueType), bordered: false },
        { default: () => row.actualValueType || '-' }
      )
  },
  {
    title: '统计日期',
    key: 'dataDate',
    width: 130,
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.dataDate || '-' })
  },
  {
    title: '记录时间',
    key: 'createTime',
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.createTime || '-' })
  }
];
</script>

<template>
  <div class="flex flex-col gap-16px">
    <!-- 选择器区域 -->
    <div class="border border-gray-100 rounded-10px bg-gray-50/50 p-16px dark:border-gray-800 dark:bg-[#202024]/50">
      <div class="mb-12px flex items-center gap-6px text-13px text-gray-600 font-medium dark:text-gray-300">
        <NIcon size="14" class="text-violet-500"><div class="i-mdi-filter-outline" /></NIcon>
        选择分析对象
      </div>
      <NGrid :x-gap="12" :cols="3">
        <NGridItem>
          <NSelect
            v-model:value="selectedDbUuid"
            :options="dbOptions"
            :loading="dbLoading"
            placeholder="选择数据库"
            clearable
            size="small"
            @update:value="handleDbChange"
          />
        </NGridItem>
        <NGridItem>
          <NSelect
            v-model:value="selectedTableUuid"
            :options="tableOptions"
            :loading="tableLoading"
            :disabled="!selectedDbUuid"
            placeholder="选择数据表"
            clearable
            filterable
            size="small"
          />
        </NGridItem>
        <NGridItem>
          <NButton
            type="primary"
            size="small"
            :disabled="!selectedTableUuid"
            :loading="profileLoading"
            class="w-full"
            @click="handleQuery"
          >
            <template #icon>
              <NIcon><div class="i-mdi-chart-bar" /></NIcon>
            </template>
            查询质量指标
          </NButton>
        </NGridItem>
      </NGrid>
    </div>

    <!-- Profile 数据区域 -->
    <NSpin :show="profileLoading" class="min-h-160px">
      <NEmpty v-if="!queried" description="请选择数据库和数据表后查询质量指标" class="py-60px">
        <template #icon>
          <NIcon size="48" class="text-gray-300"><div class="i-mdi-chart-bar-stacked" /></NIcon>
        </template>
      </NEmpty>
      <NEmpty
        v-else-if="!profileLoading && profiles.length === 0"
        description="该表暂无质量指标数据，刷新数据源后生成"
        class="py-60px"
      />
      <NDataTable v-else :data="profiles" :columns="columns" :bordered="false" size="small" striped />
    </NSpin>
  </div>
</template>
