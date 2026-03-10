<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NPagination,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTimeline,
  NTimelineItem,
  useMessage
} from 'naive-ui';
import {
  fetchCreateOrUpdateSyncSchedule,
  fetchGetSyncRecordList,
  fetchGetSyncSchedule,
  fetchTriggerNewTablesSync,
  fetchTriggerSyncNow,
  fetchTriggerTableSync
} from '@/service/api/metadata/sync';

defineOptions({
  name: 'DatasourceSyncDrawer'
});

interface Props {
  /** 抽屉显隐 */
  visible: boolean;
  /** 当前操作的数据源 ID */
  datasourceId?: CommonType.IdType;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', visible: boolean): void;
}

const emit = defineEmits<Emits>();

const message = useMessage();

const drawerVisible = computed({
  get() {
    return props.visible;
  },
  set(visible: boolean) {
    emit('update:visible', visible);
  }
});

const activeTab = ref('schedule');

// ---- 调度配置 Tab ----
const scheduleForm = reactive<Api.Metadata.SyncTaskOperateParams>({
  datasourceId: undefined,
  cronExpression: '0 0 */1 * * ?',
  status: 1,
  remark: ''
});

const isScheduleLoading = ref(false);
const isSaving = ref(false);

const cronOptions = [
  { label: '每10分钟', value: '0 */10 * * * ?' },
  { label: '每小时', value: '0 0 */1 * * ?' },
  { label: '每天0点', value: '0 0 0 * * ?' },
  { label: '自定义 (Cron)', value: 'custom' }
];

const selectedCronPreset = ref('0 0 */1 * * ?');

function handleCronPresetChange(val: string) {
  if (val !== 'custom') {
    scheduleForm.cronExpression = val;
  }
}

watch(
  () => scheduleForm.cronExpression,
  newVal => {
    if (!newVal) return;
    const isPreset = cronOptions.some(opt => opt.value === newVal);
    if (isPreset) {
      selectedCronPreset.value = newVal;
    } else {
      selectedCronPreset.value = 'custom';
    }
  }
);

async function loadSchedule() {
  if (!props.datasourceId) return;
  isScheduleLoading.value = true;
  scheduleForm.datasourceId = props.datasourceId;
  const { data, error } = await fetchGetSyncSchedule(props.datasourceId);
  isScheduleLoading.value = false;

  if (!error && data) {
    scheduleForm.cronExpression = data.cronExpression || '0 0 */1 * * ?';
    scheduleForm.status = data.status ?? 1;
    scheduleForm.remark = data.remark || '';
  } else {
    scheduleForm.cronExpression = '0 0 */1 * * ?';
    scheduleForm.status = 1;
    scheduleForm.remark = '';
  }
}

async function handleSaveSchedule() {
  if (!scheduleForm.cronExpression) {
    message.error('请输入Cron表达式');
    return;
  }
  isSaving.value = true;
  const { error } = await fetchCreateOrUpdateSyncSchedule(scheduleForm);
  isSaving.value = false;
  if (!error) {
    message.success('保存调度配置成功');
    loadSchedule();
  }
}

const isTriggering = ref(false);
const isTriggeringNewTables = ref(false);
const isTriggeringTable = ref(false);
const tableSyncForm = reactive<Api.Metadata.TableSyncParams>({
  schemaName: '',
  tableName: ''
});

async function handleTriggerNow() {
  if (!props.datasourceId) return;
  isTriggering.value = true;
  const { error } = await fetchTriggerSyncNow(props.datasourceId);
  isTriggering.value = false;
  if (!error) {
    message.success('已提交全量同步任务');
    if (activeTab.value === 'record') {
      setTimeout(loadRecords, 1000);
    }
  }
}

async function handleTriggerNewTables() {
  if (!props.datasourceId) return;
  isTriggeringNewTables.value = true;
  const { error } = await fetchTriggerNewTablesSync(props.datasourceId);
  isTriggeringNewTables.value = false;
  if (!error) {
    message.success('已提交新增表同步任务');
    if (activeTab.value === 'record') {
      setTimeout(loadRecords, 1000);
    }
  }
}

async function handleTriggerTable() {
  if (!props.datasourceId) return;
  if (!tableSyncForm.schemaName.trim()) {
    message.error('请输入 Schema 名称');
    return;
  }
  if (!tableSyncForm.tableName.trim()) {
    message.error('请输入表名称');
    return;
  }
  isTriggeringTable.value = true;
  const { error } = await fetchTriggerTableSync(props.datasourceId, {
    schemaName: tableSyncForm.schemaName.trim(),
    tableName: tableSyncForm.tableName.trim()
  });
  isTriggeringTable.value = false;
  if (!error) {
    message.success(`已提交表 ${tableSyncForm.schemaName.trim()}.${tableSyncForm.tableName.trim()} 同步任务`);
    if (activeTab.value === 'record') {
      setTimeout(loadRecords, 1000);
    }
  }
}

// ---- 执行记录 Tab ----
const recordLoading = ref(false);
const recordData = ref<Api.Metadata.SyncRecord[]>([]);
const recordTotal = ref(0);
const recordSearchParams = ref<Api.Metadata.SyncRecordSearchParams>({
  pageNum: 1,
  pageSize: 10,
  datasourceId: undefined,
  status: undefined
});

async function loadRecords() {
  if (!props.datasourceId) return;
  recordSearchParams.value.datasourceId = props.datasourceId;
  recordLoading.value = true;
  const { data, error } = await fetchGetSyncRecordList(recordSearchParams.value);
  recordLoading.value = false;
  if (!error && data) {
    recordData.value = data.rows || [];
    recordTotal.value = data.total || 0;
  } else {
    recordData.value = [];
    recordTotal.value = 0;
  }
}

watch(
  () => props.visible,
  visible => {
    if (visible && props.datasourceId) {
      activeTab.value = 'schedule';
      loadSchedule();
    }
  }
);

watch(activeTab, val => {
  if (val === 'record' && props.datasourceId) {
    recordSearchParams.value.pageNum = 1;
    loadRecords();
  }
});

function getStatusTagType(status: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAIL') return 'error';
  if (status === 'SKIPPED') return 'warning';
  return 'info';
}

function getStatusText(status: string) {
  if (status === 'QUEUED') return '排队中';
  if (status === 'SUCCESS') return '成功';
  if (status === 'FAIL') return '失败';
  if (status === 'SKIPPED') return '已跳过';
  return '运行中';
}

function getSyncModeText(item: Api.Metadata.SyncRecord) {
  if (item.syncMode === 'NEW_TABLES_ONLY') return '新增表同步';
  if (item.syncMode === 'TABLE_SCOPED') {
    if (item.schemaName && item.tableName) {
      return `单表同步: ${item.schemaName}.${item.tableName}`;
    }
    return '单表同步';
  }
  return '全量同步';
}

function getTriggerSourceText(triggerSource?: string) {
  if (triggerSource === 'initial') return '新建触发';
  if (triggerSource === 'schedule') return '定时触发';
  if (triggerSource === 'manual') return '手动触发';
  return '未知来源';
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 0) return '-';
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes} 分 ${seconds} 秒`;
}

function parseSummary(summaryJson?: string) {
  if (!summaryJson) return null;
  try {
    return JSON.parse(summaryJson) as Record<string, number>;
  } catch {
    return null;
  }
}

function getSummaryText(item: Api.Metadata.SyncRecord) {
  const summary = parseSummary(item.summaryJson);
  if (!summary) return '';

  const segments: string[] = [];
  if (summary.schemaScanned) segments.push(`扫描 Schema ${summary.schemaScanned}`);
  if (summary.tableScanned) segments.push(`扫描表 ${summary.tableScanned}`);
  if (summary.tableFetched) segments.push(`抓取表 ${summary.tableFetched}`);
  if (summary.tableAdded) segments.push(`新增表 ${summary.tableAdded}`);
  if (summary.tableDeleted) segments.push(`删除表 ${summary.tableDeleted}`);
  if (summary.columnAdded) segments.push(`新增字段 ${summary.columnAdded}`);
  if (summary.columnDeleted) segments.push(`删除字段 ${summary.columnDeleted}`);
  if (summary.commentChanged) segments.push(`注释变更 ${summary.commentChanged}`);
  if (summary.propertyChanged) segments.push(`属性变更 ${summary.propertyChanged}`);
  if (summary.typeChanged) segments.push(`类型变更 ${summary.typeChanged}`);
  if (summary.skippedTables) segments.push(`跳过表 ${summary.skippedTables}`);
  return segments.join('，');
}

function getFailedStageText(stage?: string) {
  if (!stage) return '-';
  if (stage === 'FETCH_TABLES') return '抓取表清单';
  if (stage === 'FETCH_COLUMNS') return '抓取字段';
  if (stage === 'PERSIST_DATABASE') return '写入数据库层级';
  if (stage === 'PERSIST_SCHEMA') return '写入 Schema';
  if (stage === 'PERSIST_METADATA') return '写入元数据';
  return stage;
}

function getFailedTargetText(item: Api.Metadata.SyncRecord) {
  if (item.failedSchemaName && item.failedTableName) {
    return `${item.failedSchemaName}.${item.failedTableName}`;
  }
  if (item.failedSchemaName) {
    return item.failedSchemaName;
  }
  return '-';
}

function handlePageChange(page: number) {
  recordSearchParams.value.pageNum = page;
  loadRecords();
}

function handlePageSizeChange(pageSize: number) {
  recordSearchParams.value.pageSize = pageSize;
  recordSearchParams.value.pageNum = 1;
  loadRecords();
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" display-directive="show" :width="560">
    <NDrawerContent title="数据源同步" :native-scrollbar="false" closable>
      <div class="h-full flex-col">
        <NTabs v-model:value="activeTab" type="line" animated>
          <NTabPane name="schedule" tab="定时调度">
            <NSpin :show="isScheduleLoading">
              <NForm
                :model="scheduleForm"
                label-placement="left"
                label-width="120"
                require-mark-placement="right-hanging"
                class="mt-4"
              >
                <NFormItem label="启停状态" path="status">
                  <NSwitch
                    :value="scheduleForm.status ?? 0"
                    :checked-value="1"
                    :unchecked-value="0"
                    @update:value="(val: number) => (scheduleForm.status = val)"
                  >
                    <template #checked>启用</template>
                    <template #unchecked>停用</template>
                  </NSwitch>
                </NFormItem>

                <NFormItem label="调度周期" path="cronExpression">
                  <div class="w-full flex-col gap-4">
                    <NRadioGroup
                      v-model:value="selectedCronPreset"
                      name="cronPreset"
                      @update:value="handleCronPresetChange"
                    >
                      <NSpace>
                        <NRadio v-for="opt in cronOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </NRadio>
                      </NSpace>
                    </NRadioGroup>

                    <NInput
                      v-if="selectedCronPreset === 'custom'"
                      v-model:value="scheduleForm.cronExpression"
                      placeholder="请输入 CRON 表达式 (例: 0 0 12 * * ?)"
                      class="mt-4 w-full"
                    />
                  </div>
                </NFormItem>

                <NFormItem label="备注" path="remark">
                  <NInput v-model:value="scheduleForm.remark" type="textarea" placeholder="请输入备注" />
                </NFormItem>

                <NFormItem label="立即同步">
                  <div class="w-full flex-col gap-12px">
                    <NSpace>
                      <NButton type="info" ghost :loading="isTriggering" @click="handleTriggerNow">全量同步</NButton>
                      <NButton ghost :loading="isTriggeringNewTables" @click="handleTriggerNewTables">
                        同步新增表
                      </NButton>
                    </NSpace>
                    <div class="rounded-8px bg-gray-50 p-12px dark:bg-[#22252b]">
                      <div class="mb-8px text-13px text-gray-700 font-medium dark:text-gray-200">同步指定表</div>
                      <div class="flex flex-col gap-8px">
                        <NInput v-model:value="tableSyncForm.schemaName" placeholder="请输入 Schema 名称，如 public" />
                        <NInput v-model:value="tableSyncForm.tableName" placeholder="请输入表名称，如 user_info" />
                        <div class="flex justify-end">
                          <NButton type="primary" secondary :loading="isTriggeringTable" @click="handleTriggerTable">
                            同步指定表
                          </NButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </NFormItem>
              </NForm>

              <div class="mt-8 flex justify-end gap-4">
                <NButton @click="drawerVisible = false">取消</NButton>
                <NButton type="primary" :loading="isSaving" @click="handleSaveSchedule">保存配置</NButton>
              </div>
            </NSpin>
          </NTabPane>

          <NTabPane name="record" tab="执行记录">
            <div class="mt-2 h-full flex-col">
              <div class="mb-4 flex items-center justify-between">
                <NSelect
                  v-model:value="recordSearchParams.status"
                  :options="[
                    { label: '全部状态', value: '' },
                    { label: '排队中', value: 'QUEUED' },
                    { label: '成功', value: 'SUCCESS' },
                    { label: '失败', value: 'FAIL' },
                    { label: '运行中', value: 'RUNNING' },
                    { label: '已跳过', value: 'SKIPPED' }
                  ]"
                  placeholder="状态筛选"
                  class="w-160px"
                  clearable
                  @update:value="loadRecords"
                />
                <NButton size="small" :loading="recordLoading" @click="loadRecords">刷新</NButton>
              </div>

              <NSpin :show="recordLoading">
                <NTimeline v-if="recordData && recordData.length" class="mt-4 px-2">
                  <NTimelineItem
                    v-for="item in recordData"
                    :key="item.recordId"
                    :type="getStatusTagType(item.status)"
                    :title="getStatusText(item.status)"
                  >
                    <div class="mt-1 text-12px text-gray-500">开始时间: {{ item.startTime || '-' }}</div>
                    <div class="mt-1 text-12px text-gray-500">结束时间: {{ item.endTime || '-' }}</div>
                    <div class="mt-1 text-12px text-gray-500">
                      触发来源: {{ getTriggerSourceText(item.triggerSource) }}
                    </div>
                    <div class="mt-1 text-12px text-gray-500">同步范围: {{ getSyncModeText(item) }}</div>
                    <div class="mt-1 text-12px text-gray-500">执行耗时: {{ formatDuration(item.durationMs) }}</div>
                    <div v-if="getSummaryText(item)" class="mt-1 text-12px text-gray-500">
                      执行摘要: {{ getSummaryText(item) }}
                    </div>
                    <div v-if="item.failedStage" class="mt-1 text-12px text-amber-600">
                      失败定位: {{ getFailedStageText(item.failedStage) }} / {{ getFailedTargetText(item) }}
                    </div>
                    <div
                      v-if="item.errorMsg"
                      class="mt-2 max-h-100px w-full overflow-y-auto rounded bg-red-50 p-2 text-12px text-red-500"
                    >
                      {{ item.errorMsg }}
                    </div>
                  </NTimelineItem>
                </NTimeline>
                <NEmpty v-else description="暂无历史执行记录" class="mt-10" />

                <div v-if="recordTotal > 0" class="mt-6 flex justify-end">
                  <NPagination
                    :page="recordSearchParams.pageNum || 1"
                    :page-size="recordSearchParams.pageSize || 10"
                    :item-count="recordTotal"
                    show-size-picker
                    :page-sizes="[10, 20, 50]"
                    size="small"
                    @update:page="handlePageChange"
                    @update:page-size="handlePageSizeChange"
                  />
                </div>
              </NSpin>
            </div>
          </NTabPane>
        </NTabs>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
