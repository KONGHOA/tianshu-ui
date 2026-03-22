<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { onMounted, ref, watch } from 'vue';
import { NAlert, NForm, NFormItem, NSelect } from 'naive-ui';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import { type SelectOption, findOptionLabel, mapCatalogColumns, mapCatalogOptions } from '../utils/catalog';

defineOptions({ name: 'SinkConfigPanel' });

type SinkConfig = Pick<
  Api.Dataingest.IngestJobTask,
  'datasourceId' | 'databaseName' | 'schemaName' | 'tableName' | 'writeMode' | 'primaryKeys'
>;

interface Props {
  config: SinkConfig;
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

const writeModeOptions = [
  { label: '追加写入 (APPEND)', value: 'APPEND' },
  { label: '覆盖写入 (OVERWRITE)', value: 'OVERWRITE' },
  { label: 'UPSERT', value: 'UPSERT' }
];

const selectMenuProps = { style: { zIndex: 2200 } };

function ensurePrimaryKeys() {
  if (Array.isArray(props.config.primaryKeys)) {
    props.config.primaryKeys = props.config.primaryKeys.map(item => String(item));
    return;
  }
  props.config.primaryKeys = [];
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

async function hydrateFromConfig() {
  hydrating.value = true;
  const savedDb = props.config.databaseName;
  const savedSchema = props.config.schemaName;
  const savedTable = props.config.tableName;
  const savedPrimaryKeys = props.config.primaryKeys;
  const savedWriteMode = props.config.writeMode;
  resetAfterDatasource();
  props.config.databaseName = savedDb;
  props.config.schemaName = savedSchema;
  props.config.tableName = savedTable;
  props.config.primaryKeys = savedPrimaryKeys;
  props.config.writeMode = savedWriteMode;
  ensurePrimaryKeys();
  if (props.config.datasourceId) {
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
      await loadDatabases(value);
    }
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

onMounted(async () => {
  props.config.writeMode ??= 'APPEND';
  ensurePrimaryKeys();
  await hydrateFromConfig();
});
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
      <NSelect
        v-model:value="selectedTableUuid"
        :options="tableOptions"
        :disabled="tableOptions.length === 0"
        :loading="tableLoading"
        filterable
        clearable
        :menu-props="selectMenuProps"
      />
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
    <NAlert v-if="fieldLoading" type="info" :show-icon="false">正在加载字段元数据...</NAlert>
  </NForm>
</template>
