<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NDivider,
  NDrawer,
  NDrawerContent,
  NDynamicTags,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NStep,
  NSteps
} from 'naive-ui';
import { jsonClone } from '@sa/utils';
import { fetchCreateIngestJob, fetchGetIngestJobTasks, fetchUpdateIngestJob } from '@/service/api/dataingest';
import { fetchGetDatasourceSelect } from '@/service/api/metadata/datasource';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';

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

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const currentStep = ref(1);
const TOTAL_STEPS = 3;

const title = computed(() => {
  return props.operateType === 'add' ? '新增接入作业' : '编辑接入作业';
});

// ---- 作业基本信息 ----
type JobModel = Api.Dataingest.IngestJobOperateParams;

const jobModel = ref<JobModel>(createDefaultJobModel());

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

// ---- 来源任务 ----
type TaskModel = Api.Dataingest.IngestJobTask;

const sourceTask = ref<TaskModel>(createDefaultSourceTask());
const sinkTask = ref<TaskModel>(createDefaultSinkTask());

function createDefaultSourceTask(): TaskModel {
  return {
    taskType: 'SOURCE',
    pluginType: 'JDBC',
    datasourceId: undefined,
    databaseName: '',
    tableName: '',
    whereCondition: '',
    incrementalColumn: '',
    fieldList: [],
    extraConfig: '',
    sortNum: 1
  };
}

function createDefaultSinkTask(): TaskModel {
  return {
    taskType: 'SINK',
    pluginType: 'JDBC',
    datasourceId: undefined,
    databaseName: '',
    tableName: '',
    writeMode: 'APPEND',
    primaryKeys: [],
    extraConfig: '',
    sortNum: 2
  };
}

// ---- 数据源下拉选项 ----
const datasourceOptions = ref<{ label: string; value: number }[]>([]);

async function loadDatasources() {
  const { data, error } = await fetchGetDatasourceSelect();
  if (!error && data) {
    datasourceOptions.value = data.map(d => ({ label: d.datasourceName, value: Number(d.datasourceId) }));
  }
}

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

const pluginTypeOptions = [
  { label: 'JDBC (关系型数据库)', value: 'JDBC' },
  { label: 'Kafka', value: 'KAFKA' },
  { label: 'Elasticsearch', value: 'ES' },
  { label: 'Hive', value: 'HIVE' },
  { label: 'S3 / MinIO', value: 'S3' }
];

const statusOptions = [
  { label: '启用', value: '0' },
  { label: '停用', value: '1' }
];

// ---- 表单校验规则 ----
const jobRules = {
  jobName: createRequiredRule('作业名称不能为空'),
  jobType: createRequiredRule('作业类型不能为空')
};

const sourceRules = {
  pluginType: createRequiredRule('连接器类型不能为空')
};

const sinkRules = {
  pluginType: createRequiredRule('连接器类型不能为空'),
  writeMode: createRequiredRule('写入模式不能为空')
};

// ---- 步骤控制 ----
async function handleNext() {
  await validate();
  if (currentStep.value < TOTAL_STEPS) {
    currentStep.value += 1;
  }
}

function handlePrev() {
  if (currentStep.value > 1) {
    currentStep.value -= 1;
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();

  const params: Api.Dataingest.IngestJobWithTasksParams = {
    job: jobModel.value,
    tasks: [jsonClone(sourceTask.value), jsonClone(sinkTask.value)]
  };

  if (props.operateType === 'add') {
    const { error } = await fetchCreateIngestJob(params);
    if (error) return;
  } else {
    const { error } = await fetchUpdateIngestJob(params);
    if (error) return;
  }

  window.$message?.success('保存成功');
  closeDrawer();
  emit('submitted');
}

async function handleUpdateModelWhenEdit() {
  jobModel.value = createDefaultJobModel();
  sourceTask.value = createDefaultSourceTask();
  sinkTask.value = createDefaultSinkTask();

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(jobModel.value, jsonClone(props.rowData));

    const { data: tasks, error } = await fetchGetIngestJobTasks(props.rowData.jobId!);
    if (!error && tasks) {
      const src = tasks.find(t => t.taskType === 'SOURCE');
      const sink = tasks.find(t => t.taskType === 'SINK');
      if (src) Object.assign(sourceTask.value, src);
      if (sink) Object.assign(sinkTask.value, sink);
    }
  }
}

watch(visible, async () => {
  if (visible.value) {
    currentStep.value = 1;
    restoreValidation();
    loadDatasources();
    await handleUpdateModelWhenEdit();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="680">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSteps :current="currentStep" size="small" class="mb-24px">
        <NStep title="基本信息" />
        <NStep title="来源配置" />
        <NStep title="目标配置" />
      </NSteps>

      <!-- Step 1: 基本信息 -->
      <NForm
        v-if="currentStep === 1"
        ref="formRef"
        :model="jobModel"
        :rules="jobRules"
        label-placement="left"
        :label-width="110"
      >
        <NFormItem label="作业名称" path="jobName">
          <NInput v-model:value="jobModel.jobName" placeholder="请输入作业名称" />
        </NFormItem>
        <NFormItem label="作业类型" path="jobType">
          <NSelect v-model:value="jobModel.jobType" :options="jobTypeOptions" placeholder="请选择作业类型" />
        </NFormItem>
        <NFormItem label="调度方式" path="scheduleType">
          <NSelect v-model:value="jobModel.scheduleType" :options="scheduleTypeOptions" placeholder="请选择调度方式" />
        </NFormItem>
        <NFormItem v-if="jobModel.scheduleType === 'CRON'" label="Cron 表达式" path="scheduleExpression">
          <NInput v-model:value="jobModel.scheduleExpression" placeholder="例：0 0 2 * * ?" />
        </NFormItem>
        <NFormItem label="并行度" path="parallelism">
          <NInputNumber v-model:value="jobModel.parallelism" :min="1" :max="64" placeholder="并行度" />
        </NFormItem>
        <NFormItem label="Checkpoint 间隔" path="checkpointInterval">
          <NInputNumber
            v-model:value="jobModel.checkpointInterval"
            :min="1000"
            placeholder="单位：毫秒（仅流式有效）"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="最大重试次数" path="maxRetryTimes">
          <NInputNumber v-model:value="jobModel.maxRetryTimes" :min="0" :max="10" />
        </NFormItem>
        <NFormItem label="告警邮箱" path="alertEmail">
          <NInput v-model:value="jobModel.alertEmail" placeholder="失败时发送告警邮件" />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NSelect v-model:value="jobModel.status" :options="statusOptions" />
        </NFormItem>
        <NFormItem label="备注" path="remark">
          <NInput v-model:value="jobModel.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </NFormItem>
      </NForm>

      <!-- Step 2: 来源配置 -->
      <NForm
        v-if="currentStep === 2"
        ref="formRef"
        :model="sourceTask"
        :rules="sourceRules"
        label-placement="left"
        :label-width="110"
      >
        <NDivider>来源节点 (SOURCE)</NDivider>
        <NFormItem label="连接器类型" path="pluginType">
          <NSelect v-model:value="sourceTask.pluginType" :options="pluginTypeOptions" placeholder="请选择连接器" />
        </NFormItem>
        <NFormItem label="数据源" path="datasourceId">
          <NSelect
            v-model:value="sourceTask.datasourceId"
            :options="datasourceOptions"
            placeholder="请选择数据源"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem label="数据库" path="databaseName">
          <NInput v-model:value="sourceTask.databaseName" placeholder="数据库名" />
        </NFormItem>
        <NFormItem label="表名" path="tableName">
          <NInput v-model:value="sourceTask.tableName" placeholder="单表名，与表名模式二选一" />
        </NFormItem>
        <NFormItem label="表名模式" path="tablePattern">
          <NInput v-model:value="sourceTask.tablePattern" placeholder="正则，如 order_.* （CDC多表同步）" />
        </NFormItem>
        <NFormItem label="WHERE 条件" path="whereCondition">
          <NInput v-model:value="sourceTask.whereCondition" placeholder="如 status = 1（不含 WHERE）" />
        </NFormItem>
        <NFormItem label="增量字段" path="incrementalColumn">
          <NInput v-model:value="sourceTask.incrementalColumn" placeholder="用于增量同步的时间/ID字段" />
        </NFormItem>
        <NFormItem label="增量起始值" path="incrementalLastValue">
          <NInput v-model:value="sourceTask.incrementalLastValue" placeholder="上次同步的最大值（首次留空全量）" />
        </NFormItem>
        <NFormItem label="同步字段" path="fieldList">
          <NDynamicTags v-model:value="sourceTask.fieldList" />
        </NFormItem>
        <NFormItem label="扩展配置" path="extraConfig">
          <NInput v-model:value="sourceTask.extraConfig" type="textarea" :rows="3" placeholder="JSON 格式覆盖配置" />
        </NFormItem>
      </NForm>

      <!-- Step 3: 目标配置 -->
      <NForm
        v-if="currentStep === 3"
        ref="formRef"
        :model="sinkTask"
        :rules="sinkRules"
        label-placement="left"
        :label-width="110"
      >
        <NDivider>目标节点 (SINK)</NDivider>
        <NFormItem label="连接器类型" path="pluginType">
          <NSelect v-model:value="sinkTask.pluginType" :options="pluginTypeOptions" placeholder="请选择连接器" />
        </NFormItem>
        <NFormItem label="数据源" path="datasourceId">
          <NSelect
            v-model:value="sinkTask.datasourceId"
            :options="datasourceOptions"
            placeholder="请选择数据源"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem label="数据库" path="databaseName">
          <NInput v-model:value="sinkTask.databaseName" placeholder="目标数据库名" />
        </NFormItem>
        <NFormItem label="目标表名" path="tableName">
          <NInput v-model:value="sinkTask.tableName" placeholder="目标表名" />
        </NFormItem>
        <NFormItem label="写入模式" path="writeMode">
          <NSelect v-model:value="sinkTask.writeMode" :options="writeModeOptions" placeholder="请选择写入模式" />
        </NFormItem>
        <NFormItem v-if="sinkTask.writeMode === 'UPSERT'" label="主键字段" path="primaryKeys">
          <NDynamicTags v-model:value="sinkTask.primaryKeys" />
        </NFormItem>
        <NFormItem label="扩展配置" path="extraConfig">
          <NInput v-model:value="sinkTask.extraConfig" type="textarea" :rows="3" placeholder="JSON 格式覆盖配置" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace :size="16">
          <NButton v-if="currentStep > 1" @click="handlePrev">上一步</NButton>
          <NButton @click="closeDrawer">取消</NButton>
          <NButton v-if="currentStep < TOTAL_STEPS" type="primary" @click="handleNext">下一步</NButton>
          <NButton v-if="currentStep === TOTAL_STEPS" type="primary" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
