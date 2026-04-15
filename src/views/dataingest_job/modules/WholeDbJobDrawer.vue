<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NCard,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch
} from 'naive-ui';
import { jsonClone } from '@sa/utils';
import {
  fetchCreateIngestJob,
  fetchGetIngestJob,
  fetchGetIngestJobLines,
  fetchGetIngestJobTableConfigs,
  fetchGetIngestJobTasks,
  fetchGetIngestSinkCapabilities,
  fetchUpdateIngestJob
} from '@/service/api/dataingest';
import { fetchGetDatasourceSelect } from '@/service/api/metadata/datasource';
import BasicInfoStep from './BasicInfoStep.vue';
import WholeDbConfigPanel from './WholeDbConfigPanel.vue';
import DbSchemaSelector from './DbSchemaSelector.vue';

defineOptions({ name: 'WholeDbJobDrawer' });

interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData?: Api.Dataingest.IngestJob | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = defineModel<boolean>('visible', { default: false });
const title = computed(() => (props.operateType === 'add' ? '新增作业 (整库同步)' : '编辑作业 (整库同步)'));

const saveLoading = ref(false);
const datasourceOptions = ref<{ label: string; value: CommonType.IdType }[]>([]);

const jobTypeOptions = [
  { label: '离线批量 (BATCH)', value: 'BATCH' },
  { label: '实时流式 (STREAM)', value: 'STREAM' },
  { label: 'CDC变更 (CDC)', value: 'CDC' }
];
const scheduleTypeOptions = [
  { label: '手动触发', value: 'MANUAL' },
  { label: 'Cron 表达式', value: 'CRON' }
];
const statusOptions = [
  { label: '启用', value: '0' },
  { label: '停用', value: '1' }
];

const jobModel = ref<Api.Dataingest.IngestJobOperateParams>({
  jobName: '',
  jobType: 'BATCH',
  syncMode: 'WHOLE_DATABASE',
  scheduleType: 'MANUAL',
  scheduleExpression: '',
  status: '0',
  remark: ''
});

const sourceModel = ref({ datasourceId: null as CommonType.IdType | null, databaseName: '', schemaName: '' });
const targetModel = ref({ datasourceId: null as CommonType.IdType | null, databaseName: '', schemaName: '' });
const sinkStrategyModel = ref<Pick<Api.Dataingest.IngestJobTask, 'schemaSaveMode' | 'dataSaveMode' | 'writeMode'>>({
  schemaSaveMode: 'CREATE_SCHEMA_WHEN_NOT_EXIST',
  dataSaveMode: 'APPEND_DATA',
  writeMode: 'APPEND'
});
const sinkCapabilities = ref<Api.Dataingest.IngestSinkCapability>({
  supportsSchemaSaveMode: false,
  supportsDataSaveMode: false
});
const capabilityLoading = ref(false);
const showSchemaConfirm = ref(false);
const showDataConfirm = ref(false);
const prevSchemaSaveMode = ref('');
const prevDataSaveMode = ref('');

const tableConfigs = ref<Api.Dataingest.IngestJobTableConfig[]>([]);
const includePattern = ref('');
const excludePattern = ref('');
const loadedTasks = ref<Api.Dataingest.IngestJobTask[]>([]);
const loadedLines = ref<Api.Dataingest.IngestJobLine[]>([]);

const schemaSaveModeOptions = [
  { label: '不存在时创建 (CREATE)', value: 'CREATE_SCHEMA_WHEN_NOT_EXIST' },
  { label: '重建表结构 (RECREATE)', value: 'RECREATE_SCHEMA' },
  { label: '不存在时报错 (ERROR)', value: 'ERROR_WHEN_SCHEMA_NOT_EXIST' },
  { label: '忽略 (IGNORE)', value: 'IGNORE' }
];

const dataSaveModeOptions = [
  { label: '追加数据 (APPEND)', value: 'APPEND_DATA' },
  { label: '清空数据 (DROP)', value: 'DROP_DATA' },
  { label: '自定义处理 (CUSTOM)', value: 'CUSTOM_PROCESSING' },
  { label: '已有数据时报错 (ERROR)', value: 'ERROR_WHEN_DATA_EXISTS' }
];

const wholeDbWriteModeOptions = [
  { label: '追加写入 (APPEND)', value: 'APPEND' },
  { label: '覆盖写入 (OVERWRITE)', value: 'OVERWRITE' }
];
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
const managedFieldsModel = ref<Api.Dataingest.IngestManagedFieldsConfig>({
  customFields: [],
  technicalKey: {
    fieldName: '',
    sourceMode: 'PRIMARY_KEYS',
    sourceFields: [],
    includeTableName: true
  }
});

function createEmptyManagedCustomField(): Api.Dataingest.IngestManagedCustomField {
  return {
    fieldName: '',
    valueType: 'CURRENT_TIME',
    fixedValue: ''
  };
}

function normalizeManagedCustomFields(
  rawManagedFields: Record<string, any>
): Api.Dataingest.IngestManagedCustomField[] {
  const customFields = Array.isArray(rawManagedFields.customFields)
    ? rawManagedFields.customFields
        .map((item: Record<string, unknown>) => ({
          fieldName: typeof item?.fieldName === 'string' ? item.fieldName : '',
          valueType: (typeof item?.valueType === 'string'
            ? item.valueType
            : 'CURRENT_TIME') as ManagedCustomFieldValueType,
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
  managedFieldsModel.value.customFields ??= [];
  managedFieldsModel.value.customFields.push(createEmptyManagedCustomField());
}

function removeManagedCustomField(index: number) {
  managedFieldsModel.value.customFields?.splice(index, 1);
}

function handleSchemaSaveModeChange(value: string) {
  if (value === 'RECREATE_SCHEMA') {
    prevSchemaSaveMode.value = sinkStrategyModel.value.schemaSaveMode ?? 'CREATE_SCHEMA_WHEN_NOT_EXIST';
    sinkStrategyModel.value.schemaSaveMode = value;
    showSchemaConfirm.value = true;
  } else {
    sinkStrategyModel.value.schemaSaveMode = value;
  }
}

function confirmSchemaSaveMode() {
  showSchemaConfirm.value = false;
}

function cancelSchemaSaveMode() {
  sinkStrategyModel.value.schemaSaveMode = prevSchemaSaveMode.value;
  showSchemaConfirm.value = false;
}

function handleDataSaveModeChange(value: string) {
  if (value === 'DROP_DATA') {
    prevDataSaveMode.value = sinkStrategyModel.value.dataSaveMode ?? 'APPEND_DATA';
    sinkStrategyModel.value.dataSaveMode = value;
    showDataConfirm.value = true;
  } else {
    sinkStrategyModel.value.dataSaveMode = value;
  }
}

function confirmDataSaveMode() {
  showDataConfirm.value = false;
}

function cancelDataSaveMode() {
  sinkStrategyModel.value.dataSaveMode = prevDataSaveMode.value;
  showDataConfirm.value = false;
}

async function loadSinkCapabilities(datasourceId: CommonType.IdType | null) {
  sinkCapabilities.value = {
    supportsSchemaSaveMode: false,
    supportsDataSaveMode: false
  };
  if (datasourceId === null) return;
  capabilityLoading.value = true;
  const { data, error } = await fetchGetIngestSinkCapabilities(datasourceId, 'JDBC');
  capabilityLoading.value = false;
  if (!error && data) {
    sinkCapabilities.value = data;
  }
}

async function loadDatasources() {
  const { data } = await fetchGetDatasourceSelect();
  if (data) {
    datasourceOptions.value = data.map(item => ({ label: item.datasourceName, value: item.datasourceId }));
  }
}

async function hydrateFromSinkTask(sinkTask: Api.Dataingest.IngestJobTask) {
  targetModel.value = {
    datasourceId: sinkTask.datasourceId ?? null,
    databaseName: sinkTask.databaseName ?? '',
    schemaName: sinkTask.schemaName ?? ''
  };
  sinkStrategyModel.value = {
    schemaSaveMode: sinkTask.schemaSaveMode ?? 'CREATE_SCHEMA_WHEN_NOT_EXIST',
    dataSaveMode: sinkTask.dataSaveMode ?? 'APPEND_DATA',
    writeMode: sinkTask.writeMode ?? 'APPEND'
  };
  const nodeConfig = parseNodeConfig(sinkTask.nodeConfig);
  const managedFields = nodeConfig.managedFields ?? {};
  managedFieldsModel.value = {
    customFields: normalizeManagedCustomFields(managedFields),
    technicalKey: {
      fieldName: managedFields.technicalKey?.fieldName ?? '',
      sourceMode: managedFields.technicalKey?.sourceMode ?? 'PRIMARY_KEYS',
      sourceFields: Array.isArray(managedFields.technicalKey?.sourceFields)
        ? managedFields.technicalKey.sourceFields.map((item: unknown) => String(item))
        : [],
      includeTableName: managedFields.technicalKey?.includeTableName ?? true
    }
  };
  await loadSinkCapabilities(sinkTask.datasourceId ?? null);
}

async function loadEditDetail() {
  if (!(props.operateType === 'edit' && props.rowData?.jobId)) return;

  const jobId = props.rowData.jobId;
  const [{ data: jobData }, { data: tasks }, { data: lines }, { data: tblConfigs }] = await Promise.all([
    fetchGetIngestJob(jobId),
    fetchGetIngestJobTasks(jobId),
    fetchGetIngestJobLines(jobId),
    fetchGetIngestJobTableConfigs(jobId)
  ]);

  if (jobData) {
    Object.assign(jobModel.value, jsonClone(jobData));
    jobModel.value.syncMode = 'WHOLE_DATABASE';
  }

  if (tasks && tasks.length >= 2) {
    loadedTasks.value = tasks;
    const srcTask = tasks.find(t => t.taskType === 'SOURCE');
    const sinkTask = tasks.find(t => t.taskType === 'SINK');

    if (srcTask) {
      sourceModel.value = {
        datasourceId: srcTask.datasourceId ?? null,
        databaseName: srcTask.databaseName ?? '',
        schemaName: srcTask.schemaName ?? ''
      };
    }
    if (sinkTask) {
      await hydrateFromSinkTask(sinkTask);
    }
  }

  if (lines) {
    loadedLines.value = lines;
  }

  if (tblConfigs) {
    tableConfigs.value = tblConfigs;
  }
}

function resetState() {
  jobModel.value = {
    jobId: props.rowData?.jobId,
    jobName: '',
    jobType: 'BATCH',
    syncMode: 'WHOLE_DATABASE',
    scheduleType: 'MANUAL',
    scheduleExpression: '',
    status: '0',
    remark: ''
  };
  sourceModel.value = { datasourceId: null, databaseName: '', schemaName: '' };
  targetModel.value = { datasourceId: null, databaseName: '', schemaName: '' };
  sinkStrategyModel.value = {
    schemaSaveMode: 'CREATE_SCHEMA_WHEN_NOT_EXIST',
    dataSaveMode: 'APPEND_DATA',
    writeMode: 'APPEND'
  };
  managedFieldsModel.value = {
    customFields: [],
    technicalKey: {
      fieldName: '',
      sourceMode: 'PRIMARY_KEYS',
      sourceFields: [],
      includeTableName: true
    }
  };
  sinkCapabilities.value = {
    supportsSchemaSaveMode: false,
    supportsDataSaveMode: false
  };
  tableConfigs.value = [];
  includePattern.value = '';
  excludePattern.value = '';
  loadedTasks.value = [];
  loadedLines.value = [];
}

function parseNodeConfig(nodeConfig?: string) {
  if (!nodeConfig) return {} as Record<string, any>;
  try {
    return JSON.parse(nodeConfig) as Record<string, any>;
  } catch {
    return {};
  }
}

function buildSinkNodeConfig() {
  const technicalKey = managedFieldsModel.value.technicalKey;
  const managedFields: Api.Dataingest.IngestManagedFieldsConfig = {};
  const normalizedCustomFields = (managedFieldsModel.value.customFields ?? [])
    .map(item => ({
      fieldName: item.fieldName?.trim() ?? '',
      valueType: item.valueType ?? 'CURRENT_TIME',
      fixedValue: item.valueType === 'FIXED_VALUE' ? (item.fixedValue ?? '') : undefined
    }))
    .filter(item => item.fieldName && item.valueType);
  if (normalizedCustomFields.length > 0) {
    managedFields.customFields = normalizedCustomFields;
  }
  if (technicalKey?.fieldName?.trim()) {
    managedFields.technicalKey = {
      fieldName: technicalKey.fieldName.trim(),
      sourceMode: technicalKey.sourceMode ?? 'PRIMARY_KEYS',
      sourceFields: technicalKey.sourceMode === 'CUSTOM_FIELDS' ? (technicalKey.sourceFields ?? []) : [],
      includeTableName: ['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(technicalKey.sourceMode ?? 'PRIMARY_KEYS')
        ? (technicalKey.includeTableName ?? true)
        : false
    };
  }
  return Object.keys(managedFields).length > 0 ? JSON.stringify({ managedFields }) : undefined;
}

watch(visible, async value => {
  if (!value) return;
  resetState();
  await loadDatasources();
  await loadEditDetail();
});

watch(
  () => targetModel.value.datasourceId,
  async value => {
    await loadSinkCapabilities(value);
  }
);

watch(
  () => managedFieldsModel.value.technicalKey?.sourceMode,
  value => {
    if (value !== 'CUSTOM_FIELDS' && managedFieldsModel.value.technicalKey) {
      managedFieldsModel.value.technicalKey.sourceFields = [];
    }
    if (!['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(value ?? '') && managedFieldsModel.value.technicalKey) {
      managedFieldsModel.value.technicalKey.includeTableName = false;
    }
  }
);

function buildSubmitPayload(): Api.Dataingest.IngestJobWithTasksParams {
  const sourceTaskId =
    props.operateType === 'edit' ? loadedTasks.value.find(t => t.taskType === 'SOURCE')?.taskId : undefined;
  const sinkTaskId =
    props.operateType === 'edit' ? loadedTasks.value.find(t => t.taskType === 'SINK')?.taskId : undefined;
  const lineId = props.operateType === 'edit' ? loadedLines.value[0]?.lineId : undefined;
  const currentJobId = props.operateType === 'edit' ? props.rowData?.jobId : undefined;

  const tasks: Api.Dataingest.IngestJobTask[] = [
    {
      ...(sourceTaskId !== undefined && currentJobId !== undefined
        ? { taskId: sourceTaskId, jobId: currentJobId }
        : {}),
      nodeCode: 'source_1',
      nodeName: '源数据库',
      taskType: 'SOURCE',
      pluginType: 'JDBC',
      datasourceId: sourceModel.value.datasourceId ?? undefined,
      databaseName: sourceModel.value.databaseName,
      schemaName: sourceModel.value.schemaName,
      posX: 100,
      posY: 100
    },
    {
      ...(sinkTaskId !== undefined && currentJobId !== undefined ? { taskId: sinkTaskId, jobId: currentJobId } : {}),
      nodeCode: 'sink_1',
      nodeName: '目标数据库',
      taskType: 'SINK',
      pluginType: 'JDBC',
      datasourceId: targetModel.value.datasourceId ?? undefined,
      databaseName: targetModel.value.databaseName,
      schemaName: targetModel.value.schemaName,
      schemaSaveMode: sinkStrategyModel.value.schemaSaveMode,
      dataSaveMode: sinkStrategyModel.value.dataSaveMode,
      writeMode: sinkStrategyModel.value.writeMode,
      nodeConfig: buildSinkNodeConfig(),
      posX: 400,
      posY: 100
    }
  ];

  const lines = [
    {
      ...(lineId !== undefined && currentJobId !== undefined ? { lineId, jobId: currentJobId } : {}),
      sourceNodeCode: 'source_1',
      targetNodeCode: 'sink_1'
    }
  ];

  return {
    job: { ...jobModel.value },
    tasks,
    lines,
    tableConfigs: tableConfigs.value
  };
}

async function handleSubmit() {
  if (!jobModel.value.jobName?.trim()) {
    window.$message?.warning('请输入作业名称');
    return;
  }
  if (!sourceModel.value.datasourceId || !targetModel.value.datasourceId) {
    window.$message?.warning('请选择源端和目标端数据源');
    return;
  }
  if (!tableConfigs.value.length) {
    window.$message?.warning('请生成并勾选需要同步的表');
    return;
  }

  const payload = buildSubmitPayload();
  saveLoading.value = true;
  const request = props.operateType === 'add' ? fetchCreateIngestJob(payload) : fetchUpdateIngestJob(payload);
  const { error } = await request;
  saveLoading.value = false;

  if (error) return;

  window.$message?.success('保存成功');
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="750" placement="right" :trap-focus="false" :z-index="1000">
    <NDrawerContent :title="title" closable class="bg-[#f9fafb]">
      <div class="flex flex-col gap-16px pb-16px">
        <NCard title="基础信息" size="small" :bordered="false" class="overflow-hidden rounded-12px shadow-sm">
          <BasicInfoStep
            :model="jobModel"
            :job-type-options="jobTypeOptions"
            :schedule-type-options="scheduleTypeOptions"
            :status-options="statusOptions"
          />
        </NCard>

        <NCard title="数据源连接" size="small" :bordered="false" class="overflow-hidden rounded-12px shadow-sm">
          <NForm label-placement="left" :label-width="80">
            <h4 class="mb-12px mt-0 border-l-3 border-[#288fff] pl-10px text-14px text-[#1c2560] font-bold">
              源端配置
            </h4>
            <DbSchemaSelector v-model:value="sourceModel" :datasource-options="datasourceOptions" />

            <h4 class="mb-12px mt-20px border-l-3 border-emerald-500 pl-10px text-14px text-[#1c2560] font-bold">
              目标端配置
            </h4>
            <DbSchemaSelector v-model:value="targetModel" :datasource-options="datasourceOptions" />
            <div class="mt-8px rounded-12px bg-emerald-50 px-16px py-12px">
              <NForm label-placement="left" :label-width="96">
                <NFormItem v-if="sinkCapabilities.supportsSchemaSaveMode" label="建表策略">
                  <NPopconfirm
                    :show="showSchemaConfirm"
                    positive-text="确认重建"
                    negative-text="取消"
                    :positive-button-props="{ type: 'error' }"
                    @positive-click="confirmSchemaSaveMode"
                    @negative-click="cancelSchemaSaveMode"
                    @update:show="
                      (v: boolean) => {
                        if (!v) cancelSchemaSaveMode();
                      }
                    "
                  >
                    <template #trigger>
                      <NSelect
                        :value="sinkStrategyModel.schemaSaveMode"
                        :options="schemaSaveModeOptions"
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
                    @update:show="
                      (v: boolean) => {
                        if (!v) cancelDataSaveMode();
                      }
                    "
                  >
                    <template #trigger>
                      <NSelect
                        :value="sinkStrategyModel.dataSaveMode"
                        :options="dataSaveModeOptions"
                        @update:value="handleDataSaveModeChange"
                      />
                    </template>
                    每次执行前会清空目标表数据。确认使用此策略？
                  </NPopconfirm>
                </NFormItem>
                <NFormItem label="写入模式">
                  <NSelect v-model:value="sinkStrategyModel.writeMode" :options="wholeDbWriteModeOptions" />
                </NFormItem>
                <NFormItem label="管理字段">
                  <div class="w-full flex flex-col gap-12px">
                    <div
                      v-for="(field, index) in managedFieldsModel.customFields"
                      :key="`whole-managed-field-${index}`"
                      class="border border-[#d9e1f2] rounded-12px bg-[#f8fafc] p-12px"
                    >
                      <div class="grid gap-12px md:grid-cols-[minmax(0,1fr),180px,72px]">
                        <NInput v-model:value="field.fieldName" placeholder="字段名，如 ingest_time" />
                        <NSelect v-model:value="field.valueType" :options="customFieldValueTypeOptions" />
                        <NButton quaternary type="error" @click="removeManagedCustomField(index)">删除</NButton>
                      </div>
                      <div v-if="field.valueType === 'FIXED_VALUE'" class="mt-12px">
                        <NInput v-model:value="field.fixedValue" placeholder="固定值内容，支持空字符串" />
                      </div>
                    </div>
                    <NButton quaternary type="primary" class="self-start" @click="addManagedCustomField">
                      新增字段
                    </NButton>
                    <div class="mt-4px border border-[#d9e1f2] rounded-12px border-dashed bg-[#fcfdff] p-12px">
                      <div class="mb-12px text-13px text-[#4b5675] font-medium">技术主键</div>
                      <div class="grid gap-12px md:grid-cols-[minmax(0,1fr),180px]">
                        <NInput
                          v-model:value="managedFieldsModel.technicalKey!.fieldName"
                          placeholder="字段名，如 tech_key；留空则不生成技术主键"
                        />
                        <NSelect
                          v-if="managedFieldsModel.technicalKey?.fieldName"
                          v-model:value="managedFieldsModel.technicalKey!.sourceMode"
                          :options="managedFieldModeOptions.filter(item => item.value !== 'CUSTOM_FIELDS')"
                        />
                      </div>
                      <div
                        v-if="
                          managedFieldsModel.technicalKey?.fieldName &&
                          ['PRIMARY_KEYS', 'CUSTOM_FIELDS'].includes(managedFieldsModel.technicalKey?.sourceMode ?? '')
                        "
                        class="mt-12px flex items-center gap-12px"
                      >
                        <span class="text-13px text-[#4b5675]">包含表名</span>
                        <NSwitch v-model:value="managedFieldsModel.technicalKey!.includeTableName" />
                      </div>
                    </div>
                  </div>
                </NFormItem>
              </NForm>
              <NAlert v-if="capabilityLoading" type="info" :show-icon="false">正在加载目标端能力...</NAlert>
              <NAlert v-if="managedFieldsModel.technicalKey?.fieldName" type="info" :show-icon="false">
                整库同步技术主键支持 UUID、雪花ID、源表主键，不支持指定字段拼接。
              </NAlert>
              <NAlert
                v-if="
                  managedFieldsModel.technicalKey?.fieldName &&
                  managedFieldsModel.technicalKey?.sourceMode === 'CUSTOM_FIELDS'
                "
                type="warning"
                :show-icon="false"
              >
                指定字段拼接会应用到整库中的每张表，请确保所有启用表都包含这些字段；否则生成配置时会报错。
              </NAlert>
              <NAlert
                v-else-if="
                  targetModel.datasourceId &&
                  !sinkCapabilities.supportsSchemaSaveMode &&
                  !sinkCapabilities.supportsDataSaveMode
                "
                type="warning"
              >
                当前目标端不支持自动建表或启动前数据处理策略，整库同步将按连接器默认行为执行。
              </NAlert>
            </div>
          </NForm>
        </NCard>

        <NCard title="整库同步配置" size="small" :bordered="false" class="overflow-hidden rounded-12px shadow-sm">
          <WholeDbConfigPanel
            v-if="sourceModel.datasourceId"
            v-model:include-pattern="includePattern"
            v-model:exclude-pattern="excludePattern"
            v-model="tableConfigs"
            :datasource-id="sourceModel.datasourceId"
            :database-name="sourceModel.databaseName"
            :schema-name="sourceModel.schemaName"
          />
          <div v-else class="py-20px text-center text-13px text-[#8a92b2]">请先完善源端数据源配置</div>
        </NCard>
      </div>

      <template #footer>
        <NSpace justify="end" class="w-full">
          <NButton @click="visible = false">取消</NButton>
          <NButton type="primary" :loading="saveLoading" @click="handleSubmit">确定保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
:deep(.n-card-header) {
  padding-bottom: 0px !important;
}
:deep(.n-card-header__main) {
  font-weight: bold;
  font-size: 15px;
}
</style>
