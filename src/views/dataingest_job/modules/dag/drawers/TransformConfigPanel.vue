<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { computed, h, onMounted, ref, watch } from 'vue';
import {
  type DataTableColumns,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSwitch
} from 'naive-ui';
import { jsonClone } from '@sa/utils';
import type { PluginType } from '../composables/useDagGraph';

defineOptions({ name: 'TransformConfigPanel' });

interface Props {
  config: Record<string, any>;
  pluginType: PluginType;
}

const props = defineProps<Props>();

type FieldMappingRow = {
  key: number;
  sourceField: string;
  targetField: string;
  expression?: string;
};

const rowKinds = ref<string[]>([]);
const mappingRows = ref<FieldMappingRow[]>([]);
const replaceField = ref('');
const replacePattern = ref('');
const replaceValue = ref('');
const replaceUseRegex = ref(false);
const sqlText = ref('');

const rowKindOptions = [
  { label: 'INSERT', value: 'INSERT' },
  { label: 'UPDATE_BEFORE', value: 'UPDATE_BEFORE' },
  { label: 'UPDATE_AFTER', value: 'UPDATE_AFTER' },
  { label: 'DELETE', value: 'DELETE' }
];

const selectMenuProps = { style: { zIndex: 2200 } };

const mappingColumns: DataTableColumns<FieldMappingRow> = [
  {
    title: '源字段',
    key: 'sourceField',
    render: row =>
      h(NInput, {
        value: row.sourceField,
        placeholder: 'source_field',
        onUpdateValue: value => {
          row.sourceField = value;
        }
      })
  },
  {
    title: '目标字段',
    key: 'targetField',
    render: row =>
      h(NInput, {
        value: row.targetField,
        placeholder: 'target_field',
        onUpdateValue: value => {
          row.targetField = value;
        }
      })
  },
  {
    title: '表达式',
    key: 'expression',
    render: row =>
      h(NInput, {
        value: row.expression,
        placeholder: '如 upper(name)',
        onUpdateValue: value => {
          row.expression = value;
        }
      })
  },
  {
    title: '操作',
    key: 'actions',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          text: true,
          type: 'error',
          onClick: () => removeMappingRow(row.key)
        },
        { default: () => '删除' }
      )
  }
];

function parseNodeConfig(): Record<string, any> {
  if (typeof props.config.nodeConfig === 'string' && props.config.nodeConfig) {
    try {
      return JSON.parse(props.config.nodeConfig);
    } catch {
      return {};
    }
  }
  return {};
}

function syncRowKinds(cfg: Record<string, any>) {
  const raw = cfg.include_kinds ?? cfg.filterRowKinds ?? props.config.filterRowKinds;
  rowKinds.value = Array.isArray(raw) ? [...raw] : ['INSERT', 'UPDATE_AFTER'];
}

function syncMappings(cfg: Record<string, any>) {
  const raw = cfg.field_mapper ?? cfg.mappings ?? props.config.mappings;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    mappingRows.value = Object.entries(raw).map(([targetField, sourceField], index) => ({
      key: index + 1,
      sourceField: String(sourceField),
      targetField,
      expression: ''
    }));
  } else if (Array.isArray(raw)) {
    mappingRows.value = jsonClone(raw).map((item: any, index: number) => ({
      key: item.key ?? index + 1,
      sourceField: item.sourceField ?? '',
      targetField: item.targetField ?? '',
      expression: item.expression ?? ''
    }));
  } else {
    mappingRows.value = [];
  }
}

function syncReplace(cfg: Record<string, any>) {
  replaceField.value = cfg.replace_field ?? cfg.replaceField ?? props.config.replaceField ?? '';
  replacePattern.value = cfg.pattern ?? cfg.replacePattern ?? props.config.replacePattern ?? '';
  replaceValue.value = cfg.replacement ?? cfg.replaceValue ?? props.config.replaceValue ?? '';
  replaceUseRegex.value = Boolean(cfg.is_regex ?? cfg.replaceUseRegex ?? props.config.replaceUseRegex);
}

function syncFromConfig() {
  const cfg = parseNodeConfig();
  syncRowKinds(cfg);
  syncMappings(cfg);
  syncReplace(cfg);
  sqlText.value = cfg.query ?? props.config.sqlText ?? '';
}

function addMappingRow() {
  const key = Date.now();
  mappingRows.value.push({ key, sourceField: '', targetField: '', expression: '' });
}

function removeMappingRow(key: number) {
  const index = mappingRows.value.findIndex(item => item.key === key);
  if (index >= 0) {
    mappingRows.value.splice(index, 1);
  }
}

watch(
  [sqlText, replaceField, replacePattern, replaceValue, replaceUseRegex, rowKinds, mappingRows],
  () => {
    const config: any = {};
    if (props.pluginType === 'SQL') {
      config.query = sqlText.value;
      props.config.sqlText = sqlText.value;
    } else if (props.pluginType === 'REPLACE') {
      config.replace_field = replaceField.value;
      config.pattern = replacePattern.value;
      config.replacement = replaceValue.value;
      config.is_regex = replaceUseRegex.value;
    } else if (props.pluginType === 'FILTER') {
      config.include_kinds = [...rowKinds.value];
    } else if (props.pluginType === 'FIELD_MAPPER') {
      const fieldMapper: Record<string, string> = {};
      for (const row of mappingRows.value) {
        if (row.targetField && row.sourceField) {
          fieldMapper[row.targetField] = row.sourceField;
        }
      }
      config.field_mapper = fieldMapper;
    }
    props.config.nodeConfig = JSON.stringify(config);
  },
  { deep: true }
);

onMounted(() => {
  syncFromConfig();
});

const fieldOptions = computed(() => {
  const fields = props.config.availableFields;
  if (!Array.isArray(fields)) return [];
  return fields.map((item: string) => ({ label: item, value: item }));
});
</script>

<template>
  <NForm label-placement="left" :label-width="96">
    <template v-if="props.pluginType === 'FIELD_MAPPER'">
      <div class="flex items-center justify-between pb-8px">
        <p class="text-13px text-#1d2559 font-medium">字段映射</p>
        <NButton size="small" tertiary type="primary" @click="addMappingRow">添加映射</NButton>
      </div>
      <NDataTable :columns="mappingColumns" :data="mappingRows" size="small" />
    </template>

    <template v-else-if="props.pluginType === 'FILTER'">
      <NFormItem label="Row Kinds">
        <NCheckboxGroup v-model:value="rowKinds">
          <NSpace>
            <NCheckbox v-for="item in rowKindOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </NCheckbox>
          </NSpace>
        </NCheckboxGroup>
      </NFormItem>
    </template>

    <template v-else-if="props.pluginType === 'REPLACE'">
      <NFormItem label="字段">
        <NSelect
          v-model:value="replaceField"
          :options="fieldOptions"
          filterable
          tag
          placeholder="输入或选择字段"
          :menu-props="selectMenuProps"
        />
      </NFormItem>
      <NFormItem label="匹配条件">
        <NInput v-model:value="replacePattern" placeholder="支持正则" />
      </NFormItem>
      <NFormItem label="替换结果">
        <NInput v-model:value="replaceValue" placeholder="替换为..." />
      </NFormItem>
      <NFormItem label="正则模式">
        <NSwitch v-model:value="replaceUseRegex" />
      </NFormItem>
    </template>

    <template v-else-if="props.pluginType === 'SQL'">
      <NFormItem label="SQL 脚本">
        <NInput v-model:value="sqlText" type="textarea" :rows="6" placeholder="SELECT * FROM t" />
      </NFormItem>
    </template>
  </NForm>
</template>
