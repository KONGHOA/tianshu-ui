<script setup lang="ts">
import { h, onMounted, ref, watch } from 'vue';
import { NDataTable, NEmpty, NIcon, NPagination, NSpin, NTag, NText } from 'naive-ui';
import type { DataTableColumns, DataTableExpandColumn } from 'naive-ui';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';

interface Props {
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

type ChangeRow = Api.Metadata.SchemaChange;

const loading = ref(false);
const records = ref<ChangeRow[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(15);

async function loadData() {
  if (!props.datasourceId) return;
  loading.value = true;
  const { data, error } = await fetchGetSchemaChangeList({
    datasourceId: Number(props.datasourceId),
    pageNum: pageNum.value,
    pageSize: pageSize.value
  });
  if (!error && data) {
    records.value = data.rows ?? [];
    total.value = data.total ?? 0;
  }
  loading.value = false;
}

watch(
  () => props.datasourceId,
  () => {
    pageNum.value = 1;
    loadData();
  }
);

onMounted(loadData);

type TagType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface ChangeTypeInfo {
  label: string;
  type: TagType;
}

interface NormalizedChange {
  level: string;
  normalized: string;
}

function normalizeChange(row: ChangeRow): NormalizedChange {
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

function resolveLevelChange(level: string, normalized: string): ChangeTypeInfo | null {
  const levelMap: Record<string, ChangeTypeInfo[]> = {
    column: [
      { label: '字段注释变更', type: 'warning' },
      { label: '字段类型变更', type: 'warning' },
      { label: '字段新增', type: 'success' },
      { label: '字段删除', type: 'error' }
    ],
    table: [
      { label: '表注释变更', type: 'warning' },
      { label: '表属性变更', type: 'info' },
      { label: '表新增', type: 'success' },
      { label: '表删除', type: 'error' }
    ],
    schema: [
      { label: 'Schema注释变更', type: 'warning' },
      { label: 'Schema新增', type: 'success' },
      { label: 'Schema删除', type: 'error' }
    ],
    database: [
      { label: '数据库注释变更', type: 'warning' },
      { label: '数据库新增', type: 'success' },
      { label: '数据库删除', type: 'error' }
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
  const infos = levelMap[level];
  const keywords = keywordMap[level];
  if (!infos || !keywords) {
    return null;
  }
  const matchIndex = keywords.findIndex(group => matchesAny(normalized, group));
  return matchIndex >= 0 ? infos[matchIndex] : null;
}

function resolveGenericChange(normalized: string): ChangeTypeInfo {
  const rules: Array<{ keywords: string[]; info: ChangeTypeInfo }> = [
    { keywords: ['COMMENT', 'CHANGE'], info: { label: '注释变更', type: 'warning' } },
    { keywords: ['PROPERTY'], info: { label: '属性变更', type: 'info' } },
    { keywords: ['TYPE', 'CHANGE'], info: { label: '类型变更', type: 'warning' } },
    { keywords: ['ADD', 'CREATE'], info: { label: '新增', type: 'success' } },
    { keywords: ['DROP', 'DELETE', 'REMOVE'], info: { label: '删除', type: 'error' } },
    { keywords: ['MODIFY', 'ALTER', 'CHANGE'], info: { label: '变更', type: 'warning' } }
  ];
  const matchedRule = rules.find(rule => matchesAny(normalized, rule.keywords));
  return matchedRule?.info ?? { label: normalized, type: 'default' };
}

function getChangeTypeInfo(row: ChangeRow): {
  label: string;
  type: TagType;
} {
  const change = normalizeChange(row);
  return (
    resolveLevelChange(change.level, change.normalized) ??
    resolveGenericChange(change.normalized) ?? { label: row.changeType, type: 'default' }
  );
}

const expandCol: DataTableExpandColumn<ChangeRow> = {
  type: 'expand',
  expandable: row => Boolean(row.changeBefore || row.changeAfter),
  renderExpand: row =>
    h('div', { class: 'px-16px py-12px flex flex-col gap-10px bg-gray-50 dark:bg-[#18181c]' }, [
      row.changeBefore
        ? h('div', { class: 'flex items-start gap-10px' }, [
            h('span', { class: 'w-40px flex-shrink-0 text-11px text-red-500 font-medium pt-3px' }, '变更前'),
            h(
              'code',
              {
                class:
                  'flex-1 rounded-6px bg-red-50 dark:bg-red-900/20 px-10px py-6px text-12px text-red-700 leading-relaxed dark:text-red-300 whitespace-pre-wrap break-all'
              },
              row.changeBefore
            )
          ])
        : null,
      row.changeAfter
        ? h('div', { class: 'flex items-start gap-10px' }, [
            h('span', { class: 'w-40px flex-shrink-0 text-11px text-green-500 font-medium pt-3px' }, '变更后'),
            h(
              'code',
              {
                class:
                  'flex-1 rounded-6px bg-green-50 dark:bg-green-900/20 px-10px py-6px text-12px text-green-700 leading-relaxed dark:text-green-300 whitespace-pre-wrap break-all'
              },
              row.changeAfter
            )
          ])
        : null
    ])
};

const columns: DataTableColumns<ChangeRow> = [
  expandCol,
  {
    title: '变更类型',
    key: 'changeType',
    width: 160,
    render: row => {
      const info = getChangeTypeInfo(row);
      return h(NTag, { size: 'small', type: info.type, bordered: false }, { default: () => info.label });
    }
  },
  {
    title: '数据库',
    key: 'databaseName',
    width: 120,
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 2 }, { default: () => row.databaseName || '-' })
  },
  {
    title: '数据表',
    key: 'tableName',
    width: 140,
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 2 }, { default: () => row.tableName || '-' })
  },
  {
    title: '字段',
    key: 'columnName',
    width: 120,
    ellipsis: { tooltip: true },
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.columnName || '-' })
  },
  {
    title: '变更时间',
    key: 'createTime',
    width: 160,
    render: row => h(NText, { depth: 3, class: 'text-12px' }, { default: () => row.createTime || '-' })
  }
];
</script>

<template>
  <div class="flex flex-col gap-12px">
    <NSpin :show="loading" class="min-h-200px">
      <NEmpty
        v-if="!loading && records.length === 0"
        description="暂无架构变更记录，数据源刷新后自动生成"
        class="py-60px"
      >
        <template #icon>
          <NIcon size="48" class="text-gray-300">
            <div class="i-mdi-history" />
          </NIcon>
        </template>
      </NEmpty>

      <NDataTable
        v-else
        :data="records"
        :columns="columns"
        :bordered="false"
        size="small"
        :row-key="(row: ChangeRow) => row.changeId"
        striped
      />
    </NSpin>

    <div v-if="total > 0" class="flex justify-end">
      <NPagination
        v-model:page="pageNum"
        v-model:page-size="pageSize"
        :item-count="total"
        :page-sizes="[15, 30, 50]"
        show-size-picker
        size="small"
        @update:page="loadData"
        @update:page-size="loadData"
      />
    </div>
  </div>
</template>
