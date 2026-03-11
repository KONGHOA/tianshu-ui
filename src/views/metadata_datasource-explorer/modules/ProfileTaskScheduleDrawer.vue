<script setup lang="tsx">
import { computed, reactive, watch } from 'vue';
import {
  NAlert,
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NTag
} from 'naive-ui';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateDatabaseProfileTask,
  fetchCreateTableProfileTask,
  fetchDisableProfileTask,
  fetchEnableProfileTask,
  fetchUpdateProfileTask
} from '@/service/api/metadata/profile-task';

interface Props {
  show: boolean;
  scopeType: 'database' | 'table';
  entityUuid: string;
  entityName?: string;
  task?: Api.Metadata.ProfileTask | null;
}

const props = withDefaults(defineProps<Props>(), {
  entityName: '',
  task: null
});

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'saved'): void;
}>();

const { loading, startLoading, endLoading } = useLoading();

const visible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const formModel = reactive({
  taskName: '',
  cronExpression: '',
  enabled: true,
  selectAllColumns: 1
});

const isEdit = computed(() => Boolean(props.task?.taskId));
const cronValidation = computed(() => validateCronExpression(formModel.cronExpression));
const cronTemplates = [
  { label: '每天 2 点', value: '0 0 2 * * ?' },
  { label: '每小时', value: '0 0 * * * ?' },
  { label: '每天 30 分', value: '0 30 0 * * ?' },
  { label: '每周一 1 点', value: '0 0 1 ? * MON' }
];

watch(
  () => [props.show, props.task, props.entityUuid, props.entityName],
  () => {
    formModel.taskName =
      props.task?.taskName ||
      `${props.scopeType === 'table' ? '表数据概览' : '整库数据量概览'}(${props.entityName || props.entityUuid})`;
    formModel.cronExpression = props.task?.cronExpression || '';
    formModel.enabled = props.task?.enabled !== 0;
    formModel.selectAllColumns = props.task?.selectAllColumns ?? 1;
  },
  { immediate: true }
);

async function handleSave() {
  if (!props.entityUuid) return;
  if (!cronValidation.value.valid) {
    window.$message?.error(cronValidation.value.message || 'Cron 表达式格式不正确');
    return;
  }
  startLoading();

  const basePayload = {
    taskName: formModel.taskName.trim(),
    scopeType: props.scopeType,
    entityUuid: props.entityUuid,
    selectAllColumns: formModel.selectAllColumns,
    enabled: formModel.enabled ? 1 : 0,
    cronExpression: formModel.cronExpression.trim() || undefined
  };

  const res = isEdit.value
    ? await fetchUpdateProfileTask({
        taskId: props.task!.taskId,
        ...basePayload
      })
    : await (props.scopeType === 'table'
        ? fetchCreateTableProfileTask(basePayload)
        : fetchCreateDatabaseProfileTask(basePayload));

  endLoading();

  if (!res.error) {
    window.$message?.success('调度配置已保存');
    visible.value = false;
    emit('saved');
  }
}

function applyTemplate(value: string) {
  formModel.cronExpression = value;
}

async function handleToggleEnabled() {
  if (!props.task?.taskId) return;
  startLoading();
  const res = formModel.enabled
    ? await fetchEnableProfileTask(props.task.taskId)
    : await fetchDisableProfileTask(props.task.taskId);
  endLoading();
  if (!res.error) {
    window.$message?.success(formModel.enabled ? '任务已启用' : '任务已停用');
    emit('saved');
  }
}

function validateCronExpression(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: true, message: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 6 && parts.length !== 7) {
    return { valid: false, message: 'Cron 表达式应为 6 或 7 段' };
  }
  return { valid: true, message: '' };
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="520" display-directive="show" class="max-w-95%">
    <NDrawerContent title="调度设置" :native-scrollbar="false" closable>
      <NAlert type="info" class="mb-16px">
        为空表示仅支持手动执行；填写 Cron 表达式后会自动注册 SnailJob 定时任务。
      </NAlert>
      <NAlert v-if="scopeType === 'database'" type="warning" class="mb-16px">
        整库任务仅统计各表行数和整库总量，不采集字段画像。
      </NAlert>

      <NForm label-placement="top" :model="formModel">
        <NFormItem label="任务名称">
          <NInput v-model:value="formModel.taskName" maxlength="128" placeholder="请输入任务名称" />
        </NFormItem>
        <NFormItem label="Cron 表达式">
          <NInput v-model:value="formModel.cronExpression" placeholder="例如 0 0 2 * * ?" clearable />
          <div class="mt-8px flex flex-wrap gap-8px">
            <NTag
              v-for="item in cronTemplates"
              :key="item.value"
              size="small"
              :bordered="false"
              class="cursor-pointer"
              @click="applyTemplate(item.value)"
            >
              {{ item.label }}
            </NTag>
          </div>
          <div class="mt-8px text-12px" :class="cronValidation.valid ? 'text-gray-500' : 'text-rose-500'">
            {{
              formModel.cronExpression.trim()
                ? cronValidation.valid
                  ? 'Cron 格式已通过基础校验'
                  : cronValidation.message
                : '留空表示仅手动执行，不注册定时任务'
            }}
          </div>
        </NFormItem>
        <NFormItem v-if="scopeType === 'table'" label="字段范围">
          <NInputNumber v-model:value="formModel.selectAllColumns" :min="1" :max="1" class="w-full" disabled />
        </NFormItem>
        <NFormItem label="任务启用">
          <div class="flex items-center gap-12px">
            <NSwitch v-model:value="formModel.enabled" @update:value="isEdit && handleToggleEnabled()" />
            <span class="text-12px text-gray-500">
              {{ formModel.enabled ? '启用后允许手动/定时执行' : '停用后不会接受手动和定时触发' }}
            </span>
          </div>
        </NFormItem>
        <NFormItem v-if="task?.jobId" label="SnailJob">
          <div class="rounded-8px bg-gray-50 px-12px py-10px text-12px dark:bg-gray-900/40">
            jobId:
            <span class="font-mono">{{ task.jobId }}</span>
          </div>
        </NFormItem>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-10px">
          <NButton @click="visible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleSave">保存</NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
