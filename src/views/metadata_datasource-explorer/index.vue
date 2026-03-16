<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NBreadcrumb,
  NBreadcrumbItem,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NIcon,
  NInput,
  NPagination,
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
const databasePage = ref(1);
const databasePageSize = ref(20);
const activeTab = ref('columns');
const dbActiveTab = ref('schemas');
const datasourceActiveTab = ref('databases');
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

const filteredDatabases = computed(() =>
  databases.value.filter(d => !dbSearch.value || d.displayName.toLowerCase().includes(dbSearch.value.toLowerCase()))
);

const pagedFilteredDatabases = computed(() => {
  const start = (databasePage.value - 1) * databasePageSize.value;
  return filteredDatabases.value.slice(start, start + databasePageSize.value);
});

const filteredSchemas = computed(() =>
  schemas.value.filter(
    s => !schemaSearch.value || s.displayName.toLowerCase().includes(schemaSearch.value.toLowerCase())
  )
);

const filteredTables = computed(() =>
  tables.value.filter(t => !tableSearch.value || t.displayName.toLowerCase().includes(tableSearch.value.toLowerCase()))
);

function formatCount(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('zh-CN');
}

function formatCompactCount(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toLocaleString('zh-CN');
}

function getToneClass(tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' = 'neutral'): string {
  if (tone === 'primary') return 'explorer-chip explorer-chip--primary';
  if (tone === 'success') return 'explorer-chip explorer-chip--success';
  if (tone === 'warning') return 'explorer-chip explorer-chip--warning';
  if (tone === 'danger') return 'explorer-chip explorer-chip--danger';
  return 'explorer-chip explorer-chip--neutral';
}

function getPasswordToggleLabel() {
  return showPassword.value ? '隐藏密码' : '显示密码';
}

const currentEntityTitle = computed(() => {
  if (level.value === 'table') return tableName.value || '数据表';
  if (level.value === 'schema') return schemaName.value || '数据库结构';
  if (level.value === 'database') return dbName.value || '数据库';
  return datasource.value?.datasourceName || datasourceId.value || '元数据浏览';
});

const currentEntityLabel = computed(() => {
  if (level.value === 'table') return 'TABLE';
  if (level.value === 'schema') return 'SCHEMA';
  if (level.value === 'database') return 'DATABASE';
  return datasource.value?.datasourceType?.toUpperCase() || 'DATASOURCE';
});

const currentEntitySummary = computed(() => {
  if (level.value === 'table') {
    return '聚焦字段结构、变更轨迹与画像结果，适合定位表结构质量与字段风险。';
  }
  if (level.value === 'schema') {
    return '在当前结构下查看表清单和变更记录，快速识别新增视图、热点表与同步范围。';
  }
  if (level.value === 'database') {
    return '围绕数据库组织 schema、变更与画像信息，适合做整库级元数据巡检。';
  }
  return datasource.value?.remark || '统一浏览数据源下数据库、结构、表与字段信息，支持同步、画像与变更追踪。';
});

const schemaViewCount = computed(
  () =>
    tables.value.filter(item => {
      const type = String(parseProps(item.properties).type ?? '').toUpperCase();
      return type.includes('VIEW');
    }).length
);

const schemaEstimatedRows = computed(() =>
  tables.value.reduce((total, item) => {
    const tableRows = Number(parseProps(item.properties).tableRows ?? 0);
    return Number.isFinite(tableRows) ? total + tableRows : total;
  }, 0)
);

const tablePkCount = computed(
  () =>
    columns.value.filter(item => {
      const props = parseProps(item.properties);
      const pkValue = props.primaryKey ?? props.isPrimaryKey ?? props.primary_key;
      return pkValue === true || pkValue === 'true' || pkValue === '1' || pkValue === 1;
    }).length
);

const tableNullableCount = computed(
  () =>
    columns.value.filter(item => {
      const nullable = parseProps(item.properties).nullable;
      return nullable === true || nullable === 'true' || nullable === '1' || nullable === 1;
    }).length
);

const heroStats = computed(() => {
  if (level.value === 'table') {
    return [
      { label: '字段总数', value: formatCount(columns.value.length), hint: '当前表结构', tone: 'primary' as const },
      { label: '主键字段', value: formatCount(tablePkCount.value), hint: '唯一标识', tone: 'warning' as const },
      {
        label: '可空字段',
        value: formatCount(tableNullableCount.value),
        hint: '需要关注约束',
        tone: 'neutral' as const
      },
      {
        label: '结构变更',
        value: formatCount(schemaChanges.value.length),
        hint: '当前表变更轨迹',
        tone: 'danger' as const
      }
    ];
  }
  if (level.value === 'schema') {
    return [
      {
        label: '数据表',
        value: formatCount(filteredTables.value.length),
        hint: '当前结构内对象',
        tone: 'primary' as const
      },
      { label: '视图数量', value: formatCount(schemaViewCount.value), hint: '视图与逻辑表', tone: 'warning' as const },
      {
        label: '估算行数',
        value: formatCompactCount(schemaEstimatedRows.value),
        hint: '来源于表属性',
        tone: 'success' as const
      },
      { label: '表级变更', value: formatCount(dbChanges.value.length), hint: '最近同步记录', tone: 'danger' as const }
    ];
  }
  if (level.value === 'database') {
    return [
      {
        label: 'Schema 数',
        value: formatCount(filteredSchemas.value.length),
        hint: '库内结构层级',
        tone: 'primary' as const
      },
      { label: '表规模', value: formatCount(summary.value?.tableCount), hint: '数据源汇总', tone: 'success' as const },
      {
        label: '变更记录',
        value: formatCount(schemaLevelChanges.value.length),
        hint: '结构层变更',
        tone: 'danger' as const
      },
      {
        label: '最近同步',
        value: formatDateTime(summary.value?.lastSyncTime),
        hint: '数据源级同步时间',
        tone: 'neutral' as const
      }
    ];
  }
  return [
    {
      label: '数据库',
      value: formatCount(filteredDatabases.value.length),
      hint: '已同步数据库节点',
      tone: 'primary' as const
    },
    { label: '数据表', value: formatCount(summary.value?.tableCount), hint: '全量目录规模', tone: 'success' as const },
    {
      label: '字段总数',
      value: formatCount(summary.value?.columnCount),
      hint: '已采集字段数',
      tone: 'neutral' as const
    },
    {
      label: '近 7 天变更',
      value: formatCount(summary.value?.recentChangeCount),
      hint: '结构波动情况',
      tone: 'danger' as const
    }
  ];
});

watch(dbSearch, () => {
  databasePage.value = 1;
});

watch(filteredDatabases, list => {
  const maxPage = Math.max(1, Math.ceil(list.length / databasePageSize.value));
  if (databasePage.value > maxPage) {
    databasePage.value = maxPage;
  }
});

watch(databasePageSize, () => {
  databasePage.value = 1;
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
    title: '序号',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '数据库',
    key: 'displayName',
    minWidth: 220,
    render: row => (
      <button
        type="button"
        class="m-0 w-full flex cursor-pointer appearance-none items-center gap-8px border-none bg-transparent p-0 text-left outline-none"
        onClick={() => openDatabase(row)}
        aria-label={`进入数据库 ${row.displayName}`}
      >
        <icon-mdi-database class="text-16px text-blue-500" />
        <span class="min-w-0 flex-1 truncate text-13px text-gray-800 font-semibold transition-colors dark:text-gray-100 hover:text-primary">
          {row.displayName}
        </span>
      </button>
    )
  },
  {
    title: '更新时间',
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
    title: '序号',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '结构',
    key: 'displayName',
    minWidth: 220,
    render: row => (
      <button
        type="button"
        class="m-0 w-full flex cursor-pointer appearance-none items-center gap-8px border-none bg-transparent p-0 text-left outline-none"
        onClick={() => openSchema(row)}
        aria-label={`进入结构 ${row.displayName}`}
      >
        <icon-mdi-layers-outline class="text-16px text-purple-500" />
        <span class="text-13px text-gray-800 font-semibold transition-colors dark:text-gray-100 hover:text-primary">
          {row.displayName}
        </span>
      </button>
    )
  },
  {
    title: '更新时间',
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
    title: '序号',
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
        <button
          type="button"
          class="m-0 w-full flex cursor-pointer appearance-none items-center gap-8px border-none bg-transparent p-0 text-left outline-none"
          onClick={() => openTable(row)}
          aria-label={`进入表 ${row.displayName}`}
        >
          {isView ? (
            <icon-mdi-eye-outline class="text-16px text-amber-500" />
          ) : (
            <icon-mdi-table class="text-16px text-teal-500" />
          )}
          <span class="text-13px text-gray-800 font-semibold transition-colors dark:text-gray-100 hover:text-primary">
            {row.displayName}
          </span>
          {isView && (
            <NTag size="small" bordered={false} class={getMetricTagClass('warning')}>
              {type}
            </NTag>
          )}
        </button>
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
    title: '序号',
    key: 'index',
    width: 48,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '字段',
    key: 'displayName',
    minWidth: 160,
    render: row => (
      <div class="flex items-center gap-8px">
        <icon-mdi-table-column class="text-16px text-cyan-500" />
        <span class="text-gray-800 font-semibold dark:text-gray-100">{row.displayName}</span>
      </div>
    )
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
          <icon-mdi-key-variant />
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
  <div class="explorer-page h-full flex-col-stretch gap-16px bg-[#f2f3f5] p-20px dark:bg-transparent">
    <div class="h-full flex-col-stretch gap-16px overflow-y-auto">
      <section
        class="relative shrink-0 overflow-hidden border border-gray-200 rounded-12px bg-white shadow-sm dark:border-gray-800 dark:bg-[#18181c]"
      >
        <NSpin :show="datasourceLoading" :size="16">
          <div class="relative z-1 grid gap-14px p-16px md:p-20px">
            <div class="grid gap-16px">
              <div class="flex flex-wrap items-center justify-between gap-16px">
                <NBreadcrumb class="explorer-breadcrumb">
                  <NBreadcrumbItem @click="navTo('list')">
                    <button type="button" class="explorer-crumb-button" aria-label="返回数据源列表">数据源列表</button>
                  </NBreadcrumbItem>
                  <NBreadcrumbItem v-if="datasourceId">
                    <button
                      type="button"
                      class="explorer-crumb-button flex items-center gap-4px"
                      :class="level === 'datasource' ? 'is-current' : ''"
                      :disabled="level === 'datasource'"
                      :aria-current="level === 'datasource' ? 'page' : undefined"
                      :aria-label="`进入数据源 ${datasource?.datasourceName ?? datasourceId}`"
                      @click="level !== 'datasource' && navTo('datasource')"
                    >
                      <icon-mdi-server-network class="text-14px text-orange-500" />
                      <NSkeleton v-if="datasourceLoading" text class="inline-block w-80px" />
                      <span v-else>{{ datasource?.datasourceName ?? datasourceId }}</span>
                    </button>
                  </NBreadcrumbItem>
                  <NBreadcrumbItem v-if="dbUuid">
                    <button
                      type="button"
                      class="explorer-crumb-button flex items-center gap-4px"
                      :class="level === 'database' ? 'is-current' : ''"
                      :disabled="level === 'database'"
                      :aria-current="level === 'database' ? 'page' : undefined"
                      :aria-label="`进入数据库 ${dbName}`"
                      @click="level !== 'database' && navTo('database')"
                    >
                      <icon-mdi-database class="text-14px text-blue-500" />
                      {{ dbName }}
                    </button>
                  </NBreadcrumbItem>
                  <NBreadcrumbItem v-if="schemaUuid">
                    <button
                      type="button"
                      class="explorer-crumb-button flex items-center gap-4px"
                      :class="level === 'schema' ? 'is-current' : ''"
                      :disabled="level === 'schema'"
                      :aria-current="level === 'schema' ? 'page' : undefined"
                      :aria-label="`进入结构 ${schemaName}`"
                      @click="level !== 'schema' && navTo('schema')"
                    >
                      <icon-mdi-layers-outline class="text-14px text-purple-500" />
                      {{ schemaName }}
                    </button>
                  </NBreadcrumbItem>
                  <NBreadcrumbItem v-if="tableUuid">
                    <span
                      class="flex items-center gap-4px text-gray-700 font-semibold dark:text-gray-200"
                      aria-current="page"
                    >
                      <icon-mdi-table class="text-14px text-teal-500" />
                      {{ tableName }}
                    </span>
                  </NBreadcrumbItem>
                </NBreadcrumb>

                <div
                  v-if="level === 'datasource' || level === 'table'"
                  class="flex flex-shrink-0 items-center gap-16px"
                >
                  <div v-if="level === 'datasource'" class="flex items-center gap-6px text-13px">
                    <NIcon size="16" class="text-gray-400"><div class="i-mdi-history" /></NIcon>
                    <span class="text-gray-500">最近同步：</span>
                    <span class="text-gray-800 font-medium dark:text-gray-200">
                      {{ formatDateTime(summary?.lastSyncTime) }}
                    </span>
                  </div>
                  <NButton
                    v-if="hasAuth('metadata:datasource:edit') && level === 'datasource'"
                    type="primary"
                    secondary
                    size="small"
                    :loading="refreshing"
                    @click="handleRefresh"
                  >
                    <template #icon>
                      <NIcon><div class="i-mdi-refresh" /></NIcon>
                    </template>
                    全量同步元数据
                  </NButton>
                  <NButton
                    v-if="hasAuth('metadata:datasource:edit') && level === 'table'"
                    type="warning"
                    secondary
                    size="small"
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

              <div class="flex items-start gap-14px">
                <div
                  class="h-64px w-64px flex flex-shrink-0 items-center justify-center rounded-12px from-gray-50 to-gray-100 bg-gradient-to-br shadow-sm ring-1 ring-gray-100 ring-inset dark:from-gray-800 dark:to-gray-900 dark:ring-gray-800"
                >
                  <img
                    :src="getDatasourceIcon(datasource?.datasourceType)"
                    :alt="datasource?.datasourceType"
                    class="h-38px w-38px object-contain"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-8px">
                    <h1 class="m-0 text-24px text-gray-800 font-bold leading-tight tracking-tight dark:text-gray-100">
                      {{ currentEntityTitle }}
                    </h1>
                    <NTag size="small" :bordered="false" round class="bg-primary/10 text-primary font-bold">
                      {{ currentEntityLabel }}
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
                  </div>
                  <p class="mt-8px max-w-[64ch] text-14px text-gray-500 leading-relaxed dark:text-gray-400">
                    {{ currentEntitySummary }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </NSpin>
      </section>

      <NGrid :x-gap="16" :y-gap="16" :cols="4" responsive="screen">
        <NGridItem v-for="stat in heroStats" :key="stat.label">
          <div
            class="group relative flex flex-col gap-6px overflow-hidden border border-t-2 border-gray-200 rounded-12px bg-white px-18px py-16px shadow-sm transition-all dark:border-gray-800 hover:border-primary/50 dark:bg-[#18181c] hover:shadow-md hover:-translate-y-1"
            :class="
              stat.tone === 'primary'
                ? 'border-t-blue-500'
                : stat.tone === 'success'
                  ? 'border-t-green-500'
                  : stat.tone === 'warning'
                    ? 'border-t-orange-500'
                    : stat.tone === 'danger'
                      ? 'border-t-red-500'
                      : 'border-t-gray-400'
            "
          >
            <span class="text-12px text-gray-400 font-medium leading-tight dark:text-gray-500">{{ stat.label }}</span>
            <div class="mt-2px flex items-baseline gap-4px">
              <strong
                class="text-24px text-gray-800 font-bold leading-none tracking-tight tabular-nums dark:text-gray-100"
              >
                {{ stat.value }}
              </strong>
            </div>
            <div class="mt-2px">
              <span :class="getToneClass(stat.tone)">{{ stat.hint }}</span>
            </div>
          </div>
        </NGridItem>
      </NGrid>

      <div class="explorer-body">
        <!-- ── Level 1: 数据源 → Tabs (数据库 / 概览) ── -->
        <template v-if="level === 'datasource'">
          <div
            class="explorer-surface explorer-tabs overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
          >
            <NTabs
              v-model:value="datasourceActiveTab"
              type="line"
              animated
              class="explorer-custom-tabs"
              pane-style="padding: 0"
              pane-wrapper-class="mt-16px"
            >
              <NTabPane name="databases">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">数据库</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': datasourceActiveTab === 'databases' }">
                      {{ filteredDatabases.length }}
                    </span>
                  </div>
                </template>

                <div
                  class="explorer-toolbar flex flex-col gap-12px border-b border-gray-100/80 px-20px py-16px md:flex-row md:items-center md:justify-between dark:border-gray-800"
                >
                  <div class="explorer-toolbar-summary text-13px text-gray-500">
                    已同步 {{ filteredDatabases.length }} 个数据库，可继续进入 schema、表和字段。
                  </div>
                  <div class="explorer-toolbar-actions">
                    <NInput
                      v-model:value="dbSearch"
                      size="small"
                      placeholder="搜索数据库"
                      clearable
                      class="explorer-search-input explorer-search-input--wide"
                    >
                      <template #prefix>
                        <NIcon class="text-gray-300"><div class="i-mdi-magnify" /></NIcon>
                      </template>
                    </NInput>
                  </div>
                </div>
                <div class="min-h-[300px] flex flex-col flex-1 justify-between gap-16px px-16px pt-16px">
                  <NSpin :show="listLoading" class="flex-1">
                    <template v-if="filteredDatabases.length || listLoading">
                      <div class="flex flex-col gap-16px">
                        <NDataTable
                          :columns="databaseColumns"
                          :data="pagedFilteredDatabases"
                          :single-line="false"
                          :pagination="false"
                          size="small"
                          striped
                          class="explorer-table explorer-database-table"
                        />
                        <div class="explorer-database-mobile-list hidden">
                          <button
                            v-for="db in pagedFilteredDatabases"
                            :key="db.uuid"
                            type="button"
                            class="explorer-database-card"
                            :aria-label="`进入数据库 ${db.displayName}`"
                            @click="openDatabase(db)"
                          >
                            <div class="explorer-database-card__header">
                              <div class="explorer-database-card__title-wrap">
                                <icon-mdi-database class="text-16px text-blue-500" />
                                <div class="min-w-0 flex-1">
                                  <div class="explorer-database-card__title">{{ db.displayName }}</div>
                                  <div class="explorer-database-card__meta">
                                    更新时间 {{ formatDateTime(db.updateTime ?? db.createTime) }}
                                  </div>
                                </div>
                              </div>
                              <NIcon class="explorer-database-card__arrow" :size="16">
                                <div class="i-mdi-chevron-right" />
                              </NIcon>
                            </div>
                            <p class="explorer-database-card__description">
                              {{ db.description || '暂无说明' }}
                            </p>
                          </button>
                        </div>
                      </div>
                    </template>
                    <NEmpty v-else-if="!listLoading" description="暂无数据库，请先执行全量同步元数据" class="py-80px">
                      <template #icon><icon-mdi-database-search-outline class="text-42px text-gray-300" /></template>
                    </NEmpty>
                  </NSpin>

                  <div
                    v-if="filteredDatabases.length || listLoading"
                    class="sticky bottom-0 z-10 mt-auto w-full flex shrink-0 justify-end border-t border-gray-100 rounded-b-12px bg-white pb-16px pt-12px dark:border-gray-800 dark:bg-[#1e1e24]"
                  >
                    <NPagination
                      v-model:page="databasePage"
                      v-model:page-size="databasePageSize"
                      :item-count="filteredDatabases.length"
                      show-size-picker
                      :page-sizes="[10, 20, 50, 100]"
                      show-quick-jumper
                    />
                  </div>
                </div>
              </NTabPane>

              <NTabPane name="overview">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">概览</span>
                  </div>
                </template>

                <div class="overview-intro border-b border-gray-100/80 px-20px py-16px dark:border-gray-800">
                  <div class="text-11px text-gray-400 tracking-wider uppercase">数据源详情</div>
                  <p class="mt-6px max-w-760px text-14px text-gray-500 leading-7 dark:text-gray-400">
                    {{ datasource?.remark || '这里保留连接、来源、管理与过滤配置等需要复核的核心信息。' }}
                  </p>
                </div>

                <div class="grid gap-18px p-20px xl:grid-cols-3">
                  <div
                    class="border border-gray-100 rounded-10px bg-white p-16px shadow-sm dark:border-gray-800 dark:bg-[#1e1e24]"
                  >
                    <div
                      class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-semibold dark:text-gray-200"
                    >
                      <NIcon size="15" class="text-gray-400"><div class="i-mdi-connection" /></NIcon>
                      连接信息
                    </div>
                    <NDescriptions
                      :column="1"
                      label-placement="left"
                      :label-style="{ width: '80px', color: '#9ca3af' }"
                      class="text-13px"
                    >
                      <NDescriptionsItem label="主机地址">{{ connParamsObj.host || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="端口">{{ connParamsObj.port || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="连接库">{{ connParamsObj.database || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="用户名">{{ connParamsObj.username || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="密码">
                        <div class="flex items-center gap-8px">
                          <span class="text-gray-800 font-mono dark:text-gray-200">{{ displayedPassword }}</span>
                          <NButton
                            quaternary
                            circle
                            size="tiny"
                            :aria-label="getPasswordToggleLabel()"
                            :title="getPasswordToggleLabel()"
                            @click="showPassword = !showPassword"
                          >
                            <template #icon>
                              <icon-mdi-eye-off-outline v-if="showPassword" />
                              <icon-mdi-eye-outline v-else />
                            </template>
                          </NButton>
                        </div>
                      </NDescriptionsItem>
                    </NDescriptions>
                  </div>

                  <div
                    class="border border-gray-100 rounded-10px bg-white p-16px shadow-sm dark:border-gray-800 dark:bg-[#1e1e24]"
                  >
                    <div
                      class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-semibold dark:text-gray-200"
                    >
                      <NIcon size="15" class="text-gray-400"><div class="i-mdi-domain" /></NIcon>
                      来源信息
                    </div>
                    <NDescriptions
                      :column="1"
                      label-placement="left"
                      :label-style="{ width: '90px', color: '#9ca3af' }"
                      class="text-13px"
                    >
                      <NDescriptionsItem label="机构编码">{{ datasource?.sourceOrgCode || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="机构名称">{{ datasource?.sourceOrgName || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="来源部门">{{ datasource?.sourceDept || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="来源类型">{{ datasource?.sourceType || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="来源系统">{{ datasource?.sourceSystem || '-' }}</NDescriptionsItem>
                    </NDescriptions>
                  </div>

                  <div
                    class="border border-gray-100 rounded-10px bg-white p-16px shadow-sm dark:border-gray-800 dark:bg-[#1e1e24]"
                  >
                    <div
                      class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-semibold dark:text-gray-200"
                    >
                      <NIcon size="15" class="text-gray-400"><div class="i-mdi-account-circle-outline" /></NIcon>
                      管理信息
                    </div>
                    <NDescriptions
                      :column="1"
                      label-placement="left"
                      :label-style="{ width: '80px', color: '#9ca3af' }"
                      class="text-13px"
                    >
                      <NDescriptionsItem label="联系人">{{ datasource?.contactPerson || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="联系电话">{{ datasource?.contactPhone || '-' }}</NDescriptionsItem>
                      <NDescriptionsItem label="备注">{{ datasource?.remark || '-' }}</NDescriptionsItem>
                    </NDescriptions>
                  </div>

                  <div
                    class="border border-gray-100 rounded-10px bg-white p-16px shadow-sm xl:col-span-3 dark:border-gray-800 dark:bg-[#1e1e24]"
                  >
                    <div
                      class="mb-12px flex items-center gap-8px text-13px text-gray-700 font-semibold dark:text-gray-200"
                    >
                      <NIcon size="15" class="text-amber-500"><div class="i-mdi-filter-variant" /></NIcon>
                      同步过滤规则
                    </div>

                    <div
                      v-if="filterSummary.activeRuleCount === 0"
                      class="rounded-12px bg-gray-50 px-14px py-12px text-13px text-gray-500 leading-6 dark:bg-[#24242b] dark:text-gray-400"
                    >
                      当前未配置过滤规则。全量同步时将纳入该数据源下全部可见对象。
                    </div>

                    <div v-else class="grid gap-12px text-13px md:grid-cols-2">
                      <div class="rounded-12px bg-amber-50/70 px-14px py-12px dark:bg-amber-900/10">
                        <div class="mb-6px text-12px text-amber-700 font-semibold dark:text-amber-300">Schema 过滤</div>
                        <div class="flex flex-col gap-8px">
                          <div class="flex items-start justify-between gap-12px">
                            <span class="text-gray-400">includes</span>
                            <span class="explorer-detail-value text-right text-gray-800 leading-6 dark:text-gray-200">
                              {{ filterSummary.schemaIncludes.join(' , ') || '-' }}
                            </span>
                          </div>
                          <div class="flex items-start justify-between gap-12px">
                            <span class="text-gray-400">excludes</span>
                            <span class="explorer-detail-value text-right text-gray-800 leading-6 dark:text-gray-200">
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
                            <span class="explorer-detail-value text-right text-gray-800 leading-6 dark:text-gray-200">
                              {{ filterSummary.tableIncludes.join(' , ') || '-' }}
                            </span>
                          </div>
                          <div class="flex items-start justify-between gap-12px">
                            <span class="text-gray-400">excludes</span>
                            <span class="explorer-detail-value text-right text-gray-800 leading-6 dark:text-gray-200">
                              {{ filterSummary.tableExcludes.join(' , ') || '-' }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
            <NTabs
              v-model:value="dbActiveTab"
              type="line"
              animated
              class="explorer-custom-tabs"
              pane-style="padding: 0"
              pane-wrapper-class="mt-16px"
            >
              <NTabPane name="schemas">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">数据库结构</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': dbActiveTab === 'schemas' }">
                      {{ filteredSchemas.length }}
                    </span>
                  </div>
                </template>
                <div class="explorer-search-row border-b border-gray-100/80 px-20px py-10px dark:border-gray-800">
                  <NInput
                    v-model:value="schemaSearch"
                    size="small"
                    placeholder="搜索数据库结构"
                    clearable
                    class="explorer-search-input"
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
                  <NEmpty
                    v-else-if="!listLoading"
                    description="暂无数据库结构，请先执行全量同步元数据"
                    class="py-60px"
                  />
                </NSpin>
              </NTabPane>

              <NTabPane name="profile">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <NIcon :size="16"><div class="i-mdi-chart-box-outline" /></NIcon>
                    <span class="font-medium">概览</span>
                  </div>
                </template>
                <DatabaseProfileTab :database-uuid="dbUuid ?? ''" :database-name="dbName ?? ''" />
              </NTabPane>

              <NTabPane name="changes">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">变更记录</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': dbActiveTab === 'changes' }">
                      {{ schemaLevelChanges.length }}
                    </span>
                  </div>
                </template>
                <div class="explorer-record-panel">
                  <ChangeTimeline
                    :records="schemaLevelChanges"
                    :loading="listLoading"
                    empty-description="暂无变更记录"
                  />
                </div>
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
              animated
              class="explorer-custom-tabs"
              pane-style="padding: 0"
              pane-wrapper-class="mt-16px"
            >
              <NTabPane name="tables">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">数据表</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': schemaActiveTab === 'tables' }">
                      {{ filteredTables.length }}
                    </span>
                  </div>
                </template>
                <div class="explorer-search-row border-b border-gray-100/80 px-20px py-10px dark:border-gray-800">
                  <NInput
                    v-model:value="tableSearch"
                    size="small"
                    placeholder="搜索表名"
                    clearable
                    class="explorer-search-input"
                  >
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
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">变更记录</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': schemaActiveTab === 'changes' }">
                      {{ dbChanges.length }}
                    </span>
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
            <NTabs
              v-model:value="activeTab"
              type="line"
              animated
              class="explorer-custom-tabs"
              pane-style="padding: 0"
              pane-wrapper-class="mt-16px"
            >
              <NTabPane name="columns">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">字段列表</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': activeTab === 'columns' }">
                      {{ columns.length }}
                    </span>
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
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <span class="text-14px font-medium">变更记录</span>
                    <span class="explorer-count-pill" :class="{ 'is-active': activeTab === 'changes' }">
                      {{ schemaChanges.length }}
                    </span>
                  </div>
                </template>
                <div class="explorer-record-panel">
                  <ChangeTimeline :records="schemaChanges" :loading="listLoading" empty-description="暂无变更记录" />
                </div>
              </NTabPane>

              <NTabPane name="profile">
                <template #tab>
                  <div class="flex items-center gap-6px px-4px py-2px">
                    <NIcon :size="16"><div class="i-mdi-chart-box-outline" /></NIcon>
                    <span class="font-medium">概览</span>
                  </div>
                </template>
                <ProfileTab :table-uuid="tableUuid ?? ''" :columns="columns" />
              </NTabPane>
            </NTabs>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explorer-page {
  --explorer-page-bg: linear-gradient(180deg, rgb(var(--container-bg-color) / 0.5), rgb(var(--layout-bg-color)));
  --explorer-surface-bg: rgb(var(--container-bg-color) / 0.96);
  --explorer-surface-bg-soft: rgb(var(--container-bg-color) / 0.88);
  --explorer-panel-border: rgb(var(--primary-100-color) / 0.68);
  --explorer-panel-border-strong: rgb(var(--primary-100-color) / 0.76);
  --explorer-panel-shadow: 0 4px 14px rgb(var(--primary-950-color) / 0.028), 0 1px 0 rgb(255 255 255 / 0.8) inset;
  --explorer-panel-shadow-soft: 0 2px 10px rgb(var(--primary-950-color) / 0.02), 0 1px 0 rgb(255 255 255 / 0.76) inset;
  --explorer-panel-shadow-card: 0 2px 8px rgb(var(--primary-950-color) / 0.02);
  --explorer-text-main: rgb(var(--base-text-color));
  --explorer-text-secondary: rgb(var(--base-text-color) / 0.9);
  --explorer-text-tertiary: rgb(var(--base-text-color) / 0.78);
  --explorer-text-quaternary: rgb(var(--base-text-color) / 0.68);
  --explorer-hero-bg: linear-gradient(180deg, rgb(var(--container-bg-color) / 0.98), rgb(var(--layout-bg-color) / 0.9));
  --explorer-icon-bg: linear-gradient(
    145deg,
    rgb(var(--container-bg-color) / 0.98),
    rgb(var(--primary-50-color) / 0.64)
  );
  --explorer-chip-neutral-bg: rgb(var(--primary-50-color) / 0.92);
  --explorer-chip-neutral-text: rgb(var(--base-text-color) / 0.62);
  --explorer-chip-primary-bg: rgb(var(--primary-100-color) / 0.96);
  --explorer-chip-primary-text: rgb(var(--primary-700-color));
  --explorer-chip-success-bg: rgb(var(--success-100-color) / 0.96);
  --explorer-chip-success-text: rgb(var(--success-700-color));
  --explorer-chip-warning-bg: rgb(var(--warning-100-color) / 0.98);
  --explorer-chip-warning-text: rgb(var(--warning-700-color));
  --explorer-chip-danger-bg: rgb(var(--error-100-color) / 0.98);
  --explorer-chip-danger-text: rgb(var(--error-700-color));
  --explorer-toolbar-bg: linear-gradient(
    180deg,
    rgb(var(--primary-50-color) / 0.42),
    rgb(var(--container-bg-color) / 0.82)
  );
  --explorer-record-bg: linear-gradient(
    180deg,
    rgb(var(--primary-50-color) / 0.44),
    rgb(var(--container-bg-color) / 0.96)
  );
  --explorer-tab-hover: rgb(var(--primary-color) / 0.05);
  --explorer-tab-active: rgb(var(--primary-color) / 0.08);
  --explorer-table-hover: rgb(var(--primary-color) / 0.03);
}

.explorer-hero {
  position: relative;
  box-shadow: var(--explorer-panel-shadow);
}

.explorer-hero__corner {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
}

.explorer-hero__corner-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.explorer-hero__sync-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
}

.explorer-hero__sync-label {
  color: var(--explorer-text-quaternary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.explorer-hero__sync-value {
  color: var(--explorer-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.explorer-hero__content,
.explorer-hero__stats {
  position: absolute;
  z-index: 1;
}

.explorer-hero__content {
  position: relative;
  display: grid;
  gap: 14px;
  padding: 16px 16px 14px;
}

.explorer-hero__headline {
  display: grid;
  gap: 12px;
}

.explorer-breadcrumb {
  color: var(--explorer-text-tertiary);
}

.explorer-crumb-button,
.explorer-link-button {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.explorer-crumb-button {
  color: inherit;
  transition:
    color 140ms ease,
    box-shadow 140ms ease;
}

.explorer-crumb-button:hover:not(:disabled) {
  color: var(--n-primary-color);
}

.explorer-crumb-button.is-current,
.explorer-crumb-button:disabled {
  cursor: default;
  color: var(--explorer-text-main);
  font-weight: 600;
}

.explorer-link-button {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  transition:
    color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease;
}

.explorer-link-button:hover span:last-child {
  color: var(--n-primary-color);
}

.explorer-link-button:hover {
  background: rgb(var(--primary-color) / 0.04);
}

.explorer-entity-icon {
  display: flex;
  height: 32px;
  width: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgb(var(--primary-50-color) / 0.78);
}

.explorer-entity-icon__glyph {
  color: rgb(var(--primary-600-color));
}

.explorer-crumb-button:focus-visible,
.explorer-link-button:focus-visible {
  outline: none;
  border-radius: 10px;
  box-shadow:
    0 0 0 2px rgb(var(--container-bg-color) / 0.9),
    0 0 0 4px rgb(var(--primary-color) / 0.55);
}

.explorer-hero__heading-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.explorer-hero__icon-wrap {
  display: flex;
  height: 64px;
  width: 64px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--explorer-icon-bg);
  box-shadow:
    0 3px 10px rgb(var(--primary-color) / 0.06),
    0 1px 0 rgb(255 255 255 / 0.76) inset;
}

.explorer-title {
  margin: 0;
  color: var(--explorer-text-main);
  font-size: clamp(1.45rem, 1.16rem + 0.78vw, 2rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.12;
}

.explorer-kind-tag {
  background: rgb(var(--primary-100-color) / 0.7);
  color: rgb(var(--base-text-color) / 0.8);
  font-weight: 700;
}

.explorer-subtitle {
  max-width: 64ch;
  margin: 8px 0 0;
  color: var(--explorer-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.explorer-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.explorer-hero__stats {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 0 16px 16px;
  grid-template-columns: repeat(var(--explorer-hero-stat-columns, 3), minmax(0, 1fr));
}

.explorer-stat-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--explorer-panel-border);
  border-radius: 12px;
  background: var(--explorer-surface-bg);
  box-shadow: var(--explorer-panel-shadow-card);
}

.explorer-stat-card__label {
  color: var(--explorer-text-tertiary);
  font-size: 12px;
  font-weight: 600;
}

.explorer-stat-card__value {
  color: var(--explorer-text-main);
  font-size: clamp(1.1rem, 0.95rem + 0.45vw, 1.55rem);
  font-weight: 700;
  line-height: 1.2;
}

.explorer-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.explorer-chip--neutral {
  background: var(--explorer-chip-neutral-bg);
  color: var(--explorer-chip-neutral-text);
}

.explorer-chip--primary {
  background: var(--explorer-chip-primary-bg);
  color: var(--explorer-chip-primary-text);
}

.explorer-chip--success {
  background: var(--explorer-chip-success-bg);
  color: var(--explorer-chip-success-text);
}

.explorer-chip--warning {
  background: var(--explorer-chip-warning-bg);
  color: var(--explorer-chip-warning-text);
}

.explorer-chip--danger {
  background: var(--explorer-chip-danger-bg);
  color: var(--explorer-chip-danger-text);
}

.explorer-body {
  display: grid;
  gap: 16px;
}

.explorer-detail-value {
  max-width: min(100%, 22rem);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.explorer-surface {
  box-shadow:
    0 2px 10px rgb(var(--primary-950-color) / 0.02),
    0 1px 0 rgb(255 255 255 / 0.74) inset;
}

.overview-intro {
  background: linear-gradient(180deg, rgb(var(--primary-50-color) / 0.32), transparent);
}

.overview-detail-card {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.overview-detail-card:hover {
  transform: none;
  box-shadow: var(--explorer-panel-shadow-soft);
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
  background: var(--explorer-pill-bg, rgb(var(--primary-200-color) / 0.18));
  color: var(--explorer-pill-text, var(--explorer-text-secondary));
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  transition: all 0.2s ease;
}

.explorer-count-pill.is-active {
  --explorer-pill-bg: rgb(var(--primary-color));
  --explorer-pill-text: #ffffff;
}

.explorer-custom-tabs :deep(.n-tabs-nav) {
  padding: 10px 20px 0;
}

.explorer-custom-tabs :deep(.n-tabs-nav-scroll-content) {
  border-bottom: 1px solid rgb(var(--primary-100-color) / 0.5);
}

.explorer-custom-tabs :deep(.n-tabs-tab) {
  padding: 8px 16px 12px;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s ease;
}

.explorer-custom-tabs :deep(.n-tabs-tab:hover) {
  background: var(--explorer-tab-hover);
}

.explorer-custom-tabs :deep(.n-tabs-bar) {
  height: 3px;
  border-radius: 3px 3px 0 0;
}

.explorer-record-panel {
  padding: 14px 16px 18px;
  background: var(--explorer-record-bg);
}

.explorer-record-table {
  overflow: hidden;
  border: 1px solid var(--explorer-panel-border);
  border-radius: 16px;
  background: rgb(var(--container-bg-color) / 0.96);
  box-shadow:
    0 16px 30px rgb(var(--primary-950-color) / 0.04),
    0 1px 0 rgb(255 255 255 / 0.9) inset;
}

.explorer-record-empty {
  border: 1px dashed var(--explorer-panel-border);
  border-radius: 16px;
  background: rgb(var(--primary-50-color) / 0.75);
}

.explorer-toolbar {
  background: var(--explorer-toolbar-bg);
}

.explorer-toolbar-summary {
  flex: 1 1 18rem;
  min-width: 0;
  line-height: 1.6;
}

.explorer-toolbar-actions {
  display: flex;
  flex: 0 1 20rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.explorer-search-row {
  display: flex;
  justify-content: flex-end;
}

.explorer-search-input {
  width: min(100%, 18rem);
  min-width: 0;
}

.explorer-search-input--wide {
  width: min(100%, 20rem);
}

.explorer-page :is(.text-gray-500, .dark\:text-gray-400) {
  color: var(--explorer-text-tertiary);
}

.explorer-page :is(.text-gray-400, .dark\:text-gray-300) {
  color: var(--explorer-text-quaternary);
}

.explorer-page :is(.text-gray-300, .dark\:text-gray-200) {
  color: rgb(var(--base-text-color) / 0.54);
}

.explorer-page :is(.text-gray-600, .dark\:text-gray-100) {
  color: var(--explorer-text-secondary);
}

.overview-detail-card {
  padding: 20px;
}

.overview-detail-card .text-gray-400,
.overview-intro .text-gray-400,
.explorer-toolbar .text-gray-400,
.explorer-search-row .text-gray-300 {
  color: var(--explorer-text-tertiary);
}

.overview-detail-card .text-gray-800,
.overview-detail-card .dark\:text-gray-200,
.explorer-toolbar .text-gray-900,
.explorer-toolbar .dark\:text-gray-50 {
  color: var(--explorer-text-main);
}

.explorer-toolbar .text-gray-500,
.overview-intro .text-gray-500 {
  color: var(--explorer-text-secondary);
}

.explorer-table :deep(.n-data-table-wrapper) {
  border-radius: 12px;
}

.explorer-table :deep(th) {
  background: rgb(var(--primary-50-color) / 0.96);
  color: var(--explorer-text-secondary);
  font-weight: 600;
}

.explorer-table :deep(.n-data-table-td) {
  transition: background-color 140ms ease;
}

.explorer-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: var(--explorer-table-hover);
}

.explorer-table :deep(.text-gray-300) {
  color: rgb(var(--base-text-color) / 0.44);
}

.explorer-table :deep(.text-gray-400) {
  color: var(--explorer-text-tertiary);
}

.explorer-table :deep(.text-gray-600),
.explorer-table :deep(.dark\:text-gray-300),
.explorer-table :deep(.dark\:text-gray-100) {
  color: var(--explorer-text-secondary);
}

.explorer-database-mobile-list {
  display: none;
}

.explorer-database-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 8px 6px;
}

.explorer-database-card {
  width: 100%;
  border: 1px solid var(--explorer-panel-border);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 12px;
  background: var(--explorer-surface-bg);
  padding: 14px;
  text-align: left;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease;
}

.explorer-database-card:hover {
  border-color: rgb(var(--primary-color) / 0.24);
  box-shadow: var(--explorer-panel-shadow-soft);
}

.explorer-database-card:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px rgb(var(--container-bg-color) / 0.9),
    0 0 0 4px rgb(var(--primary-color) / 0.45);
}

.explorer-database-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.explorer-database-card__title-wrap {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 10px;
}

.explorer-database-card__icon {
  display: flex;
  height: 36px;
  width: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgb(var(--primary-50-color) / 0.78);
}

.explorer-database-card__title {
  color: var(--explorer-text-main);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.explorer-database-card__meta {
  margin-top: 3px;
  color: var(--explorer-text-tertiary);
  font-size: 12px;
  line-height: 1.45;
}

.explorer-database-card__arrow {
  margin-top: 2px;
  flex-shrink: 0;
  color: var(--explorer-text-tertiary);
}

.explorer-database-card__description {
  margin: 12px 0 0;
  color: var(--explorer-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metric-tag {
  border-radius: 999px;
  padding-inline: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.metric-tag.metric-tag--neutral {
  background: rgb(var(--primary-50-color));
  color: var(--explorer-text-tertiary);
}

.metric-tag.metric-tag--primary {
  background: rgb(var(--primary-100-color));
  color: rgb(var(--primary-700-color));
}

.metric-tag.metric-tag--info {
  background: rgb(var(--info-100-color));
  color: rgb(var(--info-700-color));
}

.metric-tag.metric-tag--success {
  background: rgb(var(--success-100-color));
  color: rgb(var(--success-700-color));
}

.metric-tag.metric-tag--warning {
  background: rgb(var(--warning-100-color));
  color: rgb(var(--warning-700-color));
}

.metric-tag.metric-tag--error {
  background: rgb(var(--error-100-color));
  color: rgb(var(--error-700-color));
}

.dark .explorer-page {
  --explorer-page-bg: linear-gradient(180deg, rgb(var(--layout-bg-color) / 0.9), rgb(var(--layout-bg-color)));
  --explorer-surface-bg: rgb(var(--container-bg-color) / 0.76);
  --explorer-surface-bg-soft: rgb(var(--container-bg-color) / 0.72);
  --explorer-panel-border: rgb(var(--primary-700-color) / 0.3);
  --explorer-panel-border-strong: rgb(var(--primary-700-color) / 0.3);
  --explorer-panel-shadow: 0 6px 18px rgb(0 0 0 / 0.14), 0 1px 0 rgb(255 255 255 / 0.03) inset;
  --explorer-panel-shadow-soft: 0 3px 12px rgb(0 0 0 / 0.12), 0 1px 0 rgb(255 255 255 / 0.03) inset;
  --explorer-panel-shadow-card: 0 2px 10px rgb(0 0 0 / 0.1);
  --explorer-text-main: rgb(var(--base-text-color));
  --explorer-text-secondary: rgb(var(--base-text-color) / 0.92);
  --explorer-text-tertiary: rgb(var(--base-text-color) / 0.82);
  --explorer-text-quaternary: rgb(var(--base-text-color) / 0.72);
  --explorer-hero-bg: linear-gradient(
    180deg,
    rgb(var(--container-bg-color) / 0.94),
    rgb(var(--layout-bg-color) / 0.96)
  );
  --explorer-icon-bg: linear-gradient(
    145deg,
    rgb(var(--container-bg-color) / 0.9),
    rgb(var(--primary-900-color) / 0.22)
  );
  --explorer-chip-neutral-bg: rgb(var(--primary-900-color) / 0.5);
  --explorer-chip-neutral-text: rgb(var(--base-text-color) / 0.68);
  --explorer-chip-primary-bg: rgb(var(--primary-700-color) / 0.28);
  --explorer-chip-primary-text: rgb(var(--primary-100-color));
  --explorer-chip-success-bg: rgb(var(--success-700-color) / 0.24);
  --explorer-chip-success-text: rgb(var(--success-100-color));
  --explorer-chip-warning-bg: rgb(var(--warning-700-color) / 0.24);
  --explorer-chip-warning-text: rgb(var(--warning-100-color));
  --explorer-chip-danger-bg: rgb(var(--error-700-color) / 0.24);
  --explorer-chip-danger-text: rgb(var(--error-100-color));
  --explorer-toolbar-bg: linear-gradient(
    180deg,
    rgb(var(--container-bg-color) / 0.84),
    rgb(var(--layout-bg-color) / 0.58)
  );
  --explorer-record-bg: linear-gradient(
    180deg,
    rgb(var(--container-bg-color) / 0.76),
    rgb(var(--layout-bg-color) / 0.96)
  );
  --explorer-tab-hover: rgb(var(--primary-color) / 0.08);
  --explorer-tab-active: rgb(var(--primary-color) / 0.12);
  --explorer-table-hover: rgb(var(--primary-color) / 0.08);
}

.dark .explorer-hero {
  box-shadow: var(--explorer-panel-shadow);
}

.dark .explorer-table :deep(th) {
  background: rgb(var(--container-bg-color) / 0.92);
  color: var(--explorer-text-tertiary);
}

.dark .explorer-custom-tabs :deep(.n-tabs-nav-scroll-content) {
  border-bottom: 1px solid rgb(var(--primary-700-color) / 0.3);
}

.dark .explorer-count-pill {
  --explorer-pill-bg: rgb(var(--primary-700-color) / 0.28);
  --explorer-pill-text: var(--explorer-text-main);
}

.dark .explorer-count-pill.is-active {
  --explorer-pill-text: #ffffff;
}

.dark .explorer-record-panel {
  background: var(--explorer-record-bg);
}

.dark .explorer-record-table {
  border-color: var(--explorer-panel-border);
  background: rgb(var(--container-bg-color) / 0.92);
  box-shadow:
    0 18px 34px rgb(0 0 0 / 0.2),
    0 1px 0 rgb(255 255 255 / 0.03) inset;
}

.dark .explorer-record-empty {
  border-color: var(--explorer-panel-border);
  background: rgb(var(--container-bg-color) / 0.76);
}

.dark .explorer-toolbar {
  background: var(--explorer-toolbar-bg);
}

.dark .explorer-entity-icon,
.dark .explorer-database-card__icon {
  background: rgb(var(--primary-900-color) / 0.34);
}

.dark .explorer-entity-icon__glyph {
  color: rgb(var(--primary-100-color));
}

.dark .metric-tag.metric-tag--neutral {
  background: rgb(var(--primary-900-color) / 0.72);
  color: var(--explorer-text-tertiary);
}

.dark .metric-tag.metric-tag--primary {
  background: rgb(var(--primary-700-color) / 0.28);
  color: rgb(var(--primary-100-color));
}

.dark .metric-tag.metric-tag--info {
  background: rgb(var(--info-700-color) / 0.24);
  color: rgb(var(--info-100-color));
}

.dark .metric-tag.metric-tag--success {
  background: rgb(var(--success-700-color) / 0.24);
  color: rgb(var(--success-100-color));
}

.dark .metric-tag.metric-tag--warning {
  background: rgb(var(--warning-700-color) / 0.24);
  color: rgb(var(--warning-100-color));
}

.dark .metric-tag.metric-tag--error {
  background: rgb(var(--error-700-color) / 0.24);
  color: rgb(var(--error-100-color));
}

@media (prefers-reduced-motion: reduce) {
  .overview-detail-card,
  .explorer-crumb-button,
  .explorer-link-button,
  .explorer-table :deep(.n-data-table-td) {
    transition: none !important;
  }

  .overview-detail-card:hover {
    transform: none;
  }
}

@media (max-width: 1023px) {
  .explorer-hero__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .explorer-shell {
    gap: 16px;
  }

  .explorer-hero__corner {
    position: static;
    padding: 14px 14px 0;
  }

  .explorer-hero__corner-stack {
    align-items: stretch;
  }

  .explorer-hero__sync-meta {
    align-items: flex-start;
    text-align: left;
  }

  .explorer-hero__corner :deep(.n-button) {
    width: 100%;
  }

  .explorer-hero__content,
  .explorer-hero__stats {
    padding-left: 14px;
    padding-right: 14px;
  }

  .explorer-hero__content {
    padding-top: 14px;
  }

  .explorer-hero__heading-row {
    flex-direction: column;
  }

  .explorer-hero__icon-wrap {
    height: 56px;
    width: 56px;
    border-radius: 12px;
  }

  .explorer-hero__stats {
    grid-template-columns: 1fr;
  }

  .explorer-database-table {
    display: none;
  }

  .explorer-database-mobile-list {
    display: grid;
    gap: 10px;
  }

  .explorer-database-pagination {
    justify-content: center;
    padding: 12px 0 4px;
  }

  .explorer-database-pagination :deep(.n-pagination) {
    justify-content: center;
    flex-wrap: wrap;
  }

  .explorer-toolbar-actions,
  .explorer-search-row {
    align-items: flex-start;
  }

  .explorer-search-input,
  .explorer-search-input--wide {
    width: 100%;
  }

  .explorer-detail-value {
    max-width: 100%;
    text-align: left;
  }
}

@media (max-width: 639px) {
  .explorer-database-card {
    padding: 12px;
  }

  .overview-detail-card > div:last-child > div {
    grid-template-columns: 1fr;
  }

  .overview-detail-card .flex.items-start.justify-between {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
