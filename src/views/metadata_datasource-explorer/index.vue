<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NBreadcrumb,
  NBreadcrumbItem,
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NIcon,
  NInput,
  NSkeleton,
  NSpin,
  NTabPane,
  NTabs,
  NTag
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchGetDatasource,
  fetchGetDatasourceSummary,
  fetchRefreshDatasource
} from '@/service/api/metadata/datasource';
import { fetchGetColumns, fetchGetDatabases, fetchGetTables } from '@/service/api/metadata/catalog';
import { fetchGetAllProfiles, fetchTriggerTableProfile } from '@/service/api/metadata/profile';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';
import { useAuth } from '@/hooks/business/auth';

defineOptions({ name: 'MetadataDatasourceExplorer' });

const route = useRoute();
const router = useRouter();
const { hasAuth } = useAuth();

// ─── 当前层级（由 query 参数驱动） ───────────────────────────────
const datasourceId = computed(() => route.query.datasourceId as string | undefined);
const dbUuid = computed(() => route.query.dbUuid as string | undefined);
const dbName = computed(() => route.query.dbName as string | undefined);
const tableUuid = computed(() => route.query.tableUuid as string | undefined);
const tableName = computed(() => route.query.tableName as string | undefined);

const level = computed<'datasource' | 'database' | 'table'>(() => {
  if (tableUuid.value) return 'table';
  if (dbUuid.value) return 'database';
  return 'datasource';
});

// ─── 数据 ─────────────────────────────────────────────────────
const datasource = ref<Api.Metadata.Datasource | null>(null);
const summary = ref<Api.Metadata.DatasourceSummary | null>(null);
const databases = ref<Api.Metadata.EntityInstance[]>([]);
const tables = ref<Api.Metadata.EntityInstance[]>([]);
const columns = ref<Api.Metadata.EntityInstance[]>([]);
const schemaChanges = ref<Api.Metadata.SchemaChange[]>([]);
const dbChanges = ref<Api.Metadata.SchemaChange[]>([]);

const datasourceLoading = ref(false);
const listLoading = ref(false);
const refreshing = ref(false);

const dbSearch = ref('');
const tableSearch = ref('');
const activeTab = ref('columns');
const dbActiveTab = ref('tables');

// ─── 数据概览 ─────────────────────────────────────────────────
const profileLoading = ref(false);
const triggerLoading = ref(false);
/** 表级 profile 结果, metricName -> value */
const tableProfileMap = ref<Record<string, string>>({});
/** 列级 profile 结果, columnUuid -> (metricName -> value) */
const columnProfileMap = ref<Record<string, Record<string, string>>>({});

// ─── 工具函数 ─────────────────────────────────────────────────
function parseProps(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function getDbTypeIcon(type?: string) {
  const map: Record<string, string> = {
    mysql: 'i-mdi-database-search',
    postgresql: 'i-mdi-elephant',
    oracle: 'i-mdi-alpha-o-circle-outline',
    clickhouse: 'i-mdi-table-arrow-right'
  };
  return map[type?.toLowerCase() ?? ''] ?? 'i-mdi-database';
}

function getDbTypeColor(type?: string) {
  const map: Record<string, string> = {
    mysql: '#F97316',
    postgresql: '#2563EB',
    oracle: '#DC2626',
    clickhouse: '#D97706'
  };
  return map[type?.toLowerCase() ?? ''] ?? '#6B7280';
}

// ─── 数据加载 ─────────────────────────────────────────────────
async function loadDatasource() {
  if (!datasourceId.value) return;
  datasourceLoading.value = true;
  const [dsRes, sumRes] = await Promise.all([
    fetchGetDatasource(datasourceId.value),
    fetchGetDatasourceSummary(datasourceId.value)
  ]);
  if (!dsRes.error) datasource.value = dsRes.data;
  if (!sumRes.error) summary.value = sumRes.data;
  datasourceLoading.value = false;
}

async function loadDatabases() {
  if (!datasourceId.value) return;
  listLoading.value = true;
  const res = await fetchGetDatabases(datasourceId.value);
  if (!res.error) databases.value = res.data ?? [];
  listLoading.value = false;
}

async function loadTables() {
  if (!dbUuid.value) return;
  listLoading.value = true;
  const [tableRes, changeRes] = await Promise.all([
    fetchGetTables(dbUuid.value),
    fetchGetSchemaChangeList({
      datasourceId: datasourceId.value,
      entityLevel: 'table',
      databaseName: dbName.value ?? undefined,
      pageNum: 1,
      pageSize: 200
    })
  ]);
  if (!tableRes.error) tables.value = tableRes.data ?? [];
  if (!changeRes.error) dbChanges.value = changeRes.data?.rows ?? [];
  listLoading.value = false;
}

async function loadColumns() {
  if (!tableUuid.value) return;
  listLoading.value = true;
  const [colRes, changeRes] = await Promise.all([
    fetchGetColumns(tableUuid.value),
    fetchGetSchemaChangeList({
      datasourceId: datasourceId.value,
      entityLevel: 'column',
      tableName: tableName.value ?? undefined,
      pageNum: 1,
      pageSize: 200
    })
  ]);
  if (!colRes.error) columns.value = colRes.data ?? [];
  if (!changeRes.error) schemaChanges.value = changeRes.data?.rows ?? [];
  listLoading.value = false;
}

async function loadProfiles() {
  if (!tableUuid.value) return;
  profileLoading.value = true;
  tableProfileMap.value = {};
  columnProfileMap.value = {};

  // 并发加载：表级 + 所有列的 profile
  const tableRes = await fetchGetAllProfiles(tableUuid.value);
  if (!tableRes.error && tableRes.data) {
    tableProfileMap.value = Object.fromEntries(tableRes.data.map(p => [p.metricName, p.actualValue]));
  }

  if (columns.value.length > 0) {
    const colResults = await Promise.all(columns.value.map(col => fetchGetAllProfiles(col.uuid)));
    columns.value.forEach((col, idx) => {
      const res = colResults[idx];
      if (!res.error && res.data) {
        columnProfileMap.value[col.uuid] = Object.fromEntries(res.data.map(p => [p.metricName, p.actualValue]));
      }
    });
  }

  profileLoading.value = false;
}

async function handleTriggerProfile() {
  if (!tableUuid.value) return;
  triggerLoading.value = true;
  const res = await fetchTriggerTableProfile(tableUuid.value);
  triggerLoading.value = false;
  if (!res.error) {
    window.$message?.success('数据概览已触发，正在后台计算，请稍后刷新');
  }
}

// ─── 导航 ─────────────────────────────────────────────────────
function openDatabase(db: Api.Metadata.EntityInstance) {
  router.push({
    name: 'metadata_datasource-explorer',
    query: { datasourceId: datasourceId.value, dbUuid: db.uuid, dbName: db.displayName }
  });
}

function openTable(table: Api.Metadata.EntityInstance) {
  router.push({
    name: 'metadata_datasource-explorer',
    query: {
      datasourceId: datasourceId.value,
      dbUuid: dbUuid.value,
      dbName: dbName.value,
      tableUuid: table.uuid,
      tableName: table.displayName
    }
  });
}

function navTo(target: 'list' | 'datasource' | 'database') {
  if (target === 'list') {
    router.push({ name: 'metadata_datasource' });
  } else if (target === 'datasource') {
    router.push({
      name: 'metadata_datasource-explorer',
      query: { datasourceId: datasourceId.value }
    });
  } else {
    router.push({
      name: 'metadata_datasource-explorer',
      query: { datasourceId: datasourceId.value, dbUuid: dbUuid.value, dbName: dbName.value }
    });
  }
}

async function handleRefresh() {
  if (!datasourceId.value) return;
  refreshing.value = true;
  await fetchRefreshDatasource(datasourceId.value);
  refreshing.value = false;
  window.$message?.success('刷新已触发，元数据将在后台同步');
  if (level.value === 'datasource') loadDatabases();
  else if (level.value === 'database') loadTables();
}

// ─── 监听路由变化自动加载 ────────────────────────────────────
watch(
  () => route.query,
  async () => {
    if (!datasource.value || datasource.value.datasourceId !== datasourceId.value) {
      await loadDatasource();
    }
    if (level.value === 'datasource') {
      loadDatabases();
    } else if (level.value === 'database') {
      dbActiveTab.value = 'tables';
      loadTables();
    } else {
      activeTab.value = 'columns';
      tableProfileMap.value = {};
      columnProfileMap.value = {};
      loadColumns();
    }
  },
  { immediate: true }
);

// ─── 过滤 ─────────────────────────────────────────────────────
const filteredDatabases = computed(() =>
  databases.value.filter(d => !dbSearch.value || d.displayName.toLowerCase().includes(dbSearch.value.toLowerCase()))
);

const filteredTables = computed(() =>
  tables.value.filter(t => !tableSearch.value || t.displayName.toLowerCase().includes(tableSearch.value.toLowerCase()))
);

// ─── 表格列定义 ───────────────────────────────────────────────
const tableColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '表名',
    key: 'displayName',
    render: row => (
      <span class="cursor-pointer text-primary font-medium hover:underline" onClick={() => openTable(row)}>
        {row.displayName}
      </span>
    )
  },
  {
    title: '类型',
    key: 'type',
    width: 90,
    render: row => {
      const type = (parseProps(row.properties).type as string) ?? 'TABLE';
      return (
        <NTag size="small" bordered={false}>
          {type}
        </NTag>
      );
    }
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-400">-</span>
  },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 160,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? new Date(t).toLocaleString('zh-CN') : '-';
    }
  }
];

const columnColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '#',
    key: 'ordinal',
    width: 52,
    render: row => {
      const p = parseProps(row.properties);
      return <span class="text-12px text-gray-400">{String(p.ordinalPosition ?? '')}</span>;
    }
  },
  { title: '字段名', key: 'displayName', render: row => <span class="font-medium">{row.displayName}</span> },
  {
    title: '类型',
    key: 'type',
    width: 160,
    render: row => {
      const p = parseProps(row.properties);
      return (
        <NTag size="small" bordered={false} type="info">
          {String(p.type ?? '-')}
        </NTag>
      );
    }
  },
  {
    title: '主键',
    key: 'pk',
    width: 60,
    align: 'center',
    render: row => {
      const p = parseProps(row.properties);
      return p.primaryKey ? (
        <NIcon class="text-warning" size={16}>
          <div class="i-mdi-key-variant" />
        </NIcon>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  },
  {
    title: '可空',
    key: 'nullable',
    width: 60,
    align: 'center',
    render: row => {
      const p = parseProps(row.properties);
      return (
        <NTag size="tiny" bordered={false} type={p.nullable ? 'default' : 'error'}>
          {p.nullable ? 'YES' : 'NO'}
        </NTag>
      );
    }
  },
  {
    title: '默认值',
    key: 'default',
    width: 120,
    render: row => {
      const p = parseProps(row.properties);
      const v = p.defaultValue as string | undefined;
      return v !== undefined && v !== null ? (
        <span class="text-12px font-mono">{v}</span>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  },
  {
    title: '注释',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-400">-</span>
  }
];

const dbChangeColumns: DataTableColumns<Api.Metadata.SchemaChange> = [
  {
    title: '变更类型',
    key: 'changeType',
    width: 110,
    render: row => {
      const typeMap: Record<string, { text: string; type: 'default' | 'error' | 'success' | 'warning' | 'info' }> = {
        ADDED: { text: '新增', type: 'success' },
        DELETED: { text: '删除', type: 'error' }
      };
      const t = typeMap[row.changeType] ?? { text: row.changeType, type: 'default' };
      return (
        <NTag size="small" type={t.type} bordered={false}>
          {t.text}
        </NTag>
      );
    }
  },
  { title: '表名', key: 'tableName', render: row => <span class="font-medium">{row.tableName || '-'}</span> },
  {
    title: '变更前',
    key: 'changeBefore',
    ellipsis: { tooltip: true },
    render: row => row.changeBefore || <span class="text-gray-400">-</span>
  },
  {
    title: '变更后',
    key: 'changeAfter',
    ellipsis: { tooltip: true },
    render: row => row.changeAfter || <span class="text-gray-400">-</span>
  },
  {
    title: '时间',
    key: 'createTime',
    width: 160,
    render: row => (row.createTime ? new Date(row.createTime).toLocaleString('zh-CN') : '-')
  }
];

function profileVal(colUuid: string, metric: string): string {
  return columnProfileMap.value[colUuid]?.[metric] ?? '-';
}

const profileTableColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '字段名',
    key: 'displayName',
    fixed: 'left',
    width: 140,
    render: row => <span class="text-gray-800 font-medium dark:text-gray-200">{row.displayName}</span>
  },
  {
    title: '类型',
    key: 'dataType',
    width: 130,
    render: row => {
      const p = parseProps(row.properties);
      return (
        <NTag size="small" bordered={false} type="info">
          {String(p.type ?? '-')}
        </NTag>
      );
    }
  },
  { title: '空值数', key: 'null', width: 90, align: 'right', render: row => profileVal(row.uuid, 'column_null') },
  {
    title: '非空值数',
    key: 'notNull',
    width: 90,
    align: 'right',
    render: row => profileVal(row.uuid, 'column_not_null')
  },
  {
    title: '不同值数',
    key: 'distinct',
    width: 90,
    align: 'right',
    render: row => profileVal(row.uuid, 'column_distinct')
  },
  { title: '唯一值数', key: 'unique', width: 90, align: 'right', render: row => profileVal(row.uuid, 'column_unique') },
  { title: '最大值', key: 'max', width: 110, align: 'right', render: row => profileVal(row.uuid, 'column_max') },
  { title: '最小值', key: 'min', width: 110, align: 'right', render: row => profileVal(row.uuid, 'column_min') },
  { title: '均值', key: 'avg', width: 110, align: 'right', render: row => profileVal(row.uuid, 'column_avg') },
  { title: '求和', key: 'sum', width: 110, align: 'right', render: row => profileVal(row.uuid, 'column_sum') },
  {
    title: '最大长度',
    key: 'maxLen',
    width: 90,
    align: 'right',
    render: row => profileVal(row.uuid, 'column_max_length')
  },
  {
    title: '最小长度',
    key: 'minLen',
    width: 90,
    align: 'right',
    render: row => profileVal(row.uuid, 'column_min_length')
  },
  {
    title: '平均长度',
    key: 'avgLen',
    width: 90,
    align: 'right',
    render: row => profileVal(row.uuid, 'column_avg_length')
  }
];

const changeColumns: DataTableColumns<Api.Metadata.SchemaChange> = [
  {
    title: '变更类型',
    key: 'changeType',
    width: 120,
    render: row => {
      const typeMap: Record<string, { text: string; type: 'default' | 'error' | 'success' | 'warning' | 'info' }> = {
        ADDED: { text: '新增', type: 'success' },
        DELETED: { text: '删除', type: 'error' },
        TYPE_CHANGED: { text: '类型变更', type: 'warning' }
      };
      const t = typeMap[row.changeType] ?? { text: row.changeType, type: 'default' };
      return (
        <NTag size="small" type={t.type} bordered={false}>
          {t.text}
        </NTag>
      );
    }
  },
  { title: '字段名', key: 'columnName', width: 140 },
  { title: '变更前', key: 'changeBefore', ellipsis: { tooltip: true } },
  { title: '变更后', key: 'changeAfter', ellipsis: { tooltip: true } },
  {
    title: '时间',
    key: 'createTime',
    width: 160,
    render: row => (row.createTime ? new Date(row.createTime).toLocaleString('zh-CN') : '-')
  }
];
</script>

<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-[#101014]">
    <!-- ══ 顶部面包屑 ══ -->
    <div class="flex-shrink-0 border-b border-gray-200 bg-white px-24px py-12px dark:border-gray-800 dark:bg-[#18181c]">
      <NBreadcrumb>
        <NBreadcrumbItem @click="navTo('list')">
          <span class="cursor-pointer hover:text-primary">数据源列表</span>
        </NBreadcrumbItem>
        <NBreadcrumbItem v-if="datasourceId">
          <span
            :class="
              level !== 'datasource'
                ? 'cursor-pointer hover:text-primary'
                : 'text-gray-700 dark:text-gray-200 font-semibold'
            "
            @click="level !== 'datasource' && navTo('datasource')"
          >
            <NSkeleton v-if="datasourceLoading" text class="inline-block w-80px" />
            <span v-else>{{ datasource?.datasourceName ?? datasourceId }}</span>
          </span>
        </NBreadcrumbItem>
        <NBreadcrumbItem v-if="dbUuid">
          <span
            :class="
              level !== 'database'
                ? 'cursor-pointer hover:text-primary'
                : 'text-gray-700 dark:text-gray-200 font-semibold'
            "
            @click="level !== 'database' && navTo('database')"
          >
            {{ dbName }}
          </span>
        </NBreadcrumbItem>
        <NBreadcrumbItem v-if="tableUuid">
          <span class="text-gray-700 font-semibold dark:text-gray-200">{{ tableName }}</span>
        </NBreadcrumbItem>
      </NBreadcrumb>
    </div>

    <!-- ══ 实体 Header ══ -->
    <div class="flex-shrink-0 border-b border-gray-200 bg-white px-24px py-16px dark:border-gray-800 dark:bg-[#18181c]">
      <NSpin :show="datasourceLoading" :size="16">
        <div class="flex items-center justify-between gap-16px">
          <!-- 左侧：图标 + 名称 + 标签 -->
          <div class="flex items-center gap-14px">
            <!-- eslint-disable-next-line vue/no-static-inline-styles -->
            <div
              class="h-44px w-44px flex-center flex-shrink-0 rounded-10px"
              :style="{ background: getDbTypeColor(datasource?.datasourceType) + '20' }"
            >
              <!-- eslint-disable-next-line vue/no-static-inline-styles -->
              <NIcon :size="24" :style="{ color: getDbTypeColor(datasource?.datasourceType) }">
                <div :class="getDbTypeIcon(datasource?.datasourceType)" />
              </NIcon>
            </div>
            <div class="flex flex-col gap-4px">
              <div class="flex items-center gap-8px">
                <span class="text-18px text-gray-900 font-bold dark:text-gray-100">
                  <template v-if="level === 'datasource'">{{ datasource?.datasourceName ?? '-' }}</template>
                  <template v-else-if="level === 'database'">{{ dbName }}</template>
                  <template v-else>{{ tableName }}</template>
                </span>
                <NTag v-if="datasource?.datasourceType" size="small" :bordered="false" type="info">
                  {{ datasource.datasourceType.toUpperCase() }}
                </NTag>
                <NTag
                  v-if="level === 'datasource' && datasource?.status"
                  size="small"
                  :bordered="false"
                  :type="datasource.status === '0' ? 'success' : 'error'"
                >
                  {{ datasource.status === '0' ? '运行中' : '已停用' }}
                </NTag>
                <NTag v-if="level === 'database'" size="small" :bordered="false">DATABASE</NTag>
                <NTag v-if="level === 'table'" size="small" :bordered="false" type="warning">TABLE</NTag>
              </div>
              <span v-if="level === 'datasource' && datasource?.remark" class="text-12px text-gray-400">
                {{ datasource.remark }}
              </span>
            </div>
          </div>

          <!-- 右侧：操作按钮 -->
          <div class="flex flex-shrink-0 items-center gap-8px">
            <NButton
              v-if="level === 'datasource' && hasAuth('metadata:datasource:edit')"
              size="small"
              :loading="refreshing"
              secondary
              @click="handleRefresh"
            >
              <template #icon>
                <NIcon><div class="i-mdi-refresh" /></NIcon>
              </template>
              刷新元数据
            </NButton>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- ══ 主内容区 ══ -->
    <div class="flex-1 overflow-y-auto p-24px">
      <!-- ── Level 1: 数据源 → 数据库列表 ── -->
      <template v-if="level === 'datasource'">
        <!-- 摘要统计卡 -->
        <div class="grid grid-cols-4 mb-20px gap-14px">
          <NCard
            v-for="stat in [
              { label: '数据库', value: summary?.databaseCount, icon: 'i-mdi-database-outline', color: '#2563EB' },
              { label: '数据表', value: summary?.tableCount, icon: 'i-mdi-table-large', color: '#7C3AED' },
              { label: '字段数', value: summary?.columnCount, icon: 'i-mdi-table-column', color: '#059669' },
              { label: '近7天变更', value: summary?.recentChangeCount, icon: 'i-mdi-history', color: '#D97706' }
            ]"
            :key="stat.label"
            :bordered="false"
            content-style="padding: 16px 20px"
            class="shadow-sm"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-12px text-gray-400">{{ stat.label }}</p>
                <p class="mt-4px text-24px text-gray-900 font-bold dark:text-gray-100">
                  <NSkeleton v-if="datasourceLoading" text class="w-40px" />
                  <span v-else>{{ stat.value ?? 0 }}</span>
                </p>
              </div>
              <!-- eslint-disable-next-line vue/no-static-inline-styles -->
              <div class="h-40px w-40px flex-center rounded-10px" :style="{ background: stat.color + '15' }">
                <!-- eslint-disable-next-line vue/no-static-inline-styles -->
                <NIcon :size="20" :style="{ color: stat.color }"><div :class="stat.icon" /></NIcon>
              </div>
            </div>
          </NCard>
        </div>

        <!-- 数据库列表 -->
        <NCard :bordered="false" class="shadow-sm" content-style="padding: 0">
          <div class="flex items-center justify-between border-b border-gray-100 px-20px py-14px dark:border-gray-800">
            <span class="text-14px text-gray-700 font-semibold dark:text-gray-300">
              数据库
              <span class="ml-6px text-12px text-gray-400 font-normal">({{ filteredDatabases.length }})</span>
            </span>
            <NInput v-model:value="dbSearch" size="small" placeholder="搜索数据库" clearable class="w-200px">
              <template #prefix>
                <NIcon><div class="i-mdi-magnify" /></NIcon>
              </template>
            </NInput>
          </div>

          <NSpin :show="listLoading">
            <div v-if="filteredDatabases.length" class="grid grid-cols-2 gap-0 lg:grid-cols-3 xl:grid-cols-4">
              <div
                v-for="db in filteredDatabases"
                :key="db.uuid"
                class="group cursor-pointer border-b border-r border-gray-100 px-20px py-16px transition-colors dark:border-gray-800/60 hover:bg-primary/5 dark:hover:bg-primary/10"
                @click="openDatabase(db)"
              >
                <div class="flex items-center gap-10px">
                  <div class="h-32px w-32px flex-center flex-shrink-0 rounded-8px bg-blue-50 dark:bg-blue-900/20">
                    <NIcon :size="16" class="text-blue-500">
                      <div class="i-mdi-database" />
                    </NIcon>
                  </div>
                  <div class="overflow-hidden">
                    <p
                      class="truncate text-13px text-gray-800 font-semibold dark:text-gray-200 group-hover:text-primary"
                    >
                      {{ db.displayName }}
                    </p>
                    <p v-if="db.description" class="truncate text-11px text-gray-400">{{ db.description }}</p>
                  </div>
                  <NIcon class="ml-auto flex-shrink-0 text-gray-300 group-hover:text-primary" :size="14">
                    <div class="i-mdi-chevron-right" />
                  </NIcon>
                </div>
              </div>
            </div>
            <NEmpty v-else-if="!listLoading" description="暂无数据库，请先刷新元数据" class="py-60px" />
          </NSpin>
        </NCard>
      </template>

      <!-- ── Level 2: 数据库 → 表列表 + 库级 Schema 变更 ── -->
      <template v-else-if="level === 'database'">
        <NCard :bordered="false" class="shadow-sm" content-style="padding: 0">
          <NTabs v-model:value="dbActiveTab" type="line" :tab-style="{ padding: '12px 20px' }" pane-style="padding: 0">
            <NTabPane name="tables" tab="数据表">
              <div
                class="flex items-center justify-between border-b border-gray-100 px-20px py-12px dark:border-gray-800"
              >
                <span class="text-13px text-gray-500">
                  共
                  <b class="text-gray-800 dark:text-gray-200">{{ filteredTables.length }}</b>
                  张表
                </span>
                <NInput v-model:value="tableSearch" size="small" placeholder="搜索表名" clearable class="w-200px">
                  <template #prefix>
                    <NIcon><div class="i-mdi-magnify" /></NIcon>
                  </template>
                </NInput>
              </div>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="filteredTables.length || listLoading"
                  :columns="tableColumns"
                  :data="filteredTables"
                  :single-line="false"
                  size="small"
                  class="min-h-200px"
                />
                <NEmpty v-else description="暂无数据表" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes" :tab="`Schema 变更 (${dbChanges.length})`">
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="dbChanges.length || listLoading"
                  :columns="dbChangeColumns"
                  :data="dbChanges"
                  :single-line="false"
                  size="small"
                  class="min-h-200px"
                />
                <NEmpty v-else description="暂无表级 Schema 变更记录" class="py-60px" />
              </NSpin>
            </NTabPane>
          </NTabs>
        </NCard>
      </template>

      <!-- ── Level 3: 表 → 字段列表 + Schema 变更 + 数据概览 ── -->
      <template v-else>
        <NCard :bordered="false" class="shadow-sm" content-style="padding: 0">
          <NTabs
            v-model:value="activeTab"
            type="line"
            :tab-style="{ padding: '12px 20px' }"
            pane-style="padding: 0"
            @update:value="v => v === 'profile' && !profileLoading && loadProfiles()"
          >
            <NTabPane name="columns" tab="字段列表">
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="columns.length || listLoading"
                  :columns="columnColumns"
                  :data="columns"
                  :single-line="false"
                  size="small"
                  class="min-h-200px"
                />
                <NEmpty v-else description="暂无字段信息" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes" :tab="`Schema 变更 (${schemaChanges.length})`">
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="schemaChanges.length || listLoading"
                  :columns="changeColumns"
                  :data="schemaChanges"
                  :single-line="false"
                  size="small"
                  class="min-h-200px"
                />
                <NEmpty v-else description="暂无 Schema 变更记录" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="profile" tab="数据概览">
              <div class="p-20px">
                <!-- 操作栏 -->
                <div class="mb-16px flex items-center gap-12px">
                  <NButton
                    size="small"
                    type="primary"
                    secondary
                    :loading="triggerLoading"
                    @click="handleTriggerProfile"
                  >
                    <template #icon>
                      <NIcon><div class="i-mdi-play-circle-outline" /></NIcon>
                    </template>
                    执行数据概览
                  </NButton>
                  <NButton size="small" :loading="profileLoading" secondary @click="loadProfiles">
                    <template #icon>
                      <NIcon><div class="i-mdi-refresh" /></NIcon>
                    </template>
                    刷新结果
                  </NButton>
                  <span class="text-12px text-gray-400">
                    点击「执行数据概览」触发计算，执行完成后点「刷新结果」查看
                  </span>
                </div>

                <NSpin :show="profileLoading">
                  <!-- 表级指标 -->
                  <div
                    v-if="tableProfileMap['table_row_count']"
                    class="mb-16px inline-flex items-center gap-8px rounded-8px bg-blue-50 px-16px py-10px dark:bg-blue-900/20"
                  >
                    <NIcon class="text-blue-500" :size="18"><div class="i-mdi-table-large" /></NIcon>
                    <span class="text-13px text-gray-600 dark:text-gray-300">总行数</span>
                    <span class="text-16px text-blue-600 font-bold dark:text-blue-400">
                      {{ tableProfileMap['table_row_count'] }}
                    </span>
                  </div>

                  <!-- 列级指标表格 -->
                  <NDataTable
                    v-if="columns.length"
                    :data="columns"
                    :columns="profileTableColumns"
                    :single-line="false"
                    size="small"
                    :scroll-x="1200"
                  />
                  <NEmpty v-else description="暂无列信息" class="py-40px" />
                </NSpin>
              </div>
            </NTabPane>
          </NTabs>
        </NCard>
      </template>
    </div>
  </div>
</template>
