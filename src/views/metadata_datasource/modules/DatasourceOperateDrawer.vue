<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { jsonClone } from '@sa/utils';
import { fetchCreateDatasource, fetchTestConnection, fetchUpdateDatasource } from '@/service/api/metadata/datasource';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';
import DictRadio from '@/components/custom/dict-radio.vue';

defineOptions({
  name: 'DatasourceOperateDrawer'
});

interface Props {
  categoryTree?: any[];
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Metadata.Datasource | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: '新增数据源',
    edit: '编辑数据源'
  };
  return titles[props.operateType];
});

type Model = Api.Metadata.DatasourceOperateParams;

const model = ref<Model>(createDefaultModel());

const connModel = ref({
  host: '',
  port: 3306,
  database: '',
  username: '',
  password: ''
});

function createDefaultModel(): Model {
  return {
    datasourceId: null,
    datasourceName: '',
    datasourceType: 'mysql',
    connParams: '{}',
    status: '0',
    remark: ''
  };
}

const datasourceTypeOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' }
];

const rules = {
  datasourceName: createRequiredRule('数据源名称不能为空'),
  datasourceType: createRequiredRule('数据源类型不能为空')
};

const connRules = {
  host: createRequiredRule('主机地址不能为空'),
  port: createRequiredRule('端口不能为空'),
  username: createRequiredRule('用户名不能为空'),
  password: createRequiredRule('密码不能为空')
};

function handleUpdateModelWhenEdit() {
  model.value = createDefaultModel();
  connModel.value = {
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: ''
  };

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, jsonClone(props.rowData));
    if (model.value.connParams) {
      try {
        const parsed = JSON.parse(model.value.connParams);
        Object.assign(connModel.value, parsed);
      } catch {
        // ignore JSON parse error
      }
    }
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleTestConnection() {
  await validate();
  const testModel = jsonClone(model.value);
  testModel.connParams = JSON.stringify(connModel.value);
  const { error } = await fetchTestConnection(testModel);
  if (!error) {
    window.$message?.success('连接成功');
  }
}

async function handleSubmit() {
  await validate();

  model.value.connParams = JSON.stringify(connModel.value);

  // request
  if (props.operateType === 'add') {
    const { error } = await fetchCreateDatasource(model.value);
    if (error) return;
  }

  if (props.operateType === 'edit') {
    const { error } = await fetchUpdateDatasource(model.value);
    if (error) return;
  }

  window.$message?.success($t('common.updateSuccess'));
  closeDrawer();
  emit('submitted');
}

watch(visible, () => {
  if (visible.value) {
    handleUpdateModelWhenEdit();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="800" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm
        ref="formRef"
        :model="{ ...model, ...connModel }"
        :rules="{ ...rules, ...connRules }"
        label-placement="left"
        :label-width="100"
      >
        <NFormItem label="数据源名称" path="datasourceName">
          <NInput v-model:value="model.datasourceName" placeholder="请输入数据源名称" />
        </NFormItem>
        <NFormItem label="所属分类" path="categoryId">
          <NTreeSelect
            v-model:value="model.categoryId"
            :options="categoryTree"
            key-field="id"
            label-field="name"
            children-field="children"
            :default-value="0"
            placeholder="请选择所属分类"
          />
        </NFormItem>
        <NFormItem label="数据源类型" path="datasourceType">
          <NSelect
            v-model:value="model.datasourceType"
            :options="datasourceTypeOptions"
            placeholder="请选择数据源类型"
          />
        </NFormItem>
        <NFormItem label="主机地址" path="host">
          <NInput v-model:value="connModel.host" placeholder="请输入主机地址" />
        </NFormItem>
        <NFormItem label="端口" path="port">
          <NInputNumber v-model:value="connModel.port" placeholder="请输入端口" class="w-full" />
        </NFormItem>
        <NFormItem label="数据库名称" path="database">
          <NInput v-model:value="connModel.database" placeholder="请输入数据库名称" />
        </NFormItem>
        <NFormItem label="用户名" path="username">
          <NInput v-model:value="connModel.username" placeholder="请输入用户名" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput
            v-model:value="connModel.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
          />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <DictRadio v-model:value="model.status" dict-code="sys_normal_disable" />
        </NFormItem>
        <NFormItem label="备注" path="remark">
          <NInput v-model:value="model.remark" :rows="3" type="textarea" placeholder="请输入备注" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace :size="16" justify="space-between" class="w-full">
          <div></div>
          <NSpace :size="16">
            <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
            <NButton @click="handleTestConnection">测试连接</NButton>
            <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
