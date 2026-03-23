<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { NButton, NModal } from 'naive-ui';
import { jsonClone } from '@sa/utils';
import {
  fetchCreateIngestJob,
  fetchGetIngestJob,
  fetchGetIngestJobLines,
  fetchGetIngestJobTableConfigs,
  fetchGetIngestJobTasks,
  fetchUpdateIngestJob
} from '@/service/api/dataingest';
import { fetchGetDatasourceSelect } from '@/service/api/metadata/datasource';
import BasicInfoStep from './BasicInfoStep.vue';
import WholeDbConfigPanel from './WholeDbConfigPanel.vue';

defineOptions({ name: 'JobOperateDrawer' });

const DagEditor = defineAsyncComponent(() => import('./dag/DagEditor.vue'));

interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData?: Api.Dataingest.IngestJob | null;
  initialSyncMode?: 'SINGLE' | 'WHOLE_DATABASE';
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = defineModel<boolean>('visible', { default: false });

const SYNC_MODE_MAP: Record<string, string> = {
  SINGLE: '单表同步',
  WHOLE_DATABASE: '整库同步'
};

const dagSaveLoading = ref(false);
const saveModalVisible = ref(false);

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

const datasourceOptions = ref<{ label: string; value: CommonType.IdType }[]>([]);

const jobModel = ref<Api.Dataingest.IngestJobOperateParams>({
  jobName: '',
  jobType: 'BATCH',
  syncMode: 'SINGLE',
  scheduleType: 'MANUAL',
  scheduleExpression: '',
  status: '0',
  remark: '',
  editorMode: 'DAG'
});

const title = computed(() => {
  const modeName = jobModel.value.syncMode ? SYNC_MODE_MAP[jobModel.value.syncMode] || '' : '';
  return props.operateType === 'add' ? `新增作业 (${modeName})` : `编辑作业 (${modeName})`;
});

const tableConfigs = ref<Api.Dataingest.IngestJobTableConfig[]>([]);
const includePattern = ref('');
const excludePattern = ref('');

const dagTasksToSave = ref<any[]>([]);
const dagLinesToSave = ref<any[]>([]);

const loadedDagTasks = ref<any[]>([]);
const loadedDagLines = ref<any[]>([]);

async function loadDatasources() {
  const { data } = await fetchGetDatasourceSelect();
  if (data) {
    datasourceOptions.value = data.map(item => ({ label: item.datasourceName, value: item.datasourceId }));
  }
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
    jobModel.value.editorMode = 'DAG';
  }

  if (tasks) loadedDagTasks.value = tasks;
  if (lines) loadedDagLines.value = lines;
  if (tblConfigs) tableConfigs.value = tblConfigs;
}

function resetState() {
  jobModel.value = {
    jobId: props.rowData?.jobId,
    jobName: '',
    jobType: 'BATCH',
    syncMode: props.initialSyncMode || 'SINGLE',
    scheduleType: 'MANUAL',
    scheduleExpression: '',
    status: '0',
    remark: '',
    editorMode: 'DAG'
  };
  dagTasksToSave.value = [];
  dagLinesToSave.value = [];
  loadedDagTasks.value = [];
  loadedDagLines.value = [];
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

function handleDagSave(tasks: any[], lines: any[]) {
  dagTasksToSave.value = tasks;
  dagLinesToSave.value = lines;
  saveModalVisible.value = true;
}

async function confirmSaveDag() {
  if (!jobModel.value.jobName?.trim()) {
    window.$message?.warning('请输入作业名称');
    return;
  }

  dagSaveLoading.value = true;
  const payload: Api.Dataingest.IngestJobWithTasksParams = {
    job: {
      ...jobModel.value,
      editorMode: 'DAG'
    },
    tasks: dagTasksToSave.value,
    lines: dagLinesToSave.value,
    tableConfigs: jobModel.value.syncMode !== 'SINGLE' ? tableConfigs.value : undefined
  };

  const request = props.operateType === 'add' ? fetchCreateIngestJob(payload) : fetchUpdateIngestJob(payload);
  const { error } = await request;
  dagSaveLoading.value = false;

  if (error) return;

  window.$message?.success('保存成功');
  saveModalVisible.value = false;
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <div v-show="visible" class="absolute inset-0 z-[100] flex flex-col overflow-hidden">
    <div class="relative flex-1 overflow-hidden">
      <DagEditor
        v-if="visible"
        :job-title="title"
        :tasks="loadedDagTasks"
        :lines="loadedDagLines"
        :job-id="props.operateType === 'edit' ? (props.rowData?.jobId ?? null) : null"
        :datasource-options="datasourceOptions"
        :saving="dagSaveLoading"
        @save="handleDagSave"
      >
        <template #header-extra>
          <NButton round secondary size="small" class="px-16px" @click="visible = false">关闭</NButton>
        </template>
      </DagEditor>
    </div>

    <NModal
      v-model:show="saveModalVisible"
      preset="card"
      title="保存作业"
      :class="jobModel.syncMode === 'SINGLE' ? 'w-600px' : 'w-900px'"
      :segmented="{ content: true, footer: true }"
    >
      <BasicInfoStep
        :model="jobModel"
        :job-type-options="jobTypeOptions"
        :schedule-type-options="scheduleTypeOptions"
        :status-options="statusOptions"
      />
      <WholeDbConfigPanel
        v-if="jobModel.syncMode === 'WHOLE_DATABASE'"
        v-model:include-pattern="includePattern"
        v-model:exclude-pattern="excludePattern"
        v-model="tableConfigs"
        :datasource-id="dagTasksToSave.find(t => t.taskType === 'SOURCE')?.datasourceId"
        :database-name="dagTasksToSave.find(t => t.taskType === 'SOURCE')?.databaseName"
        :schema-name="dagTasksToSave.find(t => t.taskType === 'SOURCE')?.schemaName"
      />
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="saveModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="dagSaveLoading" @click="confirmSaveDag">确认保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
