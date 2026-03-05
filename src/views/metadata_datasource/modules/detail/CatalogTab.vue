<script setup lang="ts">
import { h, onMounted, ref, watch } from 'vue';
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NEmpty,
  NIcon,
  NInput,
  NModal,
  NSpin,
  NTag,
  NText
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchGetColumns, fetchGetDatabases, fetchGetTables } from '@/service/api/metadata/catalog';

interface Props {
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

type TableEntry = Api.Metadata.EntityInstance;
type ColumnEntry = Api.Metadata.EntityInstance;

// 数据库列表
const dbLoading = ref(false);
const databases = ref<Api.Metadata.EntityInstance[]>([]);

// 每个数据库对应的表（按 uuid 索引）
const tableMap = ref<Record<string, { loading: boolean; data: TableEntry[] }>>({});
const expandedNames = ref<string[]>([]);

// 列弹窗
const columnModalVisible = ref(false);
const columnModalTitle = ref('');
const columnLoading = ref(false);
const columnData = ref<ColumnEntry[]>([]);

// 表名搜索（作用于所有已展开数据库的表）
const tableSearch = ref('');

async function loadDatabases() {
  if (!props.datasourceId) return;
  dbLoading.value = true;
  databases.value = [];
  const { data, error } = await fetchGetDatabases(props.datasourceId);
  if (!error) databases.value = data ?? [];
  dbLoading.value = false;
}

async function loadTables(dbUuid: string) {
  if (tableMap.value[dbUuid]) return; // 已加载，跳过
  tableMap.value[dbUuid] = { loading: true, data: [] };
  const { data, error } = await fetchGetTables(dbUuid);
  tableMap.value[dbUuid] = { loading: false, data: error ? [] : (data ?? []) };
}

watch(expandedNames, (next, prev) => {
  next.filter(n => !prev.includes(n)).forEach(uuid => loadTables(uuid));
});

// 重置：数据源切换时清空
watch(
  () => props.datasourceId,
  () => {
    databases.value = [];
    tableMap.value = {};
    expandedNames.value = [];
    tableSearch.value = '';
    loadDatabases();
  }
);

onMounted(loadDatabases);

function filteredTables(dbUuid: string): TableEntry[] {
  const tables = tableMap.value[dbUuid]?.data ?? [];
  const q = tableSearch.value.trim().toLowerCase();
  if (!q) return tables;
  return tables.filter(
    t => t.displayName?.toLowerCase().includes(q) || t.fullyQualifiedName?.toLowerCase().includes(q)
  );
}

async function handleViewColumns(table: TableEntry) {
  columnModalTitle.value = `${table.displayName || table.fullyQualifiedName} · 字段列表`;
  columnModalVisible.value = true;
  columnLoading.value = true;
  columnData.value = [];
  const { data, error } = await fetchGetColumns(table.uuid);
  if (!error) columnData.value = data ?? [];
  columnLoading.value = false;
}

const tableColumns: DataTableColumns<TableEntry> = [
  {
    title: '表名',
    key: 'displayName',
    width: 180,
    ellipsis: { tooltip: true },
    render: row =>
      h('span', { class: 'font-medium text-gray-800 dark:text-gray-100' }, row.displayName || row.fullyQualifiedName)
  },
  {
    title: '全限定名',
    key: 'fullyQualifiedName',
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.fullyQualifiedName })
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.description || '-' })
  },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: row =>
      h(
        NButton,
        { size: 'tiny', secondary: true, onClick: () => handleViewColumns(row) },
        { default: () => '查看字段' }
      )
  }
];

const columnTableColumns: DataTableColumns<ColumnEntry> = [
  {
    title: '字段名',
    key: 'displayName',
    width: 160,
    render: row => h('span', { class: 'font-medium' }, row.displayName || row.fullyQualifiedName)
  },
  {
    title: '全限定名',
    key: 'fullyQualifiedName',
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.fullyQualifiedName })
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.description || '-' })
  },
  {
    title: '状态',
    key: 'status',
    width: 72,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.status === 'active' ? 'success' : 'error', bordered: false },
        { default: () => (row.status === 'active' ? '正常' : '已删除') }
      )
  }
];
</script>

<template>
  <div class="flex flex-col gap-12px">
    <!-- 搜索框 -->
    <NInput v-model:value="tableSearch" placeholder="搜索表名..." clearable size="small" class="w-260px">
      <template #prefix>
        <NIcon size="14" class="text-gray-400"><div class="i-mdi-magnify" /></NIcon>
      </template>
    </NInput>

    <!-- 数据库列表 -->
    <div class="max-h-[560px] overflow-y-auto border border-gray-100 rounded-8px dark:border-gray-800">
      <NSpin :show="dbLoading" class="min-h-120px">
        <NEmpty v-if="!dbLoading && databases.length === 0" description="暂无数据库，请先刷新数据源" class="py-40px" />

        <NCollapse v-else v-model:expanded-names="expandedNames" accordion class="p-4px">
          <NCollapseItem v-for="db in databases" :key="db.uuid" :name="db.uuid">
            <template #header>
              <div class="flex items-center gap-8px">
                <NIcon size="16" class="flex-shrink-0 text-blue-500">
                  <div class="i-mdi-database-outline" />
                </NIcon>
                <span class="text-13px font-medium">{{ db.displayName || db.fullyQualifiedName }}</span>
                <NTag v-if="tableMap[db.uuid]?.data.length" size="tiny" :bordered="false" class="ml-4px">
                  {{ tableMap[db.uuid].data.length }} 张表
                </NTag>
              </div>
            </template>

            <div class="px-4px py-8px">
              <NSpin :show="tableMap[db.uuid]?.loading" class="min-h-60px">
                <NEmpty
                  v-if="!tableMap[db.uuid]?.loading && filteredTables(db.uuid).length === 0"
                  :description="tableSearch ? '无匹配结果' : '暂无表数据'"
                  size="small"
                  class="py-20px"
                />
                <NDataTable
                  v-else
                  :data="filteredTables(db.uuid)"
                  :columns="tableColumns"
                  :bordered="false"
                  size="small"
                  :pagination="filteredTables(db.uuid).length > 10 ? { pageSize: 10, simple: true } : false"
                  row-class-name="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                />
              </NSpin>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NSpin>
    </div>

    <!-- 字段列表弹窗 -->
    <NModal
      v-model:show="columnModalVisible"
      :title="columnModalTitle"
      preset="card"
      class="w-680px"
      :mask-closable="true"
    >
      <NSpin :show="columnLoading" class="min-h-100px">
        <NEmpty v-if="!columnLoading && columnData.length === 0" description="暂无字段信息" class="py-30px" />
        <NDataTable
          v-else
          :data="columnData"
          :columns="columnTableColumns"
          :bordered="false"
          size="small"
          :max-height="400"
        />
      </NSpin>
    </NModal>
  </div>
</template>
