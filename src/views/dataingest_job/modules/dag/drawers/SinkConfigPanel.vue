<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { onMounted, ref, watch } from 'vue';
import { NAlert, NButton, NForm, NFormItem, NInput, NPopconfirm, NSelect, NSwitch } from 'naive-ui';
import { fetchGetIngestSinkCapabilities } from '@/service/api/dataingest';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import { type SelectOption, findOptionLabel, mapCatalogColumns, mapCatalogOptions } from '../utils/catalog';
import { schemaSaveModeOptions, dataSaveModeOptions, writeModeOptions } from '../../sink-constants';
import { useSaveModeConfirm } from '../../useSaveModeConfirm';

defineOptions({ name: 'SinkConfigPanel' });

type SinkConfig = Pick<
  Api.Dataingest.IngestJobTask,
  | 'datasourceId'
  | 'databaseName'
  | 'schemaName'
  | 'tableName'
  | 'schemaSaveMode'
  | 'dataSaveMode'
  | 'writeMode'
  | 'primaryKeys'
  | 'nodeConfig'
>;

interface Props {
  config: SinkConfig;
  pluginType: string;
  datasourceOptions: { label: string; value: CommonType.IdType }[];
}

const props = defineProps<Props>();

const databaseOptions = ref<SelectOption[]>([]);
const schemaOptions = ref<SelectOption[]>([]);
const tableOptions = ref<SelectOption[]>([]);
const fieldOptions = ref<{ label: string; value: string }[]>([]);

const selectedDatabaseUuid = ref('');
const selectedSchemaUuid = ref('');
const selectedTableUuid = ref('');

const databaseLoading = ref(false);
const schemaLoading = ref(false);
const tableLoading = ref(false);
const fieldLoading = ref(false);
const hydrating = ref(false);
const syncingCustomTableName = ref(false);
const sinkCapabilities = ref<Api.Dataingest.IngestSinkCapability>({
  supportsSchemaSaveMode: false,
  supportsDataSaveMode: false
});

const selectMenuProps = { style: { zIndex: 2200 } };

const {
  show: showSchemaConfirm,
  handleChange: handleSchemaSaveModeChange,
  confirm: confirmSchemaSaveMode,
  cancel: cancelSchemaSaveMode
} = useSaveModeConfirm(
  () => props.config.schemaSaveMode,
  v => { props.config.schemaSaveMode = v; },
  'RECREATE_SCHEMA',
  'CREATE_SCHEMA_WHEN_NOT_EXIST'
);

const {
  show: showDataConfirm,
  handleChange: handleDataSaveModeChange,
  confirm: confirmDataSaveMode,
  cancel: cancelDataSaveMode
} = useSaveModeConfirm(
  () => props.config.dataSaveMode,
  v => { props.config.dataSaveMode = v; },
  'DROP_DATA',
  'APPEND_DATA'
);
const managedFieldModeOptions = [
  { label: 'UUID', value: 'UUID' },
  { label: '雪花ID', value: 'SNOWFLAKE' },
  { label: '源表主键', value: 'PRIMARY_KEYS' },
  { label: '指定字段拼接', value: 'CUSTOM_FIELDS' }
];
const customFieldValueTypeOptions = [
  { label: '固定值', value: 'FIXED_VALUE' },
  { label: '当前时间', value: 'CURRENT_TIME' },
  { label: '作业ID', value: 'JOB_ID' },
  { label: '实例ID', value: 'INSTANCE_ID' },
  { label: '源表名', value: 'SOURCE_TABLE_NAME' }
];
type ManagedCustomFieldValueType = NonNullable<Api.Dataingest.IngestManagedCustomField['valueType']>;
const managedCustomFields = ref<Api.Dataingest.IngestManagedCustomField[]>([]);
const technicalKeyFieldName = ref('');
const technicalKeySourceMode = ref<NonNullable<Api.Dataingest.IngestTechnicalKeyConfig['sourceMode']>>('PRIMARY_KEYS');
const technicalKeySourceFields = ref<string[]>([]);
const technicalKeyIncludeTableName = ref(false);

function ensurePrimaryKeys() {
  if (Array.isArray(props.config.primaryKeys)) {
    props.config.primaryKeys = props.config.primaryKeys.map(item => String(item));
    return;
  }
  props.config.primaryKeys = [];
}

function parseNodeConfig(): Record<string, any> {
  if (!props.config.nodeConfig) return {};
  try {
    return JSON.parse(props.config.nodeConfig);
  } catch {
    return {};
  }
}

function createEmptyManagedCustomField(): Api.Dataingest.IngestManagedCustomField {
  return {
    fieldName: '',
    valueType: 'CURRENT_TIME',
    fixedValue: ''
  };
}

function normalizeManagedCustomFields(rawManagedFields: Record<string, any>): Api.Dataingest.IngestManagedCustomField[] {
  const customFields = Array.isArray(rawManagedFields.customFields)
    ? rawManagedFields.customFields
        .map((item: Record<string, unknown>) => ({
          fieldName: typeof item?.fieldName === 'string' ? item.fieldName : '',
          valueType: (typeof item?.valueType === 'string' ? item.valueType : 'CURRENT_TIME') as ManagedCustomFieldValueType,
          fixedValue: typeof item?.fixedValue === 'string' ? item.fixedValue : ''
        }))
        .filter(item => item.fieldName || item.valueType || item.fixedValue)
    : [];

  if (typeof rawManagedFields.ingestTimeFieldName === 'string' && rawManagedFields.ingestTimeFieldName.trim()) {
    customFields.push({
      fieldName: rawManagedFields.ingestTimeFieldName.trim(),
      valueType: 'CURRENT_TIME',
      fixedValue: ''
    });
  }
  if (typeof rawManagedFields.ingestJobIdFieldName === 'string' && rawManagedFields.ingestJobIdFieldName.trim()) {
    customFields.push({
      fieldName: rawManagedFields.ingestJobIdFieldName.trim(),
      valueType: 'JOB_ID',
      fixedValue: ''
    });
  }
  return customFields;
}

function addManagedCustomField() {
  managedCustomFields.value.push(createEmptyManagedCustomField());
}

function removeManagedCustomField(index: number) {
  managedCustomFields.value.splice(index, 1);
}

function hydrateManagedFields() {
  const nodeConfig = parseNodeConfig();
  const managedFields = nodeConfig.managedFields ?? {};
  managedCustomFields.value = normalizeManagedCustomFields(managedFields);
  technicalKeyFieldName.value = managedFields.technicalKey?.fieldName ?? '';
  technicalKeySourceMode.value = managedFields.technicalKey?.sourceMode ?? 'PRIMARY_KEYS';
  technicalKeySourceFields.value = Array.isArray(managedFields.technicalKey?.sourceFields)
    ? managedFields.technicalKey.sourceFields.map((item: unknown) => String(item))
    : [];
  technicalKeyIncludeTableName.value = Boolean(managedFields.technicalKey?.includeTableName);
  if (!['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(technicalKeySourceMode.value)) {
    technicalKeyIncludeTableName.value = false;
  }
}

function syncManagedFieldsToNodeConfig() {
  const nodeConfig = parseNodeConfig();
  const nextManagedFields: Api.Dataingest.IngestManagedFieldsConfig = {};
  const normalizedCustomFields = managedCustomFields.value
    .map(item => ({
      fieldName: item.fieldName?.trim() ?? '',
      valueType: item.valueType ?? 'CURRENT_TIME',
      fixedValue: item.valueType === 'FIXED_VALUE' ? (item.fixedValue ?? '') : undefined
    }))
    .filter(item => item.fieldName && item.valueType);
  if (normalizedCustomFields.length > 0) {
    nextManagedFields.customFields = normalizedCustomFields;
  }
  if (technicalKeyFieldName.value.trim()) {
    nextManagedFields.technicalKey = {
      fieldName: technicalKeyFieldName.value.trim(),
      sourceMode: technicalKeySourceMode.value,
      sourceFields: technicalKeySourceMode.value === 'CUSTOM_FIELDS' ? technicalKeySourceFields.value : [],
      includeTableName: technicalKeyIncludeTableName.value
    };
  }
  if (Object.keys(nextManagedFields).length > 0) {
    nodeConfig.managedFields = nextManagedFields;
  } else {
    Reflect.deleteProperty(nodeConfig, 'managedFields');
  }
  props.config.nodeConfig = Object.keys(nodeConfig).length > 0 ? JSON.stringify(nodeConfig) : '';
}

function resetAfterDatasource() {
  databaseOptions.value = [];
  schemaOptions.value = [];
  tableOptions.value = [];
  fieldOptions.value = [];
  selectedDatabaseUuid.value = '';
  selectedSchemaUuid.value = '';
  selectedTableUuid.value = '';
  props.config.databaseName = '';
  props.config.schemaName = '';
  props.config.tableName = '';
  props.config.primaryKeys = [];
}

function resetAfterDatabase() {
  schemaOptions.value = [];
  tableOptions.value = [];
  fieldOptions.value = [];
  selectedSchemaUuid.value = '';
  selectedTableUuid.value = '';
  props.config.schemaName = '';
  props.config.tableName = '';
  props.config.primaryKeys = [];
}

function resetAfterSchema() {
  tableOptions.value = [];
  fieldOptions.value = [];
  selectedTableUuid.value = '';
  props.config.tableName = '';
  props.config.primaryKeys = [];
}

async function loadSinkCapabilities(datasourceId: CommonType.IdType | null | undefined) {
  sinkCapabilities.value = {
    supportsSchemaSaveMode: false,
    supportsDataSaveMode: false
  };
  if (!datasourceId || !props.pluginType) return;
  const { data, error } = await fetchGetIngestSinkCapabilities(datasourceId, props.pluginType);
  if (!error && data) {
    sinkCapabilities.value = data;
  }
}

async function loadDatabases(datasourceId: CommonType.IdType, restoring = false) {
  databaseLoading.value = true;
  const { data, error } = await fetchGetDatabases(datasourceId);
  databaseLoading.value = false;
  databaseOptions.value = !error && data ? mapCatalogOptions(data) : [];
  if (!restoring || !props.config.databaseName) return;
  const target = databaseOptions.value.find(item => item.label === props.config.databaseName);
  if (target) {
    selectedDatabaseUuid.value = target.value;
    await loadSchemasOrTables(true);
  }
}

async function loadSchemasOrTables(restoring = false) {
  if (!selectedDatabaseUuid.value) return;
  schemaLoading.value = true;
  const { data, error } = await fetchGetSchemas(selectedDatabaseUuid.value);
  schemaLoading.value = false;
  if (error || !data) {
    schemaOptions.value = [];
    await loadTables(selectedDatabaseUuid.value, restoring);
    return;
  }
  if (data.length === 0) {
    schemaOptions.value = [];
    props.config.schemaName = '';
    await loadTables(selectedDatabaseUuid.value, restoring);
    return;
  }
  schemaOptions.value = mapCatalogOptions(data);
  if (!restoring || !props.config.schemaName) return;
  const target = schemaOptions.value.find(item => item.label === props.config.schemaName);
  if (target) {
    selectedSchemaUuid.value = target.value;
    await loadTables(target.value, true);
  }
}

async function loadTables(parentUuid: string, restoring = false) {
  tableLoading.value = true;
  const { data, error } = await fetchGetTables(parentUuid);
  tableLoading.value = false;
  tableOptions.value = !error && data ? mapCatalogOptions(data) : [];
  if (!restoring || !props.config.tableName) return;
  const target = tableOptions.value.find(item => item.label === props.config.tableName);
  if (target) {
    selectedTableUuid.value = target.value;
    await loadFields(target.value);
  }
}

async function loadFields(tableUuid: string) {
  fieldLoading.value = true;
  const { data, error } = await fetchGetColumns(tableUuid);
  fieldLoading.value = false;
  const metas = !error && data ? mapCatalogColumns(data) : [];
  fieldOptions.value = metas.map(item => ({ label: `${item.fieldName} (${item.dataType})`, value: item.fieldName }));
  if (props.config.writeMode !== 'UPSERT') {
    props.config.primaryKeys = [];
  }
}

async function handleCustomTableNameInput(value: string) {
  const normalized = value.trim();
  syncingCustomTableName.value = true;
  props.config.tableName = normalized;

  const matched = tableOptions.value.find(item => item.label === normalized);
  if (matched) {
    selectedTableUuid.value = matched.value;
    await loadFields(matched.value);
  } else {
    selectedTableUuid.value = '';
    fieldOptions.value = [];
    props.config.primaryKeys = [];
  }
  syncingCustomTableName.value = false;
}

async function hydrateFromConfig() {
  hydrating.value = true;
  const savedDb = props.config.databaseName;
  const savedSchema = props.config.schemaName;
  const savedTable = props.config.tableName;
  const savedPrimaryKeys = props.config.primaryKeys;
  const savedWriteMode = props.config.writeMode;
  const savedSchemaSaveMode = props.config.schemaSaveMode;
  const savedDataSaveMode = props.config.dataSaveMode;
  resetAfterDatasource();
  props.config.databaseName = savedDb;
  props.config.schemaName = savedSchema;
  props.config.tableName = savedTable;
  props.config.primaryKeys = savedPrimaryKeys;
  props.config.writeMode = savedWriteMode;
  props.config.schemaSaveMode = savedSchemaSaveMode;
  props.config.dataSaveMode = savedDataSaveMode;
  props.config.nodeConfig = props.config.nodeConfig;
  ensurePrimaryKeys();
  hydrateManagedFields();
  if (props.config.datasourceId) {
    await loadSinkCapabilities(props.config.datasourceId);
    await loadDatabases(props.config.datasourceId, true);
  }
  hydrating.value = false;
}

watch(
  () => props.config.datasourceId,
  async value => {
    if (hydrating.value) return;
    resetAfterDatasource();
    if (value) {
      await loadSinkCapabilities(value);
      await loadDatabases(value);
      return;
    }
    await loadSinkCapabilities(null);
  }
);

watch(selectedDatabaseUuid, async value => {
  if (hydrating.value) return;
  props.config.databaseName = value ? findOptionLabel(databaseOptions.value, value) : '';
  resetAfterDatabase();
  if (value) {
    await loadSchemasOrTables();
  }
});

watch(selectedSchemaUuid, async value => {
  if (hydrating.value) return;
  props.config.schemaName = value ? findOptionLabel(schemaOptions.value, value) : '';
  resetAfterSchema();
  if (value) {
    await loadTables(value);
  }
});

watch(selectedTableUuid, async value => {
  if (hydrating.value) return;
  if (syncingCustomTableName.value) return;
  props.config.tableName = value ? findOptionLabel(tableOptions.value, value) : '';
  props.config.primaryKeys = [];
  if (value) {
    await loadFields(value);
  } else {
    fieldOptions.value = [];
  }
});

watch(
  () => props.config.writeMode,
  value => {
    if (value !== 'UPSERT') {
      props.config.primaryKeys = [];
    }
  }
);

watch(technicalKeySourceMode, value => {
  if (value !== 'CUSTOM_FIELDS') {
    technicalKeySourceFields.value = [];
  }
  if (!['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(value)) {
    technicalKeyIncludeTableName.value = false;
  }
});

onMounted(async () => {
  props.config.writeMode ??= 'APPEND';
  props.config.schemaSaveMode ??= 'CREATE_SCHEMA_WHEN_NOT_EXIST';
  props.config.dataSaveMode ??= 'APPEND_DATA';
  ensurePrimaryKeys();
  hydrateManagedFields();
  await hydrateFromConfig();
});

watch(
  [managedCustomFields, technicalKeyFieldName, technicalKeySourceMode, technicalKeySourceFields, technicalKeyIncludeTableName],
  () => {
    syncManagedFieldsToNodeConfig();
  },
  { deep: true }
);
</script>

<template>
  <NForm label-placement="left" :label-width="96">
    <NFormItem label="数据源">
      <NSelect
        v-model:value="props.config.datasourceId"
        :options="datasourceOptions"
        filterable
        clearable
        :loading="databaseLoading"
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem label="数据库">
      <NSelect
        v-model:value="selectedDatabaseUuid"
        :options="databaseOptions"
        :disabled="!props.config.datasourceId"
        :loading="databaseLoading"
        filterable
        clearable
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem label="Schema">
      <NSelect
        v-model:value="selectedSchemaUuid"
        :options="schemaOptions"
        :disabled="schemaOptions.length === 0"
        :loading="schemaLoading"
        clearable
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem label="表名">
      <NInput
        v-if="sinkCapabilities.supportsSchemaSaveMode"
        :value="props.config.tableName"
        placeholder="可直接输入新表名，或先从下方选择已有表"
        @update:value="handleCustomTableNameInput"
      />
      <NSelect
        v-else
        v-model:value="selectedTableUuid"
        :options="tableOptions"
        :disabled="tableOptions.length === 0"
        :loading="tableLoading"
        filterable
        clearable
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem v-if="sinkCapabilities.supportsSchemaSaveMode" label="已有表">
      <NSelect
        v-model:value="selectedTableUuid"
        :options="tableOptions"
        :disabled="tableOptions.length === 0"
        :loading="tableLoading"
        filterable
        clearable
        placeholder="选填，选择后会自动回填目标表名"
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem v-if="sinkCapabilities.supportsSchemaSaveMode" label="建表策略">
      <NPopconfirm
        :show="showSchemaConfirm"
        positive-text="确认重建"
        negative-text="取消"
        :positive-button-props="{ type: 'error' }"
        @positive-click="confirmSchemaSaveMode"
        @negative-click="cancelSchemaSaveMode"
        @update:show="(v: boolean) => { if (!v) cancelSchemaSaveMode(); }"
      >
        <template #trigger>
          <NSelect
            :value="props.config.schemaSaveMode"
            :options="schemaSaveModeOptions"
            :menu-props="selectMenuProps"
            @update:value="handleSchemaSaveModeChange"
          />
        </template>
        每次执行会删除并重建目标表，现有数据将全部丢失。确认使用此策略？
      </NPopconfirm>
    </NFormItem>
    <NFormItem v-if="sinkCapabilities.supportsDataSaveMode" label="数据处理策略">
      <NPopconfirm
        :show="showDataConfirm"
        positive-text="确认清空"
        negative-text="取消"
        :positive-button-props="{ type: 'error' }"
        @positive-click="confirmDataSaveMode"
        @negative-click="cancelDataSaveMode"
        @update:show="(v: boolean) => { if (!v) cancelDataSaveMode(); }"
      >
        <template #trigger>
          <NSelect
            :value="props.config.dataSaveMode"
            :options="dataSaveModeOptions"
            :menu-props="selectMenuProps"
            @update:value="handleDataSaveModeChange"
          />
        </template>
        每次执行前会清空目标表数据。确认使用此策略？
      </NPopconfirm>
    </NFormItem>
    <NFormItem label="写入模式">
      <NSelect v-model:value="props.config.writeMode" :options="writeModeOptions" :menu-props="selectMenuProps" />
    </NFormItem>
    <NFormItem label="主键字段">
      <NSelect
        v-model:value="props.config.primaryKeys"
        :options="fieldOptions"
        multiple
        clearable
        filterable
        :disabled="props.config.writeMode !== 'UPSERT' || fieldOptions.length === 0"
        :loading="fieldLoading"
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem label="管理字段">
      <div class="w-full flex flex-col gap-12px">
        <div
          v-for="(field, index) in managedCustomFields"
          :key="`managed-field-${index}`"
          class="rounded-12px border border-[#d9e1f2] bg-[#f8fafc] p-12px"
        >
          <div class="grid gap-12px md:grid-cols-[minmax(0,1fr),180px,72px]">
            <NInput v-model:value="field.fieldName" placeholder="字段名，如 ingest_time" />
            <NSelect v-model:value="field.valueType" :options="customFieldValueTypeOptions" :menu-props="selectMenuProps" />
            <NButton quaternary type="error" @click="removeManagedCustomField(index)">删除</NButton>
          </div>
          <div v-if="field.valueType === 'FIXED_VALUE'" class="mt-12px">
            <NInput v-model:value="field.fixedValue" placeholder="固定值内容，支持空字符串" />
          </div>
        </div>
        <NButton quaternary type="primary" class="self-start" @click="addManagedCustomField">新增字段</NButton>
        <div class="mt-4px rounded-12px border border-dashed border-[#d9e1f2] bg-[#fcfdff] p-12px">
          <div class="mb-12px text-13px text-[#4b5675] font-medium">技术主键</div>
          <div class="grid gap-12px md:grid-cols-[minmax(0,1fr),180px]">
            <NInput v-model:value="technicalKeyFieldName" placeholder="字段名，如 tech_key；留空则不生成技术主键" />
            <NSelect v-if="technicalKeyFieldName" v-model:value="technicalKeySourceMode" :options="managedFieldModeOptions" :menu-props="selectMenuProps" />
          </div>
          <div v-if="technicalKeyFieldName && technicalKeySourceMode === 'CUSTOM_FIELDS'" class="mt-12px">
            <NSelect
              v-model:value="technicalKeySourceFields"
              multiple
              tag
              filterable
              clearable
              placeholder="输入源字段名，支持多个字段拼接"
              :menu-props="selectMenuProps"
            />
          </div>
          <div
            v-if="technicalKeyFieldName && ['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(technicalKeySourceMode)"
            class="mt-12px flex items-center gap-12px"
          >
            <span class="text-13px text-[#4b5675]">包含表名</span>
            <NSwitch v-model:value="technicalKeyIncludeTableName" />
          </div>
        </div>
      </div>
    </NFormItem>
    <NAlert v-if="technicalKeyFieldName" type="info" :show-icon="false">
      技术主键支持 UUID、雪花ID、源表主键或指定字段拼接，可用于入库追踪或后续唯一标识，不会替代业务主键。
    </NAlert>
    <NAlert v-if="fieldLoading" type="info" :show-icon="false">正在加载字段元数据...</NAlert>
  </NForm>
</template>
