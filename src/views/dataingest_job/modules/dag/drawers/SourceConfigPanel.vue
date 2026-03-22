<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { computed, onMounted, ref, watch } from 'vue';
import { NAlert, NDynamicTags, NForm, NFormItem, NInput, NSelect } from 'naive-ui';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import { type SelectOption, findOptionLabel, mapCatalogColumns, mapCatalogOptions } from '../utils/catalog';

defineOptions({ name: 'SourceConfigPanel' });

type SourceConfig = Pick<
  Api.Dataingest.IngestJobTask,
  | 'datasourceId'
  | 'databaseName'
  | 'schemaName'
  | 'tableName'
  | 'whereCondition'
  | 'readMode'
  | 'incrementalColumn'
  | 'fieldList'
>;

interface Props {
  config: SourceConfig;
  datasourceOptions: { label: string; value: CommonType.IdType }[];
}

const props = defineProps<Props>();

const databaseOptions = ref<SelectOption[]>([]);
const schemaOptions = ref<SelectOption[]>([]);
const tableOptions = ref<SelectOption[]>([]);
const fields = ref<Api.Dataingest.IngestFieldMeta[]>([]);

const selectedDatabaseUuid = ref('');
const selectedSchemaUuid = ref('');
const selectedTableUuid = ref('');

const databaseLoading = ref(false);
const schemaLoading = ref(false);
const tableLoading = ref(false);
const fieldLoading = ref(false);
const hydrating = ref(false);

const readModeOptions = [
  { label: '全量读取 (FULL)', value: 'FULL' },
  { label: '增量读取 (INCREMENTAL)', value: 'INCREMENTAL' }
];

const incrementalFieldOptions = computed(() =>
  fields.value.map(item => ({ label: `${item.fieldName} (${item.dataType})`, value: item.fieldName }))
);

const selectMenuProps = { style: { zIndex: 2200 } };

const fieldTagDisabled = computed(() => !props.config.tableName || fieldLoading.value);

function ensureFieldList() {
  if (Array.isArray(props.config.fieldList)) {
    props.config.fieldList = props.config.fieldList.map(item => String(item));
    return;
  }
  if (!props.config.fieldList) {
    props.config.fieldList = [];
    return;
  }
  try {
    const parsed = JSON.parse(String(props.config.fieldList));
    props.config.fieldList = Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    props.config.fieldList = [];
  }
}

function resetAfterDatasource() {
  databaseOptions.value = [];
  schemaOptions.value = [];
  tableOptions.value = [];
  fields.value = [];
  selectedDatabaseUuid.value = '';
  selectedSchemaUuid.value = '';
  selectedTableUuid.value = '';
  props.config.databaseName = '';
  props.config.schemaName = '';
  props.config.tableName = '';
  props.config.incrementalColumn = '';
  props.config.fieldList = [];
}

function resetAfterDatabase() {
  schemaOptions.value = [];
  tableOptions.value = [];
  fields.value = [];
  selectedSchemaUuid.value = '';
  selectedTableUuid.value = '';
  props.config.schemaName = '';
  props.config.tableName = '';
  props.config.incrementalColumn = '';
  props.config.fieldList = [];
}

function resetAfterSchema() {
  tableOptions.value = [];
  fields.value = [];
  selectedTableUuid.value = '';
  props.config.tableName = '';
  props.config.incrementalColumn = '';
  props.config.fieldList = [];
}

async function loadDatabases(datasourceId: CommonType.IdType, restoring = false) {
  databaseLoading.value = true;
  const { data, error } = await fetchGetDatabases(datasourceId);
  databaseLoading.value = false;
  databaseOptions.value = !error && data ? mapCatalogOptions(data) : [];
  if (!restoring) return;
  if (!props.config.databaseName) return;
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
  fields.value = !error && data ? mapCatalogColumns(data) : [];
}

async function hydrateFromConfig() {
  hydrating.value = true;
  const savedDb = props.config.databaseName;
  const savedSchema = props.config.schemaName;
  const savedTable = props.config.tableName;
  const savedIncrementalColumn = props.config.incrementalColumn;
  const savedFieldList = props.config.fieldList;
  resetAfterDatasource();
  props.config.databaseName = savedDb;
  props.config.schemaName = savedSchema;
  props.config.tableName = savedTable;
  props.config.incrementalColumn = savedIncrementalColumn;
  props.config.fieldList = savedFieldList;
  ensureFieldList();
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
  props.config.incrementalColumn = '';
  props.config.fieldList = [];
  fields.value = [];
  if (value) {
    await loadFields(value);
  }
});

watch(
  () => props.config.readMode,
  value => {
    if (value !== 'INCREMENTAL') {
      props.config.incrementalColumn = '';
    }
  }
);

onMounted(async () => {
  props.config.readMode ??= 'FULL';
  ensureFieldList();
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
    <NFormItem label="读取模式">
      <NSelect v-model:value="props.config.readMode" :options="readModeOptions" :menu-props="selectMenuProps" />
    </NFormItem>
    <NFormItem label="增量字段">
      <NSelect
        v-model:value="props.config.incrementalColumn"
        :options="incrementalFieldOptions"
        :disabled="props.config.readMode !== 'INCREMENTAL' || incrementalFieldOptions.length === 0"
        filterable
        clearable
        :loading="fieldLoading"
        :menu-props="selectMenuProps"
      />
    </NFormItem>
    <NFormItem label="WHERE 条件">
      <NInput v-model:value="props.config.whereCondition" placeholder="status = 1" />
    </NFormItem>
    <NFormItem label="字段列表">
      <NDynamicTags v-model:value="props.config.fieldList" :disabled="fieldTagDisabled" />
    </NFormItem>
    <NAlert v-if="fieldLoading" type="info" :show-icon="false">正在加载字段元数据...</NAlert>
  </NForm>
</template>
