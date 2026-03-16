<script setup lang="ts">
import { computed, h } from 'vue';
import { NAlert, NButton, NDataTable, NEmpty, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';

defineOptions({
  name: 'MappingStep'
});

interface Props {
  previewLoading: boolean;
  sourceFields: Api.Dataingest.IngestFieldMeta[];
  targetFields: Api.Dataingest.IngestFieldMeta[];
  sourceFieldOptions: { label: string; value: string | number }[];
  targetFieldOptions: { label: string; value: string | number }[];
  mappingRows: Api.Dataingest.IngestFieldMappingOperate[];
  mappingWarnings: string[];
  validationErrors: Api.Dataingest.IngestValidationMessage[];
  validationWarnings: Api.Dataingest.IngestValidationMessage[];
  mappingTypeOptions: { label: string; value: string }[];
  getMappingRowMessages: (row: Api.Dataingest.IngestFieldMappingOperate) => string[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'preview'): void;
  (e: 'addRow'): void;
  (e: 'removeRow', index: number): void;
  (e: 'rowChange', row: Api.Dataingest.IngestFieldMappingOperate): void;
}

const emit = defineEmits<Emits>();

const summaryText = computed(() => {
  const enabledCount = props.mappingRows.filter(item => item.isEnable !== '0').length;
  return `映射 ${enabledCount} 条，未映射源字段 ${Math.max(props.sourceFields.length - enabledCount, 0)} 个，未映射目标字段 ${Math.max(props.targetFields.length - enabledCount, 0)} 个`;
});

function getCompatibilityTagType(level?: string) {
  if (level === 'INCOMPATIBLE') return 'error';
  if (level === 'RISKY_CAST') return 'warning';
  return 'success';
}

const columns = computed<DataTableColumns<Api.Dataingest.IngestFieldMappingOperate>>(() => [
  {
    key: 'sortNum',
    title: '#',
    width: 56,
    align: 'center',
    render: (_, index) => index + 1
  },
  {
    key: 'mappingType',
    title: '映射方式',
    width: 140,
    render: row =>
      h(NSelect, {
        value: row.mappingType ?? 'DIRECT',
        options: props.mappingTypeOptions,
        onUpdateValue: value => {
          row.mappingType = value as Api.Dataingest.IngestFieldMappingOperate['mappingType'];
          emit('rowChange', row);
        }
      })
  },
  {
    key: 'sourceField',
    title: '源字段',
    minWidth: 180,
    render: row =>
      h(NSelect, {
        value: row.sourceField ?? null,
        options: props.sourceFieldOptions,
        filterable: true,
        clearable: true,
        disabled: row.mappingType === 'CONSTANT',
        onUpdateValue: value => {
          row.sourceField = (value ?? undefined) as string | undefined;
          emit('rowChange', row);
        }
      })
  },
  {
    key: 'targetField',
    title: '目标字段',
    minWidth: 180,
    render: row =>
      h(NSelect, {
        value: row.targetField ?? null,
        options: props.targetFieldOptions,
        filterable: true,
        clearable: true,
        onUpdateValue: value => {
          row.targetField = (value ?? '') as string;
          emit('rowChange', row);
        }
      })
  },
  {
    key: 'config',
    title: '映射配置',
    minWidth: 180,
    render: row => {
      if (row.mappingType === 'CONSTANT') {
        return h(NInput, {
          value: row.constantValue ?? '',
          placeholder: '常量值',
          onUpdateValue: value => {
            row.constantValue = value;
          }
        });
      }
      if (row.mappingType === 'DICT') {
        return h(NInput, {
          value: row.dictType ?? '',
          placeholder: '字典类型编码',
          onUpdateValue: value => {
            row.dictType = value;
          }
        });
      }
      return h('span', { class: 'text-12px text-neutral-500' }, '无需额外配置');
    }
  },
  {
    key: 'sourceDataType',
    title: '源类型',
    width: 130,
    render: row => row.sourceDataType || '-'
  },
  {
    key: 'targetDataType',
    title: '目标类型',
    width: 130,
    render: row => row.targetDataType || '-'
  },
  {
    key: 'status',
    title: '状态',
    width: 180,
    render: row => {
      const messages = props.getMappingRowMessages(row);
      return h('div', { class: 'flex-col gap-6px' }, [
        h(
          NTag,
          { type: getCompatibilityTagType(row.compatibilityLevel), size: 'small' },
          { default: () => row.compatibilityLevel || '未校验' }
        ),
        ...(messages.length
          ? [h('div', { class: 'text-12px text-#d03050 whitespace-pre-wrap break-all' }, messages.join('；'))]
          : [])
      ]);
    }
  },
  {
    key: 'operate',
    title: '操作',
    width: 80,
    align: 'center',
    render: (_, index) =>
      h(
        NButton,
        {
          text: true,
          type: 'error',
          onClick: () => emit('removeRow', index)
        },
        { default: () => '删除' }
      )
  }
]);
</script>

<template>
  <div class="flex-col gap-12px">
    <NSpace justify="space-between" align="center" class="flex-wrap gap-y-8px">
      <NSpace>
        <NButton type="primary" :loading="previewLoading" @click="$emit('preview')">自动预览映射</NButton>
        <NButton @click="$emit('addRow')">新增映射</NButton>
      </NSpace>
      <NTag type="info">{{ summaryText }}</NTag>
    </NSpace>

    <NAlert v-if="mappingWarnings.length" type="warning" :show-icon="true">
      <div v-for="warning in mappingWarnings" :key="warning">{{ warning }}</div>
    </NAlert>
    <NAlert v-if="validationErrors.length" type="error" :show-icon="true">
      <div v-for="item in validationErrors" :key="`${item.field}-${item.message}`">{{ item.message }}</div>
    </NAlert>
    <NAlert v-if="validationWarnings.length" type="warning" :show-icon="true">
      <div v-for="item in validationWarnings" :key="`${item.field}-${item.message}`">{{ item.message }}</div>
    </NAlert>

    <div v-if="mappingRows.length" class="border border-neutral-200 rounded-10px border-solid p-8px">
      <NDataTable
        :columns="columns"
        :data="mappingRows"
        :pagination="false"
        :bordered="false"
        size="small"
        :scroll-x="1240"
      />
    </div>
    <NEmpty v-else description="请先预览映射或手动新增映射" />
  </div>
</template>
