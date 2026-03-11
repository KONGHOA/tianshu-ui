<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NBreadcrumb,
  NBreadcrumbItem,
  NButton,
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
import dayjs from 'dayjs';
import {
  fetchGetDatasource,
  fetchGetDatasourceSummary,
  fetchRefreshDatasource
} from '@/service/api/metadata/datasource';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';
import { fetchTriggerTableSync } from '@/service/api/metadata/sync';
import { useAuth } from '@/hooks/business/auth';
import { getDatasourceIcon } from '@/utils/datasourceIcon';
import ProfileTab from './modules/ProfileTab.vue';
import DatabaseProfileTab from './modules/DatabaseProfileTab.vue';
import ChangeTimeline from './modules/ChangeTimeline.vue';

function getDatasourceStatusMeta(status?: string) {
  if (status === '1') {
    return {
      text: '在线',
      type: 'success' as const,
      dot: 'bg-green-500'
    };
  }
  if (status === '2') {
    return {
      text: '离线',
      type: 'error' as const,
      dot: 'bg-red-500'
    };
  }
  return {
    text: '未检测',
    type: 'default' as const,
    dot: 'bg-gray-400'
  };
}

defineOptions({ name: 'MetadataDatasourceExplorer' });

const route = useRoute();
const router = useRouter();
const { hasAuth } = useAuth();

// ─── 当前层级（由 query 参数驱动） ───────────────────────────────
const datasourceId = computed(() => route.query.datasourceId as string | undefined);
const dbUuid = computed(() => route.query.dbUuid as string | undefined);
const dbName = computed(() => route.query.dbName as string | undefined);
const schemaUuid = computed(() => route.query.schemaUuid as string | undefined);
const schemaName = computed(() => route.query.schemaName as string | undefined);
const tableUuid = computed(() => route.query.tableUuid as string | undefined);
const tableName = computed(() => route.query.tableName as string | undefined);

const level = computed<'datasource' | 'database' | 'schema' | 'table'>(() => {
  if (tableUuid.value) return 'table';
  if (schemaUuid.value) return 'schema';
  if (dbUuid.value) return 'database';
  return 'datasource';
});

// ─── 数据 ─────────────────────────────────────────────────────
const datasource = ref<Api.Metadata.Datasource | null>(null);
const summary = ref<Api.Metadata.DatasourceSummary | null>(null);
const databases = ref<Api.Metadata.EntityInstance[]>([]);
const schemas = ref<Api.Metadata.EntityInstance[]>([]);
const tables = ref<Api.Metadata.EntityInstance[]>([]);
const columns = ref<Api.Metadata.EntityInstance[]>([]);
const schemaChanges = ref<Api.Metadata.SchemaChange[]>([]);
const dbChanges = ref<Api.Metadata.SchemaChange[]>([]);
const schemaLevelChanges = ref<Api.Metadata.SchemaChange[]>([]);
const tableColumnCounts = ref<Map<string, number>>(new Map());

const datasourceLoading = ref(false);
const listLoading = ref(false);
const refreshing = ref(false);
const tableSyncing = ref(false);

const dbSearch = ref('');
const schemaSearch = ref('');
const tableSearch = ref('');
const activeTab = ref('columns');
const dbActiveTab = ref('schemas');
const datasourceActiveTab = ref('overview');
const schemaActiveTab = ref('tables');
const showPassword = ref(false);

// ─── 工具函数 ─────────────────────────────────────────────────
const propsCache = new Map<string, Record<string, unknown>>();

function parseProps(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  if (propsCache.has(json)) return propsCache.get(json)!;
  try {
    const parsed = JSON.parse(json);
    if (propsCache.size > 5000) propsCache.clear();
    propsCache.set(json, parsed);
    return parsed;
  } catch {
    return {};
  }
}

function formatDateTime(dt: string | null | undefined): string {
  if (!dt) return '暂无';
  try {
    return dayjs(dt).format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return dt;
  }
}

function getMetricTagClass(type: ChangeTagType | 'neutral' | 'primary' = 'neutral'): string {
  if (type === 'success') return 'metric-tag metric-tag--success';
  if (type === 'error') return 'metric-tag metric-tag--error';
  if (type === 'warning') return 'metric-tag metric-tag--warning';
  if (type === 'info') return 'metric-tag metric-tag--info';
  if (type === 'primary') return 'metric-tag metric-tag--primary';
  return 'metric-tag metric-tag--neutral';
}

type ChangeTagType = 'default' | 'error' | 'success' | 'warning' | 'info';

const connParamsObj = computed(() => {
  if (!datasource.value?.connParams) return {};
  return parseProps(datasource.value.connParams);
});

const filterConfigObj = computed<Api.Metadata.DatasourceFilterConfig | null>(() => {
  if (!datasource.value?.filterConfig) return null;
  try {
    return JSON.parse(datasource.value.filterConfig);
  } catch {
    return null;
  }
});

const filterSummary = computed(() => {
  const schemaIncludes = filterConfigObj.value?.schemaFilterPattern?.includes ?? [];
  const schemaExcludes = filterConfigObj.value?.schemaFilterPattern?.excludes ?? [];
  const tableIncludes = filterConfigObj.value?.tableFilterPattern?.includes ?? [];
  const tableExcludes = filterConfigObj.value?.tableFilterPattern?.excludes ?? [];
  const activeRuleCount = schemaIncludes.length + schemaExcludes.length + tableIncludes.length + tableExcludes.length;
  return {
    activeRuleCount,
    schemaIncludes,
    schemaExcludes,
    tableIncludes,
    tableExcludes
  };
});

const displayedPassword = computed(() => {
  const password = connParamsObj.value.password;
  if (!password) return '-';
  return showPassword.value ? String(password) : '••••••••';
});

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

async function loadSchemas() {
  if (!dbUuid.value) return;
  listLoading.value = true;
  const [schemaRes, changeRes] = await Promise.all([
    fetchGetSchemas(dbUuid.value),
    fetchGetSchemaChangeList({
      datasourceId: datasourceId.value,
      entityLevel: 'schema',
      databaseName: dbName.value ?? undefined,
      pageNum: 1,
      pageSize: 200
    })
  ]);
  if (!schemaRes.error) schemas.value = schemaRes.data ?? [];
  if (!changeRes.error) schemaLevelChanges.value = changeRes.data?.rows ?? [];
  listLoading.value = false;
}

async function loadTables() {
  if (!schemaUuid.value) return;
  listLoading.value = true;
  const [tableRes, changeRes] = await Promise.all([
    fetchGetTables(schemaUuid.value),
    fetchGetSchemaChangeList({
      datasourceId: datasourceId.value,
      entityLevel: 'table',
      databaseName: schemaName.value ?? undefined,
      pageNum: 1,
      pageSize: 200
    })
  ]);
  if (!tableRes.error) tables.value = tableRes.data ?? [];
  if (!changeRes.error) dbChanges.value = changeRes.data?.rows ?? [];
  listLoading.value = false;

  // 异步批量获取每张表的字段数量已移除，避免触发表级10s接口超时
  // 后续若需字段数应由后端在 getTables 原生接口中直接合并返回
  // tableColumnCounts.value = new Map<string, number>();
}

async function loadColumns() {
  if (!tableUuid.value) return;
  listLoading.value = true;
  const [colRes, changeRes] = await Promise.all([
    fetchGetColumns(tableUuid.value),
    fetchGetSchemaChangeList({
      datasourceId: datasourceId.value,
      entityLevel: 'column',
      databaseName: schemaName.value ?? undefined,
      tableName: tableName.value ?? undefined,
      pageNum: 1,
      pageSize: 200
    })
  ]);
  if (!colRes.error) columns.value = colRes.data ?? [];
  if (!changeRes.error) schemaChanges.value = changeRes.data?.rows ?? [];
  listLoading.value = false;
}

// ─── 导航 ─────────────────────────────────────────────────────
function openDatabase(db: Api.Metadata.EntityInstance) {
  router.push({
    name: 'metadata_datasource-explorer',
    query: { datasourceId: datasourceId.value, dbUuid: db.uuid, dbName: db.displayName }
  });
}

function openSchema(schema: Api.Metadata.EntityInstance) {
  router.push({
    name: 'metadata_datasource-explorer',
    query: {
      datasourceId: datasourceId.value,
      dbUuid: dbUuid.value,
      dbName: dbName.value,
      schemaUuid: schema.uuid,
      schemaName: schema.displayName
    }
  });
}

function openTable(table: Api.Metadata.EntityInstance) {
  router.push({
    name: 'metadata_datasource-explorer',
    query: {
      datasourceId: datasourceId.value,
      dbUuid: dbUuid.value,
      dbName: dbName.value,
      schemaUuid: schemaUuid.value,
      schemaName: schemaName.value,
      tableUuid: table.uuid,
      tableName: table.displayName
    }
  });
}

function navTo(target: 'list' | 'datasource' | 'database' | 'schema') {
  if (target === 'list') {
    router.push({ name: 'metadata_datasource' });
  } else if (target === 'datasource') {
    router.push({
      name: 'metadata_datasource-explorer',
      query: { datasourceId: datasourceId.value }
    });
  } else if (target === 'database') {
    router.push({
      name: 'metadata_datasource-explorer',
      query: { datasourceId: datasourceId.value, dbUuid: dbUuid.value, dbName: dbName.value }
    });
  } else {
    router.push({
      name: 'metadata_datasource-explorer',
      query: {
        datasourceId: datasourceId.value,
        dbUuid: dbUuid.value,
        dbName: dbName.value,
        schemaUuid: schemaUuid.value,
        schemaName: schemaName.value
      }
    });
  }
}

async function handleRefresh() {
  if (!datasourceId.value) return;
  refreshing.value = true;
  await fetchRefreshDatasource(datasourceId.value);
  refreshing.value = false;
  window.$message?.success('已提交全量同步元数据任务');
  if (level.value === 'datasource') loadDatabases();
  else if (level.value === 'database') loadSchemas();
  else if (level.value === 'schema') loadTables();
}

async function handleSyncCurrentTable() {
  if (!datasourceId.value || !schemaName.value || !tableName.value) return;
  tableSyncing.value = true;
  const { error } = await fetchTriggerTableSync(datasourceId.value, {
    schemaName: schemaName.value,
    tableName: tableName.value
  });
  tableSyncing.value = false;
  if (!error) {
    window.$message?.success(`已提交表 ${schemaName.value}.${tableName.value} 同步任务`);
  }
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
      dbActiveTab.value = 'schemas';
      loadSchemas();
    } else if (level.value === 'schema') {
      schemaActiveTab.value = 'tables';
      loadTables();
    } else {
      activeTab.value = 'columns';
      loadColumns();
    }
  },
  { immediate: true }
);

// ─── 过滤 ─────────────────────────────────────────────────────
const filteredDatabases = computed(() =>
  databases.value.filter(d => !dbSearch.value || d.displayName.toLowerCase().includes(dbSearch.value.toLowerCase()))
);

const filteredSchemas = computed(() =>
  schemas.value.filter(
    s => !schemaSearch.value || s.displayName.toLowerCase().includes(schemaSearch.value.toLowerCase())
  )
);

const filteredTables = computed(() =>
  tables.value.filter(t => !tableSearch.value || t.displayName.toLowerCase().includes(tableSearch.value.toLowerCase()))
);

const sortedColumns = computed(() => {
  const mapped = columns.value.map(col => ({
    col,
    pos: (parseProps(col.properties).ordinalPosition as number) ?? 999
  }));
  return mapped.sort((a, b) => a.pos - b.pos).map(item => item.col);
});

// ─── 通用分页配置 ────────────────────────────────────────────────
const paginationProps = {
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  showQuickJumper: true,
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount || 0} 条`
};

// ─── 数据库列定义 ────────────────────────────────────────────────
const databaseColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '#',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '数据库',
    key: 'displayName',
    minWidth: 220,
    render: row => (
      <div class="flex cursor-pointer items-center gap-8px" onClick={() => openDatabase(row)}>
        <div class="h-28px w-28px flex-center flex-shrink-0 rounded-6px from-blue-50 to-blue-100/60 bg-gradient-to-br dark:from-blue-900/20 dark:to-blue-800/10">
          <NIcon size={14} class="text-blue-500">
            <div class="i-mdi-database" />
          </NIcon>
        </div>
        <span class="text-13px text-gray-800 font-semibold dark:text-gray-100 hover:text-primary">
          {row.displayName}
        </span>
      </div>
    )
  },
  {
    title: '说明',
    key: 'description',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '更新于',
    key: 'updateTime',
    width: 144,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{formatDateTime(t)}</span>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  }
];

// ─── 数据库结构列定义 ──────────────────────────────────────────
const schemaColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '#',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '结构',
    key: 'displayName',
    minWidth: 220,
    render: row => (
      <div class="flex cursor-pointer items-center gap-8px" onClick={() => openSchema(row)}>
        <div class="h-28px w-28px flex-center flex-shrink-0 rounded-6px from-purple-50 to-purple-100/60 bg-gradient-to-br dark:from-purple-900/20 dark:to-purple-800/10">
          <NIcon size={14} class="text-purple-500">
            <div class="i-mdi-layers-outline" />
          </NIcon>
        </div>
        <span class="text-13px text-gray-800 font-semibold dark:text-gray-100 hover:text-primary">
          {row.displayName}
        </span>
      </div>
    )
  },
  {
    title: '说明',
    key: 'description',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '更新于',
    key: 'updateTime',
    width: 144,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{formatDateTime(t)}</span>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  }
];

// ─── 表格列定义 ───────────────────────────────────────────────
const tableColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '#',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '表名',
    key: 'displayName',
    render: row => {
      const type = (parseProps(row.properties).type as string) ?? 'TABLE';
      const isView = type.toUpperCase().includes('VIEW');
      return (
        <div class="flex cursor-pointer items-center gap-8px" onClick={() => openTable(row)}>
          <div
            class={`h-28px w-28px flex-center flex-shrink-0 rounded-6px ${
              isView
                ? 'bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-900/20 dark:to-amber-800/10'
                : 'bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-900/20 dark:to-blue-800/10'
            }`}
          >
            <NIcon size={14} class={isView ? 'text-amber-500' : 'text-blue-500'}>
              <div class={isView ? 'i-mdi-eye-outline' : 'i-mdi-table'} />
            </NIcon>
          </div>
          <span class="text-13px text-gray-800 font-semibold dark:text-gray-100 hover:text-primary">
            {row.displayName}
          </span>
          {isView && (
            <NTag size="small" bordered={false} class={getMetricTagClass('warning')}>
              {type}
            </NTag>
          )}
        </div>
      );
    }
  },
  {
    title: '说明',
    key: 'description',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '字段',
    key: 'columnCount',
    width: 72,
    align: 'center',
    render: row => {
      const count = tableColumnCounts.value.get(row.uuid);
      return count !== undefined ? (
        <span class="text-13px text-gray-600 font-medium tabular-nums dark:text-gray-300">{count}</span>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  },
  {
    title: '行数',
    key: 'tableRows',
    width: 92,
    align: 'right',
    render: row => {
      const p = parseProps(row.properties);
      const rows = p.tableRows as number | undefined;
      if (rows === undefined || rows === null) return <span class="text-gray-300">-</span>;
      const formatted = rows >= 10000 ? `${(rows / 10000).toFixed(1)}万` : rows.toLocaleString('zh-CN');
      return <span class="text-13px text-gray-600 tabular-nums dark:text-gray-300">{formatted}</span>;
    }
  },
  {
    title: '更新于',
    key: 'updateTime',
    width: 144,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{formatDateTime(t)}</span>
      ) : (
        <span class="text-gray-300">-</span>
      );
    }
  }
];

const columnColumns: DataTableColumns<Api.Metadata.EntityInstance> = [
  {
    title: '#',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '字段',
    key: 'displayName',
    minWidth: 160,
    render: row => <span class="text-gray-800 font-semibold dark:text-gray-100">{row.displayName}</span>
  },
  {
    title: '类型',
    key: 'type',
    width: 132,
    render: row => {
      const p = parseProps(row.properties);
      return (
        <NTag size="small" bordered={false} class={getMetricTagClass('primary')}>
          {String(p.type ?? '-')}
        </NTag>
      );
    }
  },
  {
    title: '主键',
    key: 'pk',
    width: 56,
    align: 'center',
    render: row => {
      const p = parseProps(row.properties);
      const pkValue = p.primaryKey ?? p.isPrimaryKey ?? p.primary_key;
      const isPk = pkValue === true || pkValue === 'true' || pkValue === '1' || pkValue === 1;
      return isPk ? (
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
    width: 62,
    align: 'center',
    render: row => {
      const p = parseProps(row.properties);
      const isNullable = p.nullable === true || p.nullable === 'true' || p.nullable === '1' || p.nullable === 1;
      return (
        <NTag size="small" bordered={false} class={getMetricTagClass(isNullable ? 'neutral' : 'error')}>
          {isNullable ? 'YES' : 'NO'}
        </NTag>
      );
    }
  },
  {
    title: '默认',
    key: 'default',
    width: 108,
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
    title: '说明',
    key: 'description',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-400">-</span>
  }
];
</script>

<template>
  <div class="explorer-page min-h-full grow-0 bg-[#f7f8fa] dark:bg-[#101014]">
    <!-- ══ 顶部面包屑 ══ -->
    <div
      class="explorer-breadcrumb flex-shrink-0 border-b border-gray-200/60 bg-white px-24px py-10px dark:border-gray-800 dark:bg-[#18181c]"
    >
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
        <NBreadcrumbItem v-if="schemaUuid">
          <span
            :class="
              level !== 'schema'
                ? 'cursor-pointer hover:text-primary'
                : 'text-gray-700 dark:text-gray-200 font-semibold'
            "
            @click="level !== 'schema' && navTo('schema')"
          >
            {{ schemaName }}
          </span>
        </NBreadcrumbItem>
        <NBreadcrumbItem v-if="tableUuid">
          <span class="text-gray-700 font-semibold dark:text-gray-200">{{ tableName }}</span>
        </NBreadcrumbItem>
      </NBreadcrumb>
    </div>

    <!-- ══ 实体 Header ══ -->
    <div
      class="explorer-header flex-shrink-0 border-b border-gray-200/60 from-white to-gray-50/80 bg-gradient-to-r px-24px py-20px dark:border-gray-800 dark:from-[#18181c] dark:to-[#1a1a20]"
    >
      <NSpin :show="datasourceLoading" :size="16">
        <div class="flex items-center justify-between gap-16px">
          <!-- 左侧：图标 + 名称 + 标签 + 元信息 -->
          <div class="flex items-center gap-16px">
            <div
              class="h-52px w-52px flex-center flex-shrink-0 rounded-14px bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700"
            >
              <img
                :src="getDatasourceIcon(datasource?.datasourceType)"
                :alt="datasource?.datasourceType"
                class="h-36px w-36px object-contain"
              />
            </div>
            <div class="flex flex-col gap-6px">
              <div class="flex items-center gap-8px">
                <span class="text-20px text-gray-900 font-bold tracking-tight dark:text-gray-50">
                  <template v-if="level === 'datasource'">{{ datasource?.datasourceName ?? '-' }}</template>
                  <template v-else-if="level === 'database'">{{ dbName }}</template>
                  <template v-else-if="level === 'schema'">{{ schemaName }}</template>
                  <template v-else>{{ tableName }}</template>
                </span>
                <NTag v-if="datasource?.datasourceType" size="small" :bordered="false" type="info" round>
                  {{ datasource.datasourceType.toUpperCase() }}
                </NTag>
                <NTag
                  v-if="level === 'datasource' && datasource?.status"
                  size="small"
                  :bordered="false"
                  :type="getDatasourceStatusMeta(datasource.status).type"
                  round
                >
                  <template #icon>
                    <div
                      class="mr-2px h-6px w-6px rounded-full"
                      :class="getDatasourceStatusMeta(datasource.status).dot"
                    />
                  </template>
                  {{ getDatasourceStatusMeta(datasource.status).text }}
                </NTag>
                <NTag v-if="level === 'database'" size="small" :bordered="false" round>DATABASE</NTag>
                <NTag v-if="level === 'schema'" size="small" :bordered="false" type="default" round>SCHEMA</NTag>
                <NTag v-if="level === 'table'" size="small" :bordered="false" type="warning" round>TABLE</NTag>
              </div>
              <!-- 元信息行 -->
              <div class="flex items-center gap-16px text-12px text-gray-400">
                <span v-if="level === 'datasource' && datasource?.remark">
                  {{ datasource.remark }}
                </span>
                <span v-if="level === 'datasource' && summary" class="flex items-center gap-4px">
                  <NIcon :size="13" class="text-gray-300"><div class="i-mdi-clock-outline" /></NIcon>
                  最近同步: {{ formatDateTime(summary.lastSyncTime) }}
                </span>
                <span v-if="level === 'datasource' && summary" class="flex items-center gap-4px">
                  <NIcon :size="13" class="text-gray-300"><div class="i-mdi-table-large" /></NIcon>
                  {{ summary.tableCount }} 张表 · {{ summary.columnCount }} 个字段
                </span>
              </div>
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
              全量同步元数据
            </NButton>
            <NButton
              v-if="level === 'table' && hasAuth('metadata:datasource:edit')"
              size="small"
              type="warning"
              secondary
              :loading="tableSyncing"
              @click="handleSyncCurrentTable"
            >
              <template #icon>
                <NIcon><div class="i-mdi-table-sync" /></NIcon>
              </template>
              同步当前表
            </NButton>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- ══ 主内容区 ══ -->
    <div class="explorer-body p-20px pb-24px">
      <!-- ── Level 1: 数据源 → Tabs (数据库 / 概览) ── -->
      <template v-if="level === 'datasource'">
        <div
          class="explorer-surface explorer-tabs overflow-hidden rounded-16px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <NTabs
            v-model:value="datasourceActiveTab"
            type="line"
            :tab-style="{ padding: '14px 20px' }"
            pane-style="padding: 0"
          >
            <NTabPane name="overview">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-information-outline" /></NIcon>
                  概览
                </div>
              </template>

              <div
                class="overview-banner border-b border-gray-100/80 from-[#f8fbff] to-[#f7f8fa] bg-gradient-to-r px-24px py-22px dark:border-gray-800 dark:from-[#20232a] dark:to-[#1e1e24]"
              >
                <div class="min-w-0">
                  <div class="text-11px text-gray-400 tracking-wider uppercase">数据源概览</div>
                  <p class="mt-10px max-w-760px text-14px text-gray-500 leading-7 dark:text-gray-400">
                    {{ datasource?.remark || '查看该数据源的同步情况、元数据规模以及接入信息。' }}
                  </p>
                </div>
                <div class="grid mt-20px gap-12px md:grid-cols-2 xl:grid-cols-4">
                  <div
                    class="overview-stat rounded-16px bg-white px-16px py-14px ring-1 ring-gray-100 dark:bg-[#24242b] dark:ring-gray-700"
                  >
                    <div class="text-12px text-gray-400">最近同步</div>
                    <div class="mt-8px text-16px text-gray-900 font-semibold dark:text-gray-50">
                      {{ formatDateTime(summary?.lastSyncTime) }}
                    </div>
                  </div>
                  <div
                    class="overview-stat rounded-16px bg-white px-16px py-14px ring-1 ring-gray-100 dark:bg-[#24242b] dark:ring-gray-700"
                  >
                    <div class="text-12px text-gray-400">数据表</div>
                    <div class="mt-8px text-24px text-gray-900 font-semibold dark:text-gray-50">
                      {{ summary?.tableCount ?? 0 }}
                    </div>
                  </div>
                  <div
                    class="overview-stat rounded-16px bg-white px-16px py-14px ring-1 ring-gray-100 dark:bg-[#24242b] dark:ring-gray-700"
                  >
                    <div class="text-12px text-gray-400">字段数</div>
                    <div class="mt-8px text-24px text-gray-900 font-semibold dark:text-gray-50">
                      {{ summary?.columnCount ?? 0 }}
                    </div>
                  </div>
                  <div
                    class="overview-stat rounded-16px bg-white px-16px py-14px ring-1 ring-gray-100 dark:bg-[#24242b] dark:ring-gray-700"
                  >
                    <div class="text-12px text-gray-400">近7天变更</div>
                    <div class="mt-8px text-24px text-gray-900 font-semibold dark:text-gray-50">
                      {{ summary?.recentChangeCount ?? 0 }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid gap-18px p-20px xl:grid-cols-3">
                <div
                  class="overview-detail-card rounded-16px bg-white p-18px shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
                >
                  <div
                    class="mb-14px flex items-center gap-6px text-13px text-gray-700 font-semibold dark:text-gray-200"
                  >
                    <NIcon :size="16" class="text-gray-400"><div class="i-mdi-connection" /></NIcon>
                    连接信息
                  </div>
                  <div class="grid gap-x-18px gap-y-12px text-13px md:grid-cols-2">
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">主机地址</span>
                      <span class="text-right text-gray-800 font-medium dark:text-gray-200">
                        {{ connParamsObj.host || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">端口</span>
                      <span class="text-right text-gray-800 font-medium dark:text-gray-200">
                        {{ connParamsObj.port || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">连接库</span>
                      <span class="text-right text-gray-800 font-medium dark:text-gray-200">
                        {{ connParamsObj.database || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">用户名</span>
                      <span class="text-right text-gray-800 font-medium dark:text-gray-200">
                        {{ connParamsObj.username || '-' }}
                      </span>
                    </div>
                    <div class="flex items-start justify-between gap-12px md:col-span-2">
                      <span class="text-gray-400">密码</span>
                      <div class="flex items-center gap-8px">
                        <span class="text-right text-gray-800 font-medium font-mono dark:text-gray-200">
                          {{ displayedPassword }}
                        </span>
                        <NButton quaternary circle size="tiny" @click="showPassword = !showPassword">
                          <template #icon>
                            <icon-mdi-eye-off-outline v-if="showPassword" />
                            <icon-mdi-eye-outline v-else />
                          </template>
                        </NButton>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  class="overview-detail-card rounded-16px bg-white p-18px shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
                >
                  <div
                    class="mb-14px flex items-center gap-6px text-13px text-gray-700 font-semibold dark:text-gray-200"
                  >
                    <NIcon :size="16" class="text-gray-400"><div class="i-mdi-domain" /></NIcon>
                    来源信息
                  </div>
                  <div class="grid gap-x-18px gap-y-12px text-13px md:grid-cols-2">
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">来源机构编码</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.sourceOrgCode || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">来源机构名称</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.sourceOrgName || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">来源部门</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.sourceDept || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">来源类型</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.sourceType || '-' }}
                      </span>
                    </div>
                    <div class="flex items-start justify-between gap-12px md:col-span-2">
                      <span class="text-gray-400">来源系统</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.sourceSystem || '-' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  class="overview-detail-card rounded-16px bg-white p-18px shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
                >
                  <div
                    class="mb-14px flex items-center gap-6px text-13px text-gray-700 font-semibold dark:text-gray-200"
                  >
                    <NIcon :size="16" class="text-gray-400"><div class="i-mdi-account-circle-outline" /></NIcon>
                    管理信息
                  </div>
                  <div class="grid gap-x-18px gap-y-12px text-13px md:grid-cols-2">
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">联系人</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.contactPerson || '-' }}
                      </span>
                    </div>
                    <div
                      class="flex items-start justify-between gap-12px border-b border-gray-100/80 pb-10px dark:border-gray-800"
                    >
                      <span class="text-gray-400">联系电话</span>
                      <span class="text-right text-gray-800 dark:text-gray-200">
                        {{ datasource?.contactPhone || '-' }}
                      </span>
                    </div>
                    <div class="flex items-start justify-between gap-12px md:col-span-2">
                      <span class="text-gray-400">备注</span>
                      <span class="max-w-220px text-right text-gray-800 leading-6 dark:text-gray-200">
                        {{ datasource?.remark || '-' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  class="overview-detail-card rounded-16px bg-white p-18px shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
                >
                  <div
                    class="mb-14px flex items-center gap-6px text-13px text-gray-700 font-semibold dark:text-gray-200"
                  >
                    <NIcon :size="16" class="text-amber-500"><div class="i-mdi-filter-variant" /></NIcon>
                    同步过滤规则
                  </div>

                  <div
                    v-if="filterSummary.activeRuleCount === 0"
                    class="rounded-12px bg-gray-50 px-14px py-12px text-13px text-gray-500 leading-6 dark:bg-[#24242b] dark:text-gray-400"
                  >
                    当前未配置过滤规则。全量同步时将纳入该数据源下全部可见对象。
                  </div>

                  <div v-else class="grid gap-12px text-13px">
                    <div class="rounded-12px bg-amber-50/70 px-14px py-12px dark:bg-amber-900/10">
                      <div class="mb-6px text-12px text-amber-700 font-semibold dark:text-amber-300">Schema 过滤</div>
                      <div class="flex flex-col gap-8px">
                        <div class="flex items-start justify-between gap-12px">
                          <span class="text-gray-400">includes</span>
                          <span class="max-w-220px text-right text-gray-800 leading-6 dark:text-gray-200">
                            {{ filterSummary.schemaIncludes.join(' , ') || '-' }}
                          </span>
                        </div>
                        <div class="flex items-start justify-between gap-12px">
                          <span class="text-gray-400">excludes</span>
                          <span class="max-w-220px text-right text-gray-800 leading-6 dark:text-gray-200">
                            {{ filterSummary.schemaExcludes.join(' , ') || '-' }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="rounded-12px bg-sky-50/70 px-14px py-12px dark:bg-sky-900/10">
                      <div class="mb-6px text-12px text-sky-700 font-semibold dark:text-sky-300">Table 过滤</div>
                      <div class="flex flex-col gap-8px">
                        <div class="flex items-start justify-between gap-12px">
                          <span class="text-gray-400">includes</span>
                          <span class="max-w-220px text-right text-gray-800 leading-6 dark:text-gray-200">
                            {{ filterSummary.tableIncludes.join(' , ') || '-' }}
                          </span>
                        </div>
                        <div class="flex items-start justify-between gap-12px">
                          <span class="text-gray-400">excludes</span>
                          <span class="max-w-220px text-right text-gray-800 leading-6 dark:text-gray-200">
                            {{ filterSummary.tableExcludes.join(' , ') || '-' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NTabPane>

            <NTabPane name="databases">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-database" /></NIcon>
                  数据库
                  <span class="ml-2px text-11px text-gray-400">({{ filteredDatabases.length }})</span>
                </div>
              </template>

              <div
                class="explorer-toolbar flex flex-col gap-14px border-b border-gray-100/80 px-20px py-18px md:flex-row md:items-end md:justify-between dark:border-gray-800"
              >
                <div>
                  <div class="text-11px text-gray-400 tracking-wider uppercase">数据库清单</div>
                  <div class="mt-6px text-22px text-gray-900 font-semibold tracking-tight dark:text-gray-50">
                    数据库
                  </div>
                  <div class="mt-4px text-13px text-gray-400">
                    当前已同步 {{ filteredDatabases.length }} 个数据库节点，可继续进入下一级查看 schema、表和字段。
                  </div>
                </div>
                <div class="flex items-center gap-10px">
                  <div
                    class="rounded-full bg-gray-100 px-12px py-7px text-12px text-gray-500 dark:bg-[#24242b] dark:text-gray-400"
                  >
                    数据表 {{ summary?.tableCount ?? 0 }} · 字段 {{ summary?.columnCount ?? 0 }}
                  </div>
                  <NInput v-model:value="dbSearch" size="small" placeholder="搜索数据库" clearable class="w-240px">
                    <template #prefix>
                      <NIcon class="text-gray-300"><div class="i-mdi-magnify" /></NIcon>
                    </template>
                  </NInput>
                </div>
              </div>
              <div class="px-8px py-8px">
                <NSpin :show="listLoading">
                  <NDataTable
                    v-if="filteredDatabases.length || listLoading"
                    :columns="databaseColumns"
                    :data="filteredDatabases"
                    :single-line="false"
                    :pagination="paginationProps"
                    size="small"
                    striped
                    class="explorer-table"
                  />
                  <NEmpty v-else-if="!listLoading" description="暂无数据库，请先执行全量同步元数据" class="py-80px">
                    <template #icon><icon-mdi-database-search-outline class="text-42px text-gray-300" /></template>
                  </NEmpty>
                </NSpin>
              </div>
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 2: 数据库 → 数据库结构列表 + 变更记录 ── -->
      <template v-else-if="level === 'database'">
        <div
          class="explorer-surface explorer-tabs overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <NTabs v-model:value="dbActiveTab" type="line" :tab-style="{ padding: '14px 20px' }" pane-style="padding: 0">
            <NTabPane name="schemas">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-layers-outline" /></NIcon>
                  数据库结构
                  <span class="ml-2px text-11px text-gray-400">({{ filteredSchemas.length }})</span>
                </div>
              </template>
              <div
                class="flex items-center justify-end border-b border-gray-100/80 px-20px py-10px dark:border-gray-800"
              >
                <NInput
                  v-model:value="schemaSearch"
                  size="small"
                  placeholder="搜索数据库结构"
                  clearable
                  class="w-220px"
                >
                  <template #prefix>
                    <NIcon class="text-gray-300"><div class="i-mdi-magnify" /></NIcon>
                  </template>
                </NInput>
              </div>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="filteredSchemas.length || listLoading"
                  :columns="schemaColumns"
                  :data="filteredSchemas"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                  striped
                  class="explorer-table min-h-200px"
                />
                <NEmpty v-else-if="!listLoading" description="暂无数据库结构，请先执行全量同步元数据" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  变更记录
                  <span class="explorer-count-pill">{{ schemaLevelChanges.length }}</span>
                </div>
              </template>
              <div class="explorer-record-panel">
                <ChangeTimeline :records="schemaLevelChanges" :loading="listLoading" empty-description="暂无变更记录" />
              </div>
            </NTabPane>
            <NTabPane name="profile">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-chart-box-outline" /></NIcon>
                  数据概览
                </div>
              </template>
              <DatabaseProfileTab :database-uuid="dbUuid ?? ''" :database-name="dbName ?? ''" />
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 3: 数据库结构 → 表列表 + 变更记录 ── -->
      <template v-else-if="level === 'schema'">
        <div
          class="explorer-surface explorer-tabs overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <NTabs
            v-model:value="schemaActiveTab"
            type="line"
            :tab-style="{ padding: '14px 20px' }"
            pane-style="padding: 0"
          >
            <NTabPane name="tables">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-table-large" /></NIcon>
                  数据表
                  <span class="ml-2px text-11px text-gray-400">({{ filteredTables.length }})</span>
                </div>
              </template>
              <div
                class="flex items-center justify-end border-b border-gray-100/80 px-20px py-10px dark:border-gray-800"
              >
                <NInput v-model:value="tableSearch" size="small" placeholder="搜索表名" clearable class="w-220px">
                  <template #prefix>
                    <NIcon class="text-gray-300"><div class="i-mdi-magnify" /></NIcon>
                  </template>
                </NInput>
              </div>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="filteredTables.length || listLoading"
                  :columns="tableColumns"
                  :data="filteredTables"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                  striped
                  class="explorer-table"
                />
                <NEmpty v-else description="暂无数据表" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  变更记录
                  <span class="explorer-count-pill">{{ dbChanges.length }}</span>
                </div>
              </template>
              <div class="explorer-record-panel">
                <ChangeTimeline :records="dbChanges" :loading="listLoading" empty-description="暂无表级变更记录" />
              </div>
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 4: 表 → 字段列表 + 变更记录 + 数据概览 ── -->
      <template v-else>
        <div
          class="explorer-surface explorer-tabs overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <NTabs v-model:value="activeTab" type="line" :tab-style="{ padding: '14px 20px' }" pane-style="padding: 0">
            <NTabPane name="columns">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-format-columns" /></NIcon>
                  字段列表
                  <span class="ml-2px text-11px text-gray-400">({{ columns.length }})</span>
                </div>
              </template>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="sortedColumns.length || listLoading"
                  :columns="columnColumns"
                  :data="sortedColumns"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                  class="explorer-table"
                />
                <NEmpty v-else description="暂无字段信息" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  变更记录
                  <span class="explorer-count-pill">{{ schemaChanges.length }}</span>
                </div>
              </template>
              <div class="explorer-record-panel">
                <ChangeTimeline :records="schemaChanges" :loading="listLoading" empty-description="暂无变更记录" />
              </div>
            </NTabPane>

            <NTabPane name="profile">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-chart-box-outline" /></NIcon>
                  数据概览
                </div>
              </template>
              <ProfileTab :table-uuid="tableUuid ?? ''" :columns="columns" />
            </NTabPane>
          </NTabs>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.explorer-page {
  background-image:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.06), transparent 22%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 18rem);
}

.explorer-breadcrumb {
  backdrop-filter: saturate(140%) blur(4px);
}

.explorer-header {
  position: relative;
}

.explorer-header::after {
  content: '';
  position: absolute;
  inset: auto 24px 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.08), transparent 78%);
}

.explorer-body {
  display: grid;
  gap: 18px;
}

.explorer-surface {
  backdrop-filter: saturate(130%);
  box-shadow:
    0 10px 25px rgba(15, 23, 42, 0.04),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

.overview-banner {
  position: relative;
}

.overview-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.38), transparent 30%),
    linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.03), transparent);
  pointer-events: none;
}

.overview-stat {
  position: relative;
  overflow: hidden;
}

.overview-stat::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, #60a5fa, #34d399);
  opacity: 0.55;
}

.overview-detail-card {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.overview-detail-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
}

.explorer-count-pill {
  display: inline-flex;
  min-width: 22px;
  height: 20px;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  color: rgb(71, 85, 105);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.explorer-record-panel {
  padding: 14px 16px 18px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.7), rgba(255, 255, 255, 0.96)),
    linear-gradient(135deg, rgba(59, 130, 246, 0.03), transparent 38%);
}

.explorer-record-table {
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 16px 30px rgba(15, 23, 42, 0.04),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
}

.explorer-record-empty {
  border: 1px dashed rgba(203, 213, 225, 0.9);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.75);
}

:deep(.dark) .explorer-count-pill {
  background: rgba(120, 113, 108, 0.28);
  color: rgb(231, 229, 228);
}

:deep(.dark) .explorer-record-panel {
  background:
    linear-gradient(180deg, rgba(24, 24, 27, 0.72), rgba(28, 28, 33, 0.96)),
    linear-gradient(135deg, rgba(96, 165, 250, 0.05), transparent 45%);
}

:deep(.dark) .explorer-record-table {
  border-color: rgba(63, 63, 70, 0.9);
  background: rgba(24, 24, 27, 0.92);
  box-shadow:
    0 18px 34px rgba(0, 0, 0, 0.2),
    0 1px 0 rgba(255, 255, 255, 0.03) inset;
}

:deep(.dark) .explorer-record-empty {
  border-color: rgba(82, 82, 91, 0.85);
  background: rgba(24, 24, 27, 0.76);
}

.explorer-toolbar {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.8), rgba(248, 250, 252, 0.35));
}

.explorer-table :deep(.n-data-table-wrapper) {
  border-radius: 12px;
}

.explorer-table :deep(th) {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}

.explorer-table :deep(.n-data-table-td) {
  transition: background-color 140ms ease;
}

.explorer-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(59, 130, 246, 0.03);
}

.explorer-tabs :deep(.n-tabs-nav) {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(248, 250, 252, 0.55));
}

.explorer-tabs :deep(.n-tabs-tab) {
  margin: 0 4px 0 10px;
  border-radius: 10px;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.explorer-tabs :deep(.n-tabs-tab:hover) {
  background: rgba(59, 130, 246, 0.05);
}

.explorer-tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  background: rgba(59, 130, 246, 0.08);
}

.metric-tag {
  border-radius: 999px;
  padding-inline: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.metric-tag.metric-tag--neutral {
  background: #f1f5f9;
  color: #64748b;
}

.metric-tag.metric-tag--primary {
  background: #e0f2fe;
  color: #0369a1;
}

.metric-tag.metric-tag--info {
  background: #e0f2fe;
  color: #0f766e;
}

.metric-tag.metric-tag--success {
  background: #dcfce7;
  color: #15803d;
}

.metric-tag.metric-tag--warning {
  background: #fef3c7;
  color: #b45309;
}

.metric-tag.metric-tag--error {
  background: #fee2e2;
  color: #b91c1c;
}

.dark .explorer-page {
  background-image:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 18rem);
}

.dark .explorer-table :deep(th) {
  background: #252932;
  color: #94a3b8;
}

.dark .explorer-toolbar,
.dark .explorer-tabs :deep(.n-tabs-nav) {
  background: linear-gradient(180deg, rgba(36, 40, 46, 0.86), rgba(30, 30, 36, 0.5));
}

.dark .explorer-tabs :deep(.n-tabs-tab:hover) {
  background: rgba(96, 165, 250, 0.08);
}

.dark .explorer-tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  background: rgba(96, 165, 250, 0.12);
}

.dark .metric-tag.metric-tag--neutral {
  background: #2a3139;
  color: #a8b5c2;
}

.dark .metric-tag.metric-tag--primary {
  background: rgba(14, 116, 144, 0.28);
  color: #bae6fd;
}

.dark .metric-tag.metric-tag--info {
  background: rgba(13, 148, 136, 0.24);
  color: #99f6e4;
}

.dark .metric-tag.metric-tag--success {
  background: rgba(22, 163, 74, 0.24);
  color: #bbf7d0;
}

.dark .metric-tag.metric-tag--warning {
  background: rgba(217, 119, 6, 0.24);
  color: #fde68a;
}

.dark .metric-tag.metric-tag--error {
  background: rgba(220, 38, 38, 0.24);
  color: #fecaca;
}
</style>
