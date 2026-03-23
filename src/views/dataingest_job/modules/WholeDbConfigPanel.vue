<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { NButton, NCheckbox, NDataTable, NForm, NFormItem, NGrid, NGridItem, NInput } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchDiscoverTables } from '@/service/api/dataingest';

defineOptions({ name: 'WholeDbConfigPanel' });

interface Props {
  datasourceId?: CommonType.IdType;
  databaseName?: string;
  schemaName?: string;
  includePattern: string;
  excludePattern: string;
  modelValue: Api.Dataingest.IngestJobTableConfig[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:includePattern', v: string): void;
  (e: 'update:excludePattern', v: string): void;
  (e: 'update:modelValue', v: Api.Dataingest.IngestJobTableConfig[]): void;
}>();

const loading = ref(false);

const includeModel = computed({
  get: () => props.includePattern,
  set: v => emit('update:includePattern', v)
});
const excludeModel = computed({
  get: () => props.excludePattern,
  set: v => emit('update:excludePattern', v)
});

const summaryText = computed(() => {
  const total = props.modelValue.length;
  const enabled = props.modelValue.filter(c => c.isEnable !== '0').length;
  if (total === 0) return '点击"预览表列表"发现可用表';
  return `共发现 ${total} 张表，已启用 ${enabled} 张`;
});

async function discover() {
  if (!props.datasourceId || !props.databaseName) {
    window.$message?.warning('请先选择数据源和数据库');
    return;
  }
  loading.value = true;
  const { data, error } = await fetchDiscoverTables({
    datasourceId: props.datasourceId,
    databaseName: props.databaseName,
    schemaName: props.schemaName,
    includePattern: props.includePattern,
    excludePattern: props.excludePattern
  });
  loading.value = false;
  if (error) return;
  const tables = data ?? [];
  emit(
    'update:modelValue',
    tables.map((name, i) => ({
      sourceTableName: name,
      targetTableName: name,
      mappingMode: 'AUTO' as const,
      isEnable: '1',
      sortNum: i
    }))
  );
  if (tables.length) {
    window.$message?.success(`发现 ${tables.length} 张表`);
  } else {
    window.$message?.warning('未发现匹配的表');
  }
}

const columns: DataTableColumns<Api.Dataingest.IngestJobTableConfig> = [
  {
    title: '启用',
    key: 'isEnable',
    width: 56,
    align: 'center',
    render: row =>
      h(NCheckbox, {
        checked: row.isEnable !== '0',
        onUpdateChecked: (v: boolean) => {
          row.isEnable = v ? '1' : '0';
        }
      })
  },
  { title: '源表名', key: 'sourceTableName' },
  {
    title: '目标表名',
    key: 'targetTableName',
    render: row =>
      h(NInput, {
        value: row.targetTableName ?? row.sourceTableName,
        size: 'small',
        onUpdateValue: (v: string) => {
          row.targetTableName = v;
        }
      })
  }
];
</script>

<template>
  <div class="flex flex-col gap-12px">
    <NForm label-placement="left" :label-width="100">
      <NGrid :cols="2" :x-gap="16">
        <NGridItem>
          <NFormItem label="包含规则">
            <NInput v-model:value="includeModel" placeholder="正则，如 ^order.*" />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem label="排除规则">
            <NInput v-model:value="excludeModel" placeholder="正则，如 ^tmp_.*|^bak_.*" />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NForm>

    <div class="flex items-center gap-12px">
      <NButton type="primary" :loading="loading" @click="discover">预览表列表</NButton>
      <span class="text-13px op-60">{{ summaryText }}</span>
    </div>

    <NDataTable
      v-if="modelValue.length"
      :columns="columns"
      :data="modelValue"
      :pagination="false"
      :max-height="300"
      size="small"
      striped
    />
  </div>
</template>
