<script setup lang="tsx">
import { computed, reactive, watch } from 'vue';
import { NButton, NCheckbox, NCheckboxGroup, NForm, NFormItem, NInput, NModal, NRadio, NRadioGroup } from 'naive-ui';
import { useLoading } from '@sa/hooks';
import {
  fetchCreateTableProfileTask,
  fetchExecuteProfileTask,
  fetchUpdateProfileTask
} from '@/service/api/metadata/profile-task';

interface Props {
  show: boolean;
  tableUuid: string;
  tableName?: string;
  columns: Api.Metadata.EntityInstance[];
  task?: Api.Metadata.ProfileTask | null;
}

const props = withDefaults(defineProps<Props>(), {
  tableName: '',
  task: null
});

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'executed'): void;
}>();

const { loading, startLoading, endLoading } = useLoading();

const visible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const formModel = reactive({
  executeMode: 'all' as 'all' | 'partial',
  selectedColumns: [] as string[],
  rowFilterSql: ''
});

const columnOptions = computed(() =>
  props.columns.map(col => ({
    label: col.displayName,
    value: col.displayName
  }))
);

watch(
  () => [props.show, props.task, props.columns],
  () => {
    const selectedColumns = parseSelectedColumns(props.task?.selectedColumnsJson);
    formModel.executeMode = props.task?.selectAllColumns === 0 ? 'partial' : 'all';
    formModel.selectedColumns = selectedColumns.filter(item =>
      columnOptions.value.some(option => option.value === item)
    );
    formModel.rowFilterSql = props.task?.rowFilterSql || '';
  },
  { immediate: true }
);

function buildPayload() {
  return {
    taskName: props.task?.taskName || `表数据概览(${props.tableName || props.tableUuid})`,
    scopeType: 'table' as const,
    entityUuid: props.tableUuid,
    selectAllColumns: formModel.executeMode === 'all' ? 1 : 0,
    selectedColumns: formModel.executeMode === 'all' ? undefined : formModel.selectedColumns,
    rowFilterSql: formModel.rowFilterSql.trim() || undefined,
    enabled: props.task?.enabled ?? 1,
    cronExpression: props.task?.cronExpression || undefined
  };
}

async function saveTask() {
  const payload = buildPayload();
  if (props.task?.taskId) {
    const res = await fetchUpdateProfileTask({
      taskId: props.task.taskId,
      ...payload
    });
    return { ...res, data: props.task.taskId };
  }
  return fetchCreateTableProfileTask(payload);
}

async function handleConfirm() {
  if (!props.tableUuid) return;
  if (formModel.executeMode === 'partial' && formModel.selectedColumns.length === 0) {
    window.$message?.error('请选择至少一个字段');
    return;
  }

  startLoading();
  try {
    const taskRes = await saveTask();
    if (taskRes.error || !taskRes.data) return;
    const executeRes = await fetchExecuteProfileTask(taskRes.data);
    if (executeRes.error) return;
    window.$message?.success('数据概览任务已提交，后台执行中，稍后点“刷新结果”查看');
    visible.value = false;
    emit('executed');
  } finally {
    endLoading();
  }
}

function parseSelectedColumns(raw?: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return [];
  }
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="执行数据概览" class="max-w-95% w-640px">
    <NForm label-placement="top" :model="formModel">
      <NFormItem label="执行范围">
        <NRadioGroup v-model:value="formModel.executeMode">
          <div class="flex gap-16px">
            <NRadio value="all">全字段</NRadio>
            <NRadio value="partial">指定字段</NRadio>
          </div>
        </NRadioGroup>
      </NFormItem>

      <NFormItem v-if="formModel.executeMode === 'partial'" label="选择字段">
        <div
          class="max-h-240px w-full overflow-auto border border-gray-200 rounded-8px px-12px py-10px dark:border-gray-700"
        >
          <NCheckboxGroup v-model:value="formModel.selectedColumns">
            <div class="grid gap-8px md:grid-cols-2">
              <NCheckbox v-for="item in columnOptions" :key="item.value" :value="item.value" :label="item.label" />
            </div>
          </NCheckboxGroup>
        </div>
      </NFormItem>

      <NFormItem label="过滤条件">
        <NInput
          v-model:value="formModel.rowFilterSql"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          placeholder="可选，例如 dt = '2026-03-11' and status = '1'"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="flex justify-end gap-10px">
        <NButton @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleConfirm">确认执行</NButton>
      </div>
    </template>
  </NModal>
</template>
