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
import {
  fetchGetDatasource,
  fetchGetDatasourceSummary,
  fetchRefreshDatasource
} from '@/service/api/metadata/datasource';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';
import { useAuth } from '@/hooks/business/auth';
import { getDatasourceIcon } from '@/utils/datasourceIcon';
import ProfileTab from './modules/ProfileTab.vue';

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

const dbSearch = ref('');
const schemaSearch = ref('');
const tableSearch = ref('');
const activeTab = ref('columns');
const dbActiveTab = ref('schemas');
const datasourceActiveTab = ref('databases');
const schemaActiveTab = ref('tables');

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
    return new Date(dt).toLocaleString('zh-CN');
  } catch {
    return dt;
  }
}

type ChangeTagType = 'default' | 'error' | 'success' | 'warning' | 'info';

interface ChangeTypeInfo {
  text: string;
  type: ChangeTagType;
}

interface NormalizedChange {
  level: string;
  normalized: string;
}

function normalizeChange(row: Api.Metadata.SchemaChange): NormalizedChange {
  return {
    normalized: String(row.changeType || '')
      .trim()
      .toUpperCase()
      .replaceAll('-', '_')
      .replaceAll(' ', '_'),
    level: String(row.entityLevel || '')
      .trim()
      .toLowerCase()
  };
}

function matchesAny(normalized: string, keywords: string[]): boolean {
  return keywords.some(keyword => normalized.includes(keyword));
}

function resolveLevelChange(levelName: string, normalized: string): ChangeTypeInfo | null {
  const levelMap: Record<string, ChangeTypeInfo[]> = {
    column: [
      { text: '字段注释变更', type: 'warning' },
      { text: '字段类型变更', type: 'warning' },
      { text: '字段新增', type: 'success' },
      { text: '字段删除', type: 'error' }
    ],
    table: [
      { text: '表注释变更', type: 'warning' },
      { text: '表属性变更', type: 'info' },
      { text: '表新增', type: 'success' },
      { text: '表删除', type: 'error' }
    ],
    schema: [
      { text: 'Schema注释变更', type: 'warning' },
      { text: 'Schema新增', type: 'success' },
      { text: 'Schema删除', type: 'error' }
    ],
    database: [
      { text: '数据库注释变更', type: 'warning' },
      { text: '数据库新增', type: 'success' },
      { text: '数据库删除', type: 'error' }
    ]
  };
  const keywordMap: Record<string, string[][]> = {
    column: [
      ['COMMENT', 'CHANGE'],
      ['TYPE', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ],
    table: [['COMMENT', 'CHANGE'], ['PROPERTY'], ['ADD', 'CREATE'], ['DROP', 'DELETE', 'REMOVE']],
    schema: [
      ['COMMENT', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ],
    database: [
      ['COMMENT', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ]
  };
  const infos = levelMap[levelName];
  const keywords = keywordMap[levelName];
  if (!infos || !keywords) {
    return null;
  }
  const matchIndex = keywords.findIndex(group => matchesAny(normalized, group));
  return matchIndex >= 0 ? infos[matchIndex] : null;
}

function resolveGenericChange(normalized: string): ChangeTypeInfo {
  const rules: Array<{ keywords: string[]; info: ChangeTypeInfo }> = [
    { keywords: ['COMMENT', 'CHANGE'], info: { text: '注释变更', type: 'warning' } },
    { keywords: ['PROPERTY'], info: { text: '属性变更', type: 'info' } },
    { keywords: ['TYPE', 'CHANGE'], info: { text: '类型变更', type: 'warning' } },
    { keywords: ['ADD', 'CREATE'], info: { text: '新增', type: 'success' } },
    { keywords: ['DROP', 'DELETE', 'REMOVE'], info: { text: '删除', type: 'error' } },
    { keywords: ['MODIFY', 'ALTER', 'CHANGE'], info: { text: '变更', type: 'warning' } }
  ];
  const matchedRule = rules.find(rule => matchesAny(normalized, rule.keywords));
  return matchedRule?.info ?? { text: normalized, type: 'default' };
}

function getChangeTypeInfo(row: Api.Metadata.SchemaChange): {
  text: string;
  type: ChangeTagType;
} {
  const change = normalizeChange(row);
  return (
    resolveLevelChange(change.level, change.normalized) ??
    resolveGenericChange(change.normalized) ?? { text: row.changeType, type: 'default' }
  );
}

const connParamsObj = computed(() => {
  if (!datasource.value?.connParams) return {};
  return parseProps(datasource.value.connParams);
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
  window.$message?.success('刷新已触发，元数据将在后台同步');
  if (level.value === 'datasource') loadDatabases();
  else if (level.value === 'database') loadSchemas();
  else if (level.value === 'schema') loadTables();
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
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '数据库名',
    key: 'displayName',
    render: row => (
      <div class="flex cursor-pointer items-center gap-8px" onClick={() => openDatabase(row)}>
        <div class="h-28px w-28px flex-center flex-shrink-0 rounded-6px from-blue-50 to-blue-100/60 bg-gradient-to-br dark:from-blue-900/20 dark:to-blue-800/10">
          <NIcon size={14} class="text-blue-500">
            <div class="i-mdi-database" />
          </NIcon>
        </div>
        <span class="text-13px text-gray-800 font-medium dark:text-gray-200 hover:text-primary hover:underline">
          {row.displayName}
        </span>
      </div>
    )
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 170,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{new Date(t).toLocaleString('zh-CN')}</span>
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
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '结构名',
    key: 'displayName',
    render: row => (
      <div class="flex cursor-pointer items-center gap-8px" onClick={() => openSchema(row)}>
        <div class="h-28px w-28px flex-center flex-shrink-0 rounded-6px from-purple-50 to-purple-100/60 bg-gradient-to-br dark:from-purple-900/20 dark:to-purple-800/10">
          <NIcon size={14} class="text-purple-500">
            <div class="i-mdi-layers-outline" />
          </NIcon>
        </div>
        <span class="text-13px text-gray-800 font-medium dark:text-gray-200 hover:text-primary hover:underline">
          {row.displayName}
        </span>
      </div>
    )
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 170,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{new Date(t).toLocaleString('zh-CN')}</span>
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
    width: 52,
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
          <span class="text-13px text-gray-800 font-medium dark:text-gray-200 hover:text-primary hover:underline">
            {row.displayName}
          </span>
          {isView && (
            <NTag size="tiny" bordered={false} type="warning">
              {type}
            </NTag>
          )}
        </div>
      );
    }
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || <span class="text-gray-300">-</span>
  },
  {
    title: '字段数',
    key: 'columnCount',
    width: 80,
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
    title: '数据量',
    key: 'tableRows',
    width: 100,
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
    title: '更新时间',
    key: 'updateTime',
    width: 170,
    render: row => {
      const t = row.updateTime ?? row.createTime;
      return t ? (
        <span class="text-12px text-gray-400 tabular-nums">{new Date(t).toLocaleString('zh-CN')}</span>
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
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
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
    width: 60,
    align: 'center',
    render: row => {
      const p = parseProps(row.properties);
      const isNullable = p.nullable === true || p.nullable === 'true' || p.nullable === '1' || p.nullable === 1;
      return (
        <NTag size="tiny" bordered={false} type={isNullable ? 'default' : 'error'}>
          {isNullable ? 'YES' : 'NO'}
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
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '变更类型',
    key: 'changeType',
    width: 110,
    render: row => {
      const t = getChangeTypeInfo(row);
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

const schemaLevelChangeColumns: DataTableColumns<Api.Metadata.SchemaChange> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '变更类型',
    key: 'changeType',
    width: 110,
    render: row => {
      const t = getChangeTypeInfo(row);
      return (
        <NTag size="small" type={t.type} bordered={false}>
          {t.text}
        </NTag>
      );
    }
  },
  {
    title: '数据库结构',
    key: 'schemaName',
    render: row => <span class="font-medium">{row.databaseName ? `${row.databaseName}` : '-'}</span>
  },
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

const changeColumns: DataTableColumns<Api.Metadata.SchemaChange> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => <span class="text-12px text-gray-400 tabular-nums">{index + 1}</span>
  },
  {
    title: '变更类型',
    key: 'changeType',
    width: 120,
    render: row => {
      const t = getChangeTypeInfo(row);
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
  <div class="h-full flex flex-col bg-[#f7f8fa] dark:bg-[#101014]">
    <!-- ══ 顶部面包屑 ══ -->
    <div
      class="flex-shrink-0 border-b border-gray-200/60 bg-white px-24px py-10px dark:border-gray-800 dark:bg-[#18181c]"
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
      class="flex-shrink-0 border-b border-gray-200/60 from-white to-gray-50/80 bg-gradient-to-r px-24px py-20px dark:border-gray-800 dark:from-[#18181c] dark:to-[#1a1a20]"
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
                  :type="datasource.status === '0' ? 'success' : 'error'"
                  round
                >
                  <template #icon>
                    <div
                      class="mr-2px h-6px w-6px rounded-full"
                      :class="datasource.status === '0' ? 'bg-green-500' : 'bg-red-500'"
                    />
                  </template>
                  {{ datasource.status === '0' ? '运行中' : '已停用' }}
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
                  <NIcon :size="13" class="text-gray-300"><div class="i-mdi-database-outline" /></NIcon>
                  {{ summary.databaseCount }} 个数据库 · {{ summary.tableCount }} 张表 ·
                  {{ summary.columnCount }} 个字段
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
              刷新元数据
            </NButton>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- ══ 主内容区 ══ -->
    <div class="flex-1 overflow-y-auto p-20px">
      <!-- ── Level 1: 数据源 → Tabs (数据库 / 概览) ── -->
      <template v-if="level === 'datasource'">
        <!-- 统计指标条 -->
        <div
          class="mb-16px overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <div class="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
            <div
              v-for="stat in [
                {
                  label: '数据库',
                  value: summary?.databaseCount,
                  icon: 'i-mdi-database-outline',
                  color: '#2563EB',
                  bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10'
                },
                {
                  label: '数据表',
                  value: summary?.tableCount,
                  icon: 'i-mdi-table-large',
                  color: '#7C3AED',
                  bg: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10'
                },
                {
                  label: '字段数',
                  value: summary?.columnCount,
                  icon: 'i-mdi-table-column',
                  color: '#059669',
                  bg: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10'
                },
                {
                  label: '近7天变更',
                  value: summary?.recentChangeCount,
                  icon: 'i-mdi-history',
                  color: '#D97706',
                  bg: 'from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10'
                }
              ]"
              :key="stat.label"
              class="flex items-center gap-14px px-20px py-16px"
            >
              <!-- eslint-disable-next-line vue/no-static-inline-styles -->
              <div class="h-42px w-42px flex-center flex-shrink-0 rounded-12px bg-gradient-to-br" :class="stat.bg">
                <!-- eslint-disable-next-line vue/no-static-inline-styles -->
                <NIcon :size="20" :style="{ color: stat.color }"><div :class="stat.icon" /></NIcon>
              </div>
              <div>
                <p class="text-11px text-gray-400 font-medium tracking-wider uppercase">{{ stat.label }}</p>
                <p class="mt-2px text-22px text-gray-900 font-bold tabular-nums dark:text-gray-50">
                  <NSkeleton v-if="datasourceLoading" text class="w-36px" />
                  <span v-else>{{ stat.value ?? 0 }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据库 / 概览 Tabs -->
        <div
          class="overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
        >
          <NTabs
            v-model:value="datasourceActiveTab"
            type="line"
            :tab-style="{ padding: '14px 20px' }"
            pane-style="padding: 0"
          >
            <NTabPane name="databases">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-database" /></NIcon>
                  数据库
                  <span class="ml-2px text-11px text-gray-400">({{ filteredDatabases.length }})</span>
                </div>
              </template>
              <div
                class="flex items-center justify-end border-b border-gray-100/80 px-20px py-10px dark:border-gray-800"
              >
                <NInput v-model:value="dbSearch" size="small" placeholder="搜索数据库" clearable class="w-220px">
                  <template #prefix>
                    <NIcon class="text-gray-300"><div class="i-mdi-magnify" /></NIcon>
                  </template>
                </NInput>
              </div>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="filteredDatabases.length || listLoading"
                  :columns="databaseColumns"
                  :data="filteredDatabases"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                  striped
                  class="min-h-200px"
                />
                <NEmpty v-else-if="!listLoading" description="暂无数据库，请先刷新元数据" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="overview">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-information-outline" /></NIcon>
                  概览
                </div>
              </template>
              <div class="p-24px">
                <div class="grid grid-cols-2 gap-24px lg:grid-cols-3">
                  <!-- 连接信息 -->
                  <div class="border border-gray-100 rounded-10px p-20px dark:border-gray-800">
                    <h4
                      class="mb-14px flex items-center gap-6px text-13px text-gray-600 font-semibold dark:text-gray-300"
                    >
                      <NIcon :size="16" class="text-gray-400"><div class="i-mdi-connection" /></NIcon>
                      连接信息
                    </h4>
                    <div class="flex flex-col gap-10px text-13px">
                      <div v-if="connParamsObj.host" class="flex items-start gap-8px">
                        <span class="w-56px flex-shrink-0 text-gray-400">主机</span>
                        <span class="text-gray-800 font-medium font-mono dark:text-gray-200">
                          {{ connParamsObj.host }}
                        </span>
                      </div>
                      <div v-if="connParamsObj.port" class="flex items-start gap-8px">
                        <span class="w-56px flex-shrink-0 text-gray-400">端口</span>
                        <span class="text-gray-800 font-medium font-mono dark:text-gray-200">
                          {{ connParamsObj.port }}
                        </span>
                      </div>
                      <div v-if="connParamsObj.database" class="flex items-start gap-8px">
                        <span class="w-56px flex-shrink-0 text-gray-400">数据库</span>
                        <span class="text-gray-800 font-medium font-mono dark:text-gray-200">
                          {{ connParamsObj.database }}
                        </span>
                      </div>
                      <div v-if="connParamsObj.username" class="flex items-start gap-8px">
                        <span class="w-56px flex-shrink-0 text-gray-400">用户名</span>
                        <span class="text-gray-800 font-medium font-mono dark:text-gray-200">
                          {{ connParamsObj.username }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- 基本信息 -->
                  <div class="border border-gray-100 rounded-10px p-20px dark:border-gray-800">
                    <h4
                      class="mb-14px flex items-center gap-6px text-13px text-gray-600 font-semibold dark:text-gray-300"
                    >
                      <NIcon :size="16" class="text-gray-400"><div class="i-mdi-information-outline" /></NIcon>
                      基本信息
                    </h4>
                    <div class="flex flex-col gap-10px text-13px">
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">数据源名称</span>
                        <span class="text-gray-800 font-medium dark:text-gray-200">
                          {{ datasource?.datasourceName ?? '-' }}
                        </span>
                      </div>
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">数据源类型</span>
                        <NTag size="tiny" :bordered="false" type="info">
                          {{ datasource?.datasourceType?.toUpperCase() ?? '-' }}
                        </NTag>
                      </div>
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">状态</span>
                        <NTag size="tiny" :bordered="false" :type="datasource?.status === '0' ? 'success' : 'error'">
                          {{ datasource?.status === '0' ? '运行中' : '已停用' }}
                        </NTag>
                      </div>
                      <div v-if="datasource?.remark" class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">备注</span>
                        <span class="text-gray-800 dark:text-gray-200">{{ datasource.remark }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 同步统计 -->
                  <div class="border border-gray-100 rounded-10px p-20px dark:border-gray-800">
                    <h4
                      class="mb-14px flex items-center gap-6px text-13px text-gray-600 font-semibold dark:text-gray-300"
                    >
                      <NIcon :size="16" class="text-gray-400"><div class="i-mdi-chart-bar" /></NIcon>
                      同步统计
                    </h4>
                    <div class="flex flex-col gap-10px text-13px">
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">最近同步</span>
                        <span class="text-gray-800 dark:text-gray-200">
                          {{ formatDateTime(summary?.lastSyncTime) }}
                        </span>
                      </div>
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">数据库数</span>
                        <span class="text-gray-800 font-medium tabular-nums dark:text-gray-200">
                          {{ summary?.databaseCount ?? 0 }}
                        </span>
                      </div>
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">数据表数</span>
                        <span class="text-gray-800 font-medium tabular-nums dark:text-gray-200">
                          {{ summary?.tableCount ?? 0 }}
                        </span>
                      </div>
                      <div class="flex items-start gap-8px">
                        <span class="w-72px flex-shrink-0 text-gray-400">近7天变更</span>
                        <span class="text-gray-800 font-medium tabular-nums dark:text-gray-200">
                          {{ summary?.recentChangeCount ?? 0 }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 2: 数据库 → 数据库结构列表 + 结构变更 ── -->
      <template v-else-if="level === 'database'">
        <div
          class="overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
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
                  class="min-h-200px"
                />
                <NEmpty v-else-if="!listLoading" description="暂无数据库结构，请先刷新元数据" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  结构变更
                  <span class="ml-2px text-11px text-gray-400">({{ schemaLevelChanges.length }})</span>
                </div>
              </template>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="schemaLevelChanges.length || listLoading"
                  :columns="schemaLevelChangeColumns"
                  :data="schemaLevelChanges"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                />
                <NEmpty v-else description="暂无结构变更记录" class="py-60px" />
              </NSpin>
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 3: 数据库结构 → 表列表 + 结构变更 ── -->
      <template v-else-if="level === 'schema'">
        <div
          class="overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
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
                />
                <NEmpty v-else description="暂无数据表" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  结构变更
                  <span class="ml-2px text-11px text-gray-400">({{ dbChanges.length }})</span>
                </div>
              </template>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="dbChanges.length || listLoading"
                  :columns="dbChangeColumns"
                  :data="dbChanges"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                />
                <NEmpty v-else description="暂无表级结构变更记录" class="py-60px" />
              </NSpin>
            </NTabPane>
          </NTabs>
        </div>
      </template>

      <!-- ── Level 4: 表 → 字段列表 + 结构变更 + 数据概览 ── -->
      <template v-else>
        <div
          class="overflow-hidden rounded-12px bg-white shadow-sm ring-1 ring-gray-100/80 dark:bg-[#1e1e24] dark:ring-gray-800"
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
                />
                <NEmpty v-else description="暂无字段信息" class="py-60px" />
              </NSpin>
            </NTabPane>

            <NTabPane name="changes">
              <template #tab>
                <div class="flex items-center gap-6px">
                  <NIcon :size="15"><div class="i-mdi-swap-horizontal" /></NIcon>
                  结构变更
                  <span class="ml-2px text-11px text-gray-400">({{ schemaChanges.length }})</span>
                </div>
              </template>
              <NSpin :show="listLoading">
                <NDataTable
                  v-if="schemaChanges.length || listLoading"
                  :columns="changeColumns"
                  :data="schemaChanges"
                  :single-line="false"
                  :pagination="paginationProps"
                  size="small"
                />
                <NEmpty v-else description="暂无结构变更记录" class="py-60px" />
              </NSpin>
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
