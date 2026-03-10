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
  fetchTriggerSyncNow
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

async function handleTriggerNow() {
  if (!props.datasourceId) return;
  isTriggering.value = true;
  const { error } = await fetchTriggerSyncNow(props.datasourceId);
  isTriggering.value = false;
  if (!error) {
    message.success('已触发同步');
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
              </NForm>

              <div class="mt-8 flex justify-end gap-4">
                <NButton @click="drawerVisible = false">取消</NButton>
                <NButton type="info" ghost :loading="isTriggering" @click="handleTriggerNow">立即运行</NButton>
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
                    :time="item.startTime"
                  >
                    <div class="mt-1 text-12px text-gray-500">结束时间: {{ item.endTime || '-' }}</div>
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
