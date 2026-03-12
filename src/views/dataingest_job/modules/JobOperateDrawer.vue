<script setup lang="ts">
/* eslint-disable no-plusplus, no-continue, complexity, max-depth */
import { computed, nextTick, ref, watch } from 'vue';
import { NAlert, NButton, NDrawer, NDrawerContent, NSpace, NStep, NSteps } from 'naive-ui';
import { jsonClone } from '@sa/utils';
import {
  fetchCreateIngestJob,
  fetchGetIngestJob,
  fetchGetIngestJobMappings,
  fetchGetIngestJobTasks,
  fetchPreviewIngestMapping,
  fetchUpdateIngestJob,
  fetchValidateIngestJob
} from '@/service/api/dataingest';
import { fetchGetDatasourceSelect } from '@/service/api/metadata/datasource';
import { fetchGetColumns, fetchGetDatabases, fetchGetSchemas, fetchGetTables } from '@/service/api/metadata/catalog';
import BasicInfoStep from './BasicInfoStep.vue';
import MappingStep from './MappingStep.vue';
import SourceSinkStep from './SourceSinkStep.vue';

defineOptions({
  name: 'JobOperateDrawer'
});

interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData?: Api.Dataingest.IngestJob | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

type JobModel = Api.Dataingest.IngestJobOperateParams;
type SourceModel = Api.Dataingest.IngestJobSourceOperate;
type SinkModel = Api.Dataingest.IngestJobSinkOperate;
type MappingRow = Api.Dataingest.IngestFieldMappingOperate;
type SelectOption = { label: string; value: string | number };

const currentStep = ref(1);
const title = computed(() => (props.operateType === 'add' ? '新增接入作业' : '编辑接入作业'));

const loading = ref(false);
const previewLoading = ref(false);
const saveLoading = ref(false);
const hydrating = ref(false);
const suppressSourceWatch = ref(false);
const suppressSinkWatch = ref(false);
const datasourceLoading = ref(false);
const sourceDatabaseLoading = ref(false);
const sourceSchemaLoading = ref(false);
const sourceTableLoading = ref(false);
const sourceFieldLoading = ref(false);
const sinkDatabaseLoading = ref(false);
const sinkSchemaLoading = ref(false);
const sinkTableLoading = ref(false);
const sinkFieldLoading = ref(false);

const datasourceOptions = ref<{ label: string; value: CommonType.IdType }[]>([]);
const sourceDatabaseOptions = ref<SelectOption[]>([]);
const sourceSchemaOptions = ref<SelectOption[]>([]);
const sourceTableOptions = ref<SelectOption[]>([]);
const sinkDatabaseOptions = ref<SelectOption[]>([]);
const sinkSchemaOptions = ref<SelectOption[]>([]);
const sinkTableOptions = ref<SelectOption[]>([]);

const sourceFields = ref<Api.Dataingest.IngestFieldMeta[]>([]);
const targetFields = ref<Api.Dataingest.IngestFieldMeta[]>([]);
const mappingRows = ref<MappingRow[]>([]);
const mappingWarnings = ref<string[]>([]);
const validationErrors = ref<Api.Dataingest.IngestValidationMessage[]>([]);
const validationWarnings = ref<Api.Dataingest.IngestValidationMessage[]>([]);
const stepErrors = ref<string[]>([]);
const loadErrors = ref<string[]>([]);

let datasourceRequestSeq = 0;
let sourceDatabaseRequestSeq = 0;
let sourceSchemaRequestSeq = 0;
let sourceTableRequestSeq = 0;
let sourceFieldRequestSeq = 0;
let sinkDatabaseRequestSeq = 0;
let sinkSchemaRequestSeq = 0;
let sinkTableRequestSeq = 0;
let sinkFieldRequestSeq = 0;

const sourceDatabaseUuid = ref('');
const sourceSchemaUuid = ref('');
const sourceTableUuid = ref('');
const sinkDatabaseUuid = ref('');
const sinkSchemaUuid = ref('');
const sinkTableUuid = ref('');

const jobTypeOptions = [
  { label: '离线批量 (BATCH)', value: 'BATCH' },
  { label: '实时流式 (STREAM)', value: 'STREAM' },
  { label: 'CDC变更 (CDC)', value: 'CDC' }
];

const scheduleTypeOptions = [
  { label: '手动触发', value: 'MANUAL' },
  { label: 'Cron 表达式', value: 'CRON' }
];

const writeModeOptions = [
  { label: '追加写入 (APPEND)', value: 'APPEND' },
  { label: '覆盖写入 (OVERWRITE)', value: 'OVERWRITE' },
  { label: 'UPSERT', value: 'UPSERT' }
];

const readModeOptions = [
  { label: '全量读取 (FULL)', value: 'FULL' },
  { label: '增量读取 (INCREMENTAL)', value: 'INCREMENTAL' }
];

const mappingTypeOptions = [
  { label: '直接映射', value: 'DIRECT' },
  { label: '常量赋值', value: 'CONSTANT' },
  { label: '字典翻译', value: 'DICT' }
];

const statusOptions = [
  { label: '启用', value: '0' },
  { label: '停用', value: '1' }
];

const jobModel = ref<JobModel>(createDefaultJobModel());
const sourceModel = ref<SourceModel>(createDefaultSourceModel());
const sinkModel = ref<SinkModel>(createDefaultSinkModel());

function createDefaultJobModel(): JobModel {
  return {
    jobId: null,
    jobName: '',
    jobType: 'BATCH',
    scheduleType: 'MANUAL',
    scheduleExpression: null,
    parallelism: 1,
    checkpointInterval: null,
    maxRetryTimes: 3,
    alertEmail: null,
    status: '0',
    remark: null,
    srcDatasourceId: null,
    sinkDatasourceId: null
  };
}

function createDefaultSourceModel(): SourceModel {
  return {
    datasourceId: undefined,
    databaseName: '',
    schemaName: '',
    tableName: '',
    whereCondition: '',
    readMode: 'FULL',
    incrementalColumn: '',
    fieldList: []
  };
}

function createDefaultSinkModel(): SinkModel {
  return {
    datasourceId: undefined,
    databaseName: '',
    schemaName: '',
    tableName: '',
    writeMode: 'APPEND',
    primaryKeys: []
  };
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return [];
  }
}

const sourceFieldOptions = computed<SelectOption[]>(() =>
  sourceFields.value.map(field => ({ label: `${field.fieldName} (${field.dataType})`, value: field.fieldName }))
);
const targetFieldOptions = computed<SelectOption[]>(() =>
  targetFields.value.map(field => ({ label: `${field.fieldName} (${field.dataType})`, value: field.fieldName }))
);
const sourceIncrementalFieldOptions = computed<SelectOption[]>(() =>
  sourceFields.value.map(field => ({ label: field.fieldName, value: field.fieldName }))
);
const targetPrimaryKeyOptions = computed<SelectOption[]>(() =>
  targetFields.value.map(field => ({ label: field.fieldName, value: field.fieldName }))
);

async function loadDatasources() {
  const requestSeq = ++datasourceRequestSeq;
  datasourceLoading.value = true;
  loadErrors.value = [];
  const { data, error } = await fetchGetDatasourceSelect();
  if (requestSeq !== datasourceRequestSeq) return;
  datasourceLoading.value = false;
  if (!error && data) {
    datasourceOptions.value = data.map(item => ({ label: item.datasourceName, value: item.datasourceId }));
    return;
  }
  datasourceOptions.value = [];
  loadErrors.value = ['加载数据源列表失败，请关闭抽屉后重试。'];
}

function mapCatalogOptions(data: Api.Metadata.EntityInstance[]): SelectOption[] {
  return data.map(item => ({ label: item.displayName, value: item.uuid }));
}

function parseCatalogColumnProperties(properties?: string | null) {
  if (!properties) {
    return {};
  }
  try {
    return JSON.parse(properties) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapCatalogColumns(data: Api.Metadata.EntityInstance[]): Api.Dataingest.IngestFieldMeta[] {
  return data.map(item => {
    const properties = parseCatalogColumnProperties(item.properties);
    return {
      fieldName: item.displayName,
      normalizedFieldName: item.displayName.toLowerCase(),
      dataType: String(properties.dataType ?? properties.type ?? ''),
      nullable: typeof properties.nullable === 'boolean' ? properties.nullable : undefined,
      primaryKey: typeof properties.primaryKey === 'boolean' ? properties.primaryKey : undefined,
      comment: item.description,
      sortNum: typeof properties.ordinalPosition === 'number' ? properties.ordinalPosition : undefined
    };
  });
}

function findOptionLabel(options: SelectOption[], value: string) {
  return String(options.find(item => String(item.value) === value)?.label ?? '');
}

async function loadSourceDatabases() {
  if (!sourceModel.value.datasourceId) return;
  const requestSeq = ++sourceDatabaseRequestSeq;
  sourceDatabaseLoading.value = true;
  const { data, error } = await fetchGetDatabases(sourceModel.value.datasourceId);
  if (requestSeq !== sourceDatabaseRequestSeq) return;
  sourceDatabaseLoading.value = false;
  if (!error && data) {
    sourceDatabaseOptions.value = mapCatalogOptions(data);
    return;
  }
  sourceDatabaseOptions.value = [];
  loadErrors.value = ['加载源端数据库失败，请检查该数据源是否已完成元数据同步。'];
}

async function loadSourceSchemasOrTables() {
  if (!sourceDatabaseUuid.value) return;
  const requestSeq = ++sourceSchemaRequestSeq;
  sourceSchemaLoading.value = true;
  const { data, error } = await fetchGetSchemas(sourceDatabaseUuid.value);
  if (requestSeq !== sourceSchemaRequestSeq) return;
  sourceSchemaLoading.value = false;
  if (error || !data) {
    sourceSchemaOptions.value = [];
    loadErrors.value = ['加载源端 Schema 失败，请检查该数据库是否已同步。'];
    return;
  }
  if (data.length > 0) {
    sourceSchemaOptions.value = mapCatalogOptions(data);
    sourceTableOptions.value = [];
    return;
  }
  sourceSchemaOptions.value = [];
  sourceModel.value.schemaName = '';
  sourceSchemaUuid.value = '';
  await loadSourceTables(sourceDatabaseUuid.value);
}

async function loadSourceTables(parentUuid?: string) {
  const targetParentUuid = parentUuid ?? sourceSchemaUuid.value;
  if (!targetParentUuid) return;
  const requestSeq = ++sourceTableRequestSeq;
  sourceTableLoading.value = true;
  const { data, error } = await fetchGetTables(targetParentUuid);
  if (requestSeq !== sourceTableRequestSeq) return;
  sourceTableLoading.value = false;
  if (!error && data) {
    sourceTableOptions.value = mapCatalogOptions(data);
    return;
  }
  sourceTableOptions.value = [];
  loadErrors.value = ['加载源端表列表失败，请确认该表已同步到元数据目录。'];
}

async function loadSourceFields() {
  if (!sourceTableUuid.value) return;
  const requestSeq = ++sourceFieldRequestSeq;
  sourceFieldLoading.value = true;
  const { data, error } = await fetchGetColumns(sourceTableUuid.value);
  if (requestSeq !== sourceFieldRequestSeq) return;
  sourceFieldLoading.value = false;
  if (!error && data) {
    sourceFields.value = mapCatalogColumns(data);
    return;
  }
  sourceFields.value = [];
  loadErrors.value = ['加载源端字段失败，请确认该表已完成元数据同步。'];
}

async function loadSinkDatabases() {
  if (!sinkModel.value.datasourceId) return;
  const requestSeq = ++sinkDatabaseRequestSeq;
  sinkDatabaseLoading.value = true;
  const { data, error } = await fetchGetDatabases(sinkModel.value.datasourceId);
  if (requestSeq !== sinkDatabaseRequestSeq) return;
  sinkDatabaseLoading.value = false;
  if (!error && data) {
    sinkDatabaseOptions.value = mapCatalogOptions(data);
    return;
  }
  sinkDatabaseOptions.value = [];
  loadErrors.value = ['加载目标端数据库失败，请检查该数据源是否已完成元数据同步。'];
}

async function loadSinkSchemasOrTables() {
  if (!sinkDatabaseUuid.value) return;
  const requestSeq = ++sinkSchemaRequestSeq;
  sinkSchemaLoading.value = true;
  const { data, error } = await fetchGetSchemas(sinkDatabaseUuid.value);
  if (requestSeq !== sinkSchemaRequestSeq) return;
  sinkSchemaLoading.value = false;
  if (error || !data) {
    sinkSchemaOptions.value = [];
    loadErrors.value = ['加载目标端 Schema 失败，请检查该数据库是否已同步。'];
    return;
  }
  if (data.length > 0) {
    sinkSchemaOptions.value = mapCatalogOptions(data);
    sinkTableOptions.value = [];
    return;
  }
  sinkSchemaOptions.value = [];
  sinkModel.value.schemaName = '';
  sinkSchemaUuid.value = '';
  await loadSinkTables(sinkDatabaseUuid.value);
}

async function loadSinkTables(parentUuid?: string) {
  const targetParentUuid = parentUuid ?? sinkSchemaUuid.value;
  if (!targetParentUuid) return;
  const requestSeq = ++sinkTableRequestSeq;
  sinkTableLoading.value = true;
  const { data, error } = await fetchGetTables(targetParentUuid);
  if (requestSeq !== sinkTableRequestSeq) return;
  sinkTableLoading.value = false;
  if (!error && data) {
    sinkTableOptions.value = mapCatalogOptions(data);
    return;
  }
  sinkTableOptions.value = [];
  loadErrors.value = ['加载目标端表列表失败，请确认该表已同步到元数据目录。'];
}

async function loadSinkFields() {
  if (!sinkTableUuid.value) return;
  const requestSeq = ++sinkFieldRequestSeq;
  sinkFieldLoading.value = true;
  const { data, error } = await fetchGetColumns(sinkTableUuid.value);
  if (requestSeq !== sinkFieldRequestSeq) return;
  sinkFieldLoading.value = false;
  if (!error && data) {
    targetFields.value = mapCatalogColumns(data);
    return;
  }
  targetFields.value = [];
  loadErrors.value = ['加载目标端字段失败，请确认该表已完成元数据同步。'];
}

async function resetSourceSelection() {
  suppressSourceWatch.value = true;
  sourceDatabaseOptions.value = [];
  sourceSchemaOptions.value = [];
  sourceTableOptions.value = [];
  sourceFields.value = [];
  sourceDatabaseUuid.value = '';
  sourceSchemaUuid.value = '';
  sourceTableUuid.value = '';
  sourceModel.value.databaseName = '';
  sourceModel.value.schemaName = '';
  sourceModel.value.tableName = '';
  sourceModel.value.incrementalColumn = '';
  sourceModel.value.fieldList = [];
  await nextTick();
  suppressSourceWatch.value = false;
}

async function resetSinkSelection() {
  suppressSinkWatch.value = true;
  sinkDatabaseOptions.value = [];
  sinkSchemaOptions.value = [];
  sinkTableOptions.value = [];
  targetFields.value = [];
  sinkDatabaseUuid.value = '';
  sinkSchemaUuid.value = '';
  sinkTableUuid.value = '';
  sinkModel.value.databaseName = '';
  sinkModel.value.schemaName = '';
  sinkModel.value.tableName = '';
  sinkModel.value.primaryKeys = [];
  await nextTick();
  suppressSinkWatch.value = false;
}

async function resetSourceSchemaAndBelow() {
  suppressSourceWatch.value = true;
  sourceTableOptions.value = [];
  sourceFields.value = [];
  sourceSchemaUuid.value = '';
  sourceTableUuid.value = '';
  sourceModel.value.schemaName = '';
  sourceModel.value.tableName = '';
  sourceModel.value.incrementalColumn = '';
  sourceModel.value.fieldList = [];
  await nextTick();
  suppressSourceWatch.value = false;
}

async function resetSourceTableAndBelow() {
  suppressSourceWatch.value = true;
  sourceFields.value = [];
  sourceTableUuid.value = '';
  sourceModel.value.tableName = '';
  sourceModel.value.incrementalColumn = '';
  sourceModel.value.fieldList = [];
  await nextTick();
  suppressSourceWatch.value = false;
}

async function resetSinkSchemaAndBelow() {
  suppressSinkWatch.value = true;
  sinkTableOptions.value = [];
  targetFields.value = [];
  sinkSchemaUuid.value = '';
  sinkTableUuid.value = '';
  sinkModel.value.schemaName = '';
  sinkModel.value.tableName = '';
  sinkModel.value.primaryKeys = [];
  await nextTick();
  suppressSinkWatch.value = false;
}

async function resetSinkTableAndBelow() {
  suppressSinkWatch.value = true;
  targetFields.value = [];
  sinkTableUuid.value = '';
  sinkModel.value.tableName = '';
  sinkModel.value.primaryKeys = [];
  await nextTick();
  suppressSinkWatch.value = false;
}

function resetMappings() {
  mappingRows.value = [];
  mappingWarnings.value = [];
  validationErrors.value = [];
  validationWarnings.value = [];
}

function resetStepFeedback() {
  stepErrors.value = [];
  loadErrors.value = [];
}

function validateStepOne() {
  const errors: string[] = [];
  if (!jobModel.value.jobName?.trim()) {
    errors.push('请先填写作业名称。');
  }
  if (!jobModel.value.jobType) {
    errors.push('请选择作业类型。');
  }
  if (!jobModel.value.scheduleType) {
    errors.push('请选择调度方式。');
  }
  if (jobModel.value.scheduleType === 'CRON' && !jobModel.value.scheduleExpression?.trim()) {
    errors.push('Cron 调度方式必须填写表达式。');
  }
  stepErrors.value = errors;
  return errors.length === 0;
}

function validateStepTwo() {
  const errors: string[] = [];
  if (!sourceModel.value.datasourceId) {
    errors.push('请选择源数据源。');
  }
  if (!sourceModel.value.databaseName) {
    errors.push('请选择已同步的源数据库。');
  }
  if (!sourceModel.value.tableName) {
    errors.push('请选择已同步的源表。');
  }
  if (!sinkModel.value.datasourceId) {
    errors.push('请选择目标数据源。');
  }
  if (!sinkModel.value.databaseName) {
    errors.push('请选择已同步的目标数据库。');
  }
  if (!sinkModel.value.tableName) {
    errors.push('请选择已同步的目标表。');
  }
  if (sourceModel.value.readMode === 'INCREMENTAL' && !sourceModel.value.incrementalColumn) {
    errors.push('增量读取必须配置增量字段。');
  }
  stepErrors.value = errors;
  return errors.length === 0;
}

function handleNextStep() {
  resetStepFeedback();
  if (currentStep.value === 1 && !validateStepOne()) return;
  if (currentStep.value === 2 && !validateStepTwo()) return;
  currentStep.value += 1;
}

function getMappingRowMessages(row: MappingRow) {
  const messages: string[] = [];
  const targetField = row.targetField?.trim();
  const sourceField = row.sourceField?.trim();
  for (const item of [...validationErrors.value, ...validationWarnings.value]) {
    const message = item.message || '';
    if (!message) continue;
    if (targetField && message.includes(targetField)) {
      messages.push(message);
      continue;
    }
    if (sourceField && message.includes(sourceField)) {
      messages.push(message);
    }
  }
  return [...new Set(messages)];
}

async function handleSourceDatasourceChange(value: CommonType.IdType | null) {
  resetStepFeedback();
  sourceModel.value.datasourceId = value ?? undefined;
  if (hydrating.value || !visible.value) return;
  await resetSourceSelection();
  resetMappings();
  if (sourceModel.value.datasourceId) {
    await loadSourceDatabases();
  }
}

async function handleSourceDatabaseChange(value: string | null) {
  resetStepFeedback();
  sourceDatabaseUuid.value = value ?? '';
  sourceModel.value.databaseName = sourceDatabaseUuid.value
    ? findOptionLabel(sourceDatabaseOptions.value, sourceDatabaseUuid.value)
    : '';
  if (hydrating.value || !visible.value || suppressSourceWatch.value) return;
  await resetSourceSchemaAndBelow();
  resetMappings();
  if (sourceDatabaseUuid.value) {
    await loadSourceSchemasOrTables();
  }
}

async function handleSourceSchemaChange(value: string | null) {
  resetStepFeedback();
  sourceSchemaUuid.value = value ?? '';
  sourceModel.value.schemaName = sourceSchemaUuid.value
    ? findOptionLabel(sourceSchemaOptions.value, sourceSchemaUuid.value)
    : '';
  if (hydrating.value || !visible.value || suppressSourceWatch.value) return;
  await resetSourceTableAndBelow();
  resetMappings();
  if (sourceSchemaUuid.value) {
    await loadSourceTables();
  }
}

async function handleSourceTableChange(value: string | null) {
  resetStepFeedback();
  sourceTableUuid.value = value ?? '';
  sourceModel.value.tableName = sourceTableUuid.value
    ? findOptionLabel(sourceTableOptions.value, sourceTableUuid.value)
    : '';
  if (hydrating.value || !visible.value || suppressSourceWatch.value) return;
  sourceFields.value = [];
  sourceModel.value.fieldList = [];
  sourceModel.value.incrementalColumn = '';
  resetMappings();
  if (sourceTableUuid.value) {
    await loadSourceFields();
  }
}

async function handleSinkDatasourceChange(value: CommonType.IdType | null) {
  resetStepFeedback();
  sinkModel.value.datasourceId = value ?? undefined;
  if (hydrating.value || !visible.value) return;
  await resetSinkSelection();
  resetMappings();
  if (sinkModel.value.datasourceId) {
    await loadSinkDatabases();
  }
}

async function handleSinkDatabaseChange(value: string | null) {
  resetStepFeedback();
  sinkDatabaseUuid.value = value ?? '';
  sinkModel.value.databaseName = sinkDatabaseUuid.value
    ? findOptionLabel(sinkDatabaseOptions.value, sinkDatabaseUuid.value)
    : '';
  if (hydrating.value || !visible.value || suppressSinkWatch.value) return;
  await resetSinkSchemaAndBelow();
  resetMappings();
  if (sinkDatabaseUuid.value) {
    await loadSinkSchemasOrTables();
  }
}

async function handleSinkSchemaChange(value: string | null) {
  resetStepFeedback();
  sinkSchemaUuid.value = value ?? '';
  sinkModel.value.schemaName = sinkSchemaUuid.value
    ? findOptionLabel(sinkSchemaOptions.value, sinkSchemaUuid.value)
    : '';
  if (hydrating.value || !visible.value || suppressSinkWatch.value) return;
  await resetSinkTableAndBelow();
  resetMappings();
  if (sinkSchemaUuid.value) {
    await loadSinkTables();
  }
}

async function handleSinkTableChange(value: string | null) {
  resetStepFeedback();
  sinkTableUuid.value = value ?? '';
  sinkModel.value.tableName = sinkTableUuid.value ? findOptionLabel(sinkTableOptions.value, sinkTableUuid.value) : '';
  if (hydrating.value || !visible.value || suppressSinkWatch.value) return;
  targetFields.value = [];
  sinkModel.value.primaryKeys = [];
  resetMappings();
  if (sinkTableUuid.value) {
    await loadSinkFields();
  }
}

function createEmptyMappingRow(): MappingRow {
  return {
    sourceNodeCode: 'src_1',
    targetNodeCode: 'sink_1',
    sourceField: undefined,
    sourceDataType: undefined,
    targetField: '',
    targetDataType: undefined,
    mappingType: 'DIRECT',
    transformExpr: '',
    dictType: '',
    constantValue: '',
    isEnable: '1',
    sortNum: mappingRows.value.length + 1
  };
}

function applyFieldMetaToRow(row: MappingRow) {
  const sourceField = sourceFields.value.find(item => item.fieldName === row.sourceField);
  const targetField = targetFields.value.find(item => item.fieldName === row.targetField);
  row.sourceDataType = sourceField?.dataType;
  row.targetDataType = targetField?.dataType;
}

async function handlePreviewMapping() {
  resetStepFeedback();
  if (
    !sourceModel.value.datasourceId ||
    !sourceModel.value.tableName ||
    !sinkModel.value.datasourceId ||
    !sinkModel.value.tableName
  ) {
    window.$message?.warning('请先选择源表和目标表');
    return;
  }
  previewLoading.value = true;
  const { data, error } = await fetchPreviewIngestMapping({
    srcDatasourceId: sourceModel.value.datasourceId,
    srcDatabaseName: sourceModel.value.databaseName ?? null,
    srcSchemaName: sourceModel.value.schemaName ?? null,
    srcTableName: sourceModel.value.tableName,
    sinkDatasourceId: sinkModel.value.datasourceId,
    sinkDatabaseName: sinkModel.value.databaseName ?? null,
    sinkSchemaName: sinkModel.value.schemaName ?? null,
    sinkTableName: sinkModel.value.tableName
  });
  previewLoading.value = false;
  if (error || !data) return;

  sourceFields.value = data.sourceFields;
  targetFields.value = data.targetFields;
  mappingRows.value = data.mappings.map((item, index) => ({
    sourceNodeCode: 'src_1',
    targetNodeCode: 'sink_1',
    sourceField: item.sourceField,
    sourceDataType: item.sourceDataType,
    targetField: item.targetField || '',
    targetDataType: item.targetDataType,
    mappingType: item.mappingType,
    dictType: '',
    constantValue: '',
    transformExpr: '',
    isEnable: '1',
    sortNum: index + 1
  }));
  mappingWarnings.value = data.warnings;
}

function addMappingRow() {
  mappingRows.value.push(createEmptyMappingRow());
}

function removeMappingRow(index: number) {
  mappingRows.value.splice(index, 1);
  mappingRows.value.forEach((item, idx) => {
    item.sortNum = idx + 1;
  });
}

async function handleValidate() {
  resetStepFeedback();
  const payload = buildValidatePayload();
  const { data, error } = await fetchValidateIngestJob(payload);
  if (error || !data) {
    return false;
  }
  validationErrors.value = data.errors;
  validationWarnings.value = data.warnings;
  if (!data.valid) {
    window.$message?.error('校验未通过，请修正错误后再保存');
    return false;
  }
  if (data.warnings.length > 0) {
    window.$message?.warning('校验通过，但存在风险提示');
  } else {
    window.$message?.success('校验通过');
  }
  return true;
}

function buildTasks(): Api.Dataingest.IngestJobTask[] {
  return [
    {
      nodeCode: 'src_1',
      nodeName: '源表',
      taskType: 'SOURCE',
      pluginType: 'JDBC',
      datasourceId: sourceModel.value.datasourceId,
      databaseName: sourceModel.value.databaseName,
      schemaName: sourceModel.value.schemaName,
      tableName: sourceModel.value.tableName,
      whereCondition: sourceModel.value.whereCondition,
      readMode: sourceModel.value.readMode,
      incrementalColumn: sourceModel.value.incrementalColumn,
      fieldList: sourceModel.value.fieldList,
      sortNum: 1
    },
    {
      nodeCode: 'sink_1',
      nodeName: '目标表',
      taskType: 'SINK',
      pluginType: 'JDBC',
      datasourceId: sinkModel.value.datasourceId,
      databaseName: sinkModel.value.databaseName,
      schemaName: sinkModel.value.schemaName,
      tableName: sinkModel.value.tableName,
      writeMode: sinkModel.value.writeMode,
      primaryKeys: sinkModel.value.primaryKeys,
      sortNum: 2
    }
  ];
}

function buildPayload(): Api.Dataingest.IngestJobWithTasksParams {
  const normalizedMappings = mappingRows.value
    .filter(item => item.targetField)
    .map((item, index) => ({
      ...item,
      sourceNodeCode: 'src_1',
      targetNodeCode: 'sink_1',
      mappingType: item.mappingType || 'DIRECT',
      isEnable: item.isEnable || '1',
      sortNum: index + 1
    }));

  return {
    job: {
      ...jobModel.value,
      srcDatasourceId: sourceModel.value.datasourceId ?? null,
      sinkDatasourceId: sinkModel.value.datasourceId ?? null
    },
    tasks: buildTasks(),
    fieldMappings: normalizedMappings
  };
}

function buildValidatePayload(): Api.Dataingest.IngestJobValidateParams {
  return {
    job: {
      ...jobModel.value,
      srcDatasourceId: sourceModel.value.datasourceId ?? null,
      sinkDatasourceId: sinkModel.value.datasourceId ?? null
    },
    source: jsonClone(sourceModel.value),
    sink: jsonClone(sinkModel.value),
    fieldMappings: jsonClone(
      mappingRows.value.map((item, index) => ({
        ...item,
        sourceNodeCode: 'src_1',
        targetNodeCode: 'sink_1',
        mappingType: item.mappingType || 'DIRECT',
        isEnable: item.isEnable || '1',
        sortNum: index + 1
      }))
    )
  };
}

async function handleSubmit() {
  const valid = await handleValidate();
  if (!valid) return;

  saveLoading.value = true;
  const payload = buildPayload();
  const request = props.operateType === 'add' ? fetchCreateIngestJob(payload) : fetchUpdateIngestJob(payload);
  const { error } = await request;
  saveLoading.value = false;
  if (error) return;

  window.$message?.success('保存成功');
  visible.value = false;
  emit('submitted');
}

async function loadEditDetail() {
  if (!(props.operateType === 'edit' && props.rowData?.jobId)) {
    return;
  }

  loading.value = true;
  hydrating.value = true;
  try {
    const jobId = props.rowData.jobId;
    const [{ data: jobData }, { data: tasks }, { data: mappings }] = await Promise.all([
      fetchGetIngestJob(jobId),
      fetchGetIngestJobTasks(jobId),
      fetchGetIngestJobMappings(jobId)
    ]);

    if (jobData) {
      Object.assign(jobModel.value, jsonClone(jobData));
    }

    const sourceTask = tasks?.find(item => item.taskType === 'SOURCE');
    const sinkTask = tasks?.find(item => item.taskType === 'SINK');

    if (sourceTask) {
      sourceModel.value = {
        datasourceId: sourceTask.datasourceId,
        databaseName: sourceTask.databaseName,
        schemaName: sourceTask.schemaName,
        tableName: sourceTask.tableName,
        whereCondition: sourceTask.whereCondition,
        readMode: sourceTask.readMode ?? 'FULL',
        incrementalColumn: sourceTask.incrementalColumn,
        fieldList: ensureStringArray(sourceTask.fieldList)
      };
      if (sourceTask.datasourceId) {
        await loadSourceDatabases();
        const matchedDatabase = sourceDatabaseOptions.value.find(
          item => String(item.label) === String(sourceTask.databaseName)
        );
        if (matchedDatabase) {
          sourceDatabaseUuid.value = String(matchedDatabase.value);
          sourceModel.value.databaseName = String(matchedDatabase.label);
          await loadSourceSchemasOrTables();
          if (sourceSchemaOptions.value.length > 0 && sourceTask.schemaName) {
            const matchedSchema = sourceSchemaOptions.value.find(
              item => String(item.label) === String(sourceTask.schemaName)
            );
            if (matchedSchema) {
              sourceSchemaUuid.value = String(matchedSchema.value);
              sourceModel.value.schemaName = String(matchedSchema.label);
              await loadSourceTables();
            }
          }
          const matchedTable = sourceTableOptions.value.find(
            item => String(item.label) === String(sourceTask.tableName)
          );
          if (matchedTable) {
            sourceTableUuid.value = String(matchedTable.value);
            sourceModel.value.tableName = String(matchedTable.label);
            await loadSourceFields();
          }
        }
      }
    }

    if (sinkTask) {
      sinkModel.value = {
        datasourceId: sinkTask.datasourceId,
        databaseName: sinkTask.databaseName,
        schemaName: sinkTask.schemaName,
        tableName: sinkTask.tableName,
        writeMode: sinkTask.writeMode ?? 'APPEND',
        primaryKeys: ensureStringArray(sinkTask.primaryKeys)
      };
      if (sinkTask.datasourceId) {
        await loadSinkDatabases();
        const matchedDatabase = sinkDatabaseOptions.value.find(
          item => String(item.label) === String(sinkTask.databaseName)
        );
        if (matchedDatabase) {
          sinkDatabaseUuid.value = String(matchedDatabase.value);
          sinkModel.value.databaseName = String(matchedDatabase.label);
          await loadSinkSchemasOrTables();
          if (sinkSchemaOptions.value.length > 0 && sinkTask.schemaName) {
            const matchedSchema = sinkSchemaOptions.value.find(
              item => String(item.label) === String(sinkTask.schemaName)
            );
            if (matchedSchema) {
              sinkSchemaUuid.value = String(matchedSchema.value);
              sinkModel.value.schemaName = String(matchedSchema.label);
              await loadSinkTables();
            }
          }
          const matchedTable = sinkTableOptions.value.find(item => String(item.label) === String(sinkTask.tableName));
          if (matchedTable) {
            sinkTableUuid.value = String(matchedTable.value);
            sinkModel.value.tableName = String(matchedTable.label);
            await loadSinkFields();
          }
        }
      }
    }

    mappingRows.value = (mappings ?? []).map((item, index) => ({
      ...item,
      mappingType: item.mappingType ?? 'DIRECT',
      isEnable: item.isEnable ?? '1',
      sortNum: item.sortNum ?? index + 1
    }));
    mappingRows.value.forEach(applyFieldMetaToRow);
  } finally {
    hydrating.value = false;
    loading.value = false;
  }
}

function resetState() {
  currentStep.value = 1;
  jobModel.value = createDefaultJobModel();
  sourceModel.value = createDefaultSourceModel();
  sinkModel.value = createDefaultSinkModel();
  sourceSchemaOptions.value = [];
  sourceTableOptions.value = [];
  sourceDatabaseOptions.value = [];
  sinkSchemaOptions.value = [];
  sinkTableOptions.value = [];
  sinkDatabaseOptions.value = [];
  sourceFields.value = [];
  targetFields.value = [];
  sourceDatabaseUuid.value = '';
  sourceSchemaUuid.value = '';
  sourceTableUuid.value = '';
  sinkDatabaseUuid.value = '';
  sinkSchemaUuid.value = '';
  sinkTableUuid.value = '';
  mappingRows.value = [];
  mappingWarnings.value = [];
  validationErrors.value = [];
  validationWarnings.value = [];
  stepErrors.value = [];
  loadErrors.value = [];
}

watch(visible, async value => {
  if (!value) return;
  resetState();
  await loadDatasources();
  await loadEditDetail();
});
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="920">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSteps :current="currentStep" size="small" class="mb-24px">
        <NStep title="基本信息" />
        <NStep title="源表与目标表" />
        <NStep title="字段映射" />
      </NSteps>

      <NAlert v-if="stepErrors.length" type="error" :show-icon="true" class="mb-16px">
        <div v-for="error in stepErrors" :key="error">{{ error }}</div>
      </NAlert>
      <NAlert v-if="loadErrors.length" type="error" :show-icon="true" class="mb-16px">
        <div v-for="error in loadErrors" :key="error">{{ error }}</div>
      </NAlert>

      <BasicInfoStep
        v-if="currentStep === 1"
        :model="jobModel"
        :job-type-options="jobTypeOptions"
        :schedule-type-options="scheduleTypeOptions"
        :status-options="statusOptions"
      />

      <SourceSinkStep
        v-else-if="currentStep === 2"
        :datasource-options="datasourceOptions"
        :source-database-options="sourceDatabaseOptions"
        :source-schema-options="sourceSchemaOptions"
        :source-table-options="sourceTableOptions"
        :sink-database-options="sinkDatabaseOptions"
        :sink-schema-options="sinkSchemaOptions"
        :sink-table-options="sinkTableOptions"
        :source-incremental-field-options="sourceIncrementalFieldOptions"
        :target-primary-key-options="targetPrimaryKeyOptions"
        :read-mode-options="readModeOptions"
        :write-mode-options="writeModeOptions"
        :source-model="sourceModel"
        :sink-model="sinkModel"
        :datasource-loading="datasourceLoading"
        :source-database-loading="sourceDatabaseLoading"
        :source-schema-loading="sourceSchemaLoading"
        :source-table-loading="sourceTableLoading"
        :source-field-loading="sourceFieldLoading"
        :sink-database-loading="sinkDatabaseLoading"
        :sink-schema-loading="sinkSchemaLoading"
        :sink-table-loading="sinkTableLoading"
        :sink-field-loading="sinkFieldLoading"
        @source-datasource-change="handleSourceDatasourceChange"
        @source-database-change="handleSourceDatabaseChange"
        @source-schema-change="handleSourceSchemaChange"
        @source-table-change="handleSourceTableChange"
        @sink-datasource-change="handleSinkDatasourceChange"
        @sink-database-change="handleSinkDatabaseChange"
        @sink-schema-change="handleSinkSchemaChange"
        @sink-table-change="handleSinkTableChange"
      />

      <MappingStep
        v-else
        :preview-loading="previewLoading"
        :source-fields="sourceFields"
        :target-fields="targetFields"
        :source-field-options="sourceFieldOptions"
        :target-field-options="targetFieldOptions"
        :mapping-rows="mappingRows"
        :mapping-warnings="mappingWarnings"
        :validation-errors="validationErrors"
        :validation-warnings="validationWarnings"
        :mapping-type-options="mappingTypeOptions"
        :get-mapping-row-messages="getMappingRowMessages"
        @preview="handlePreviewMapping"
        @add-row="addMappingRow"
        @remove-row="removeMappingRow"
        @row-change="applyFieldMetaToRow"
      />

      <template #footer>
        <div class="w-full flex items-center justify-between">
          <NButton v-if="currentStep > 1" @click="currentStep -= 1">上一步</NButton>
          <div v-else />
          <NSpace>
            <NButton @click="visible = false">取消</NButton>
            <NButton v-if="currentStep < 3" type="primary" @click="handleNextStep">下一步</NButton>
            <template v-else>
              <NButton :loading="loading" @click="handleValidate">校验</NButton>
              <NButton type="primary" :loading="saveLoading" :disabled="previewLoading" @click="handleSubmit">
                保存
              </NButton>
            </template>
          </NSpace>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
