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

function getChangeTypeInfo(changeType: string): {
  label: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'default';
} {
  const upper = changeType?.toUpperCase() ?? '';
  if (upper.startsWith('ADD') || upper.startsWith('CREATE')) return { label: changeType, type: 'success' };
  if (upper.startsWith('DROP') || upper.startsWith('DELETE') || upper.startsWith('REMOVE'))
    return { label: changeType, type: 'error' };
  if (upper.startsWith('MODIFY') || upper.startsWith('ALTER') || upper.startsWith('CHANGE'))
    return { label: changeType, type: 'warning' };
  return { label: changeType, type: 'info' };
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
      const info = getChangeTypeInfo(row.changeType);
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
