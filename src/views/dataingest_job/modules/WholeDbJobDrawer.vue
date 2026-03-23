<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NDrawer, NDrawerContent, NForm, NSpace } from 'naive-ui';
import { jsonClone } from '@sa/utils';
import {
  fetchCreateIngestJob,
  fetchGetIngestJob,
  fetchGetIngestJobTableConfigs,
  fetchGetIngestJobTasks,
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

const tableConfigs = ref<Api.Dataingest.IngestJobTableConfig[]>([]);
const includePattern = ref('');
const excludePattern = ref('');

async function loadDatasources() {
  const { data } = await fetchGetDatasourceSelect();
  if (data) {
    datasourceOptions.value = data.map(item => ({ label: item.datasourceName, value: item.datasourceId }));
  }
}

async function loadEditDetail() {
  if (!(props.operateType === 'edit' && props.rowData?.jobId)) return;

  const jobId = props.rowData.jobId;
  const [{ data: jobData }, { data: tasks }, { data: tblConfigs }] = await Promise.all([
    fetchGetIngestJob(jobId),
    fetchGetIngestJobTasks(jobId),
    fetchGetIngestJobTableConfigs(jobId)
  ]);

  if (jobData) {
    Object.assign(jobModel.value, jsonClone(jobData));
    jobModel.value.syncMode = 'WHOLE_DATABASE';
  }

  if (tasks && tasks.length >= 2) {
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
      targetModel.value = {
        datasourceId: sinkTask.datasourceId ?? null,
        databaseName: sinkTask.databaseName ?? '',
        schemaName: sinkTask.schemaName ?? ''
      };
    }
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
  tableConfigs.value = [];
  includePattern.value = '';
  excludePattern.value = '';
}

watch(visible, async value => {
  if (!value) return;
  resetState();
  await loadDatasources();
  await loadEditDetail();
});

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

  // Generate required tasks and lines explicitly for backend compatibility
  const tasks: Api.Dataingest.IngestJobTask[] = [
    {
      nodeCode: 'source_1',
      nodeName: '源数据库',
      taskType: 'SOURCE',
      pluginType: 'JDBC',
      datasourceId: sourceModel.value.datasourceId,
      databaseName: sourceModel.value.databaseName,
      schemaName: sourceModel.value.schemaName,
      posX: 100,
      posY: 100
    },
    {
      nodeCode: 'sink_1',
      nodeName: '目标数据库',
      taskType: 'SINK',
      pluginType: 'JDBC',
      datasourceId: targetModel.value.datasourceId,
      databaseName: targetModel.value.databaseName,
      schemaName: targetModel.value.schemaName,
      posX: 400,
      posY: 100
    }
  ];

  const lines = [
    {
      sourceNodeCode: 'source_1',
      targetNodeCode: 'sink_1'
    }
  ];

  const payload: Api.Dataingest.IngestJobWithTasksParams = {
    job: { ...jobModel.value },
    tasks,
    lines,
    tableConfigs: tableConfigs.value
  };

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
