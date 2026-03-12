<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWindowSize } from '@vueuse/core';
import {
  NButton,
  NDivider,
  NDynamicTags,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  NTreeSelect
} from 'naive-ui';
import { jsonClone } from '@sa/utils';
import { fetchCreateDatasource, fetchTestConnection, fetchUpdateDatasource } from '@/service/api/metadata/datasource';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { useDict } from '@/hooks/business/dict';
import { getDatasourceIcon } from '@/utils/datasourceIcon';
import { $t } from '@/locales';
import DictSelect from '@/components/custom/dict-select.vue';

defineOptions({ name: 'DatasourceOperateDrawer' });

interface Props {
  categoryTree?: any[];
  operateType: NaiveUI.TableOperateType;
  rowData?: Api.Metadata.Datasource | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'submitted'): void }>();
const visible = defineModel<boolean>('visible', { default: false });

// ────────────── 步骤管理 ──────────────
const STEPS = ['选择类型', '基本信息', '连接配置', '过滤器'];
const currentStep = ref(1);

// ────────────── 数据源类型定义 ──────────────
const SERVICE_TYPES = [
  { key: 'mysql', label: 'MySQL', port: 3306, desc: '开源关系型数据库' },
  { key: 'postgresql', label: 'PostgreSQL', port: 5432, desc: '对象关系型数据库' },
  { key: 'oracle', label: 'Oracle', port: 1521, desc: '企业级关系型数据库' },
  { key: 'clickhouse', label: 'ClickHouse', port: 8123, desc: '列式 OLAP 分析数据库' },
  { key: 'hive', label: 'Hive', port: 10000, desc: 'Apache Hive 大数据仓库' },
  { key: 'doris', label: 'Doris', port: 9030, desc: '实时分析型 MPP 数据库' },
  { key: 'greenplum', label: 'Greenplum', port: 5432, desc: '大规模并行处理数据库' },
  { key: 'mariadb', label: 'MariaDB', port: 3306, desc: 'MySQL 分支关系型数据库' },
  { key: 'sqlite', label: 'SQLite', port: 0, desc: '轻量级嵌入式数据库' },
  { key: 'starrocks', label: 'StarRocks', port: 9030, desc: '高性能实时分析数据库' },
  { key: 'vertica', label: 'Vertica', port: 5433, desc: '列式分析型数据库' }
] as const;

type ServiceKey = (typeof SERVICE_TYPES)[number]['key'];
type FilterModel = {
  schemaFilterPattern: Api.Metadata.FilterPattern;
  tableFilterPattern: Api.Metadata.FilterPattern;
};

// ────────────── 数据模型 ──────────────
type Model = Api.Metadata.DatasourceOperateParams;

const model = ref<Model>(createDefaultModel());
const filterModel = ref<FilterModel>(createDefaultFilterModel());
const connModel = ref<{
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  kerberosPrincipal: string;
  hiveServerPrincipal: string;
  kerberosKeytab: string;
  kerberosKrb5conf: string;
  properties: Record<string, string>;
}>({
  host: '',
  port: 3306,
  database: '',
  username: '',
  password: '',
  kerberosPrincipal: '',
  hiveServerPrincipal: '',
  kerberosKeytab: '',
  kerberosKrb5conf: '',
  properties: {}
});
const testStatus = ref<'idle' | 'testing' | 'success' | 'fail'>('idle');
const testLoading = ref(false);

function createDefaultModel(): Model {
  return {
    datasourceId: null,
    datasourceName: '',
    datasourceType: 'mysql',
    connParams: '{}',
    status: null,
    sourceOrgCode: null,
    sourceOrgName: null,
    sourceDept: null,
    sourceType: null,
    sourceSystem: null,
    contactPerson: null,
    contactPhone: null,
    remark: '',
    categoryId: null
  };
}

function createDefaultFilterModel(): FilterModel {
  return {
    schemaFilterPattern: { includes: [], excludes: [] },
    tableFilterPattern: { includes: [], excludes: [] }
  };
}

function normalizeParsedFilterModel(value: unknown): FilterModel {
  const defaultModel = createDefaultFilterModel();
  if (!value || typeof value !== 'object') {
    return defaultModel;
  }

  const parsed = value as Api.Metadata.DatasourceFilterConfig;
  return {
    schemaFilterPattern: {
      includes: parsed.schemaFilterPattern?.includes ?? [],
      excludes: parsed.schemaFilterPattern?.excludes ?? []
    },
    tableFilterPattern: {
      includes: parsed.tableFilterPattern?.includes ?? [],
      excludes: parsed.tableFilterPattern?.excludes ?? []
    }
  };
}

// ────────────── 级联字典 ──────────────
const { data: orgData } = useDict('meta_source_org');
const { data: deptData } = useDict('meta_source_dept');
const { data: systemData } = useDict('meta_source_system');
const { data: sourceTypeL2Data } = useDict('meta_source_type_l2');

// 来源类型一级/二级中间态（不持久化）
const sourceTypeL1 = ref<string | null>(null);
const sourceTypeL2 = ref<string | null>(null);

// 来源部门：按来源单位代码过滤
const filteredDeptOptions = computed(() => {
  if (!model.value.sourceOrgCode) return [];
  return deptData.value
    .filter(d => d.remark === model.value.sourceOrgCode)
    .map(d => ({ label: d.dictLabel, value: d.dictValue }));
});

// 来源系统：按来源单位代码过滤
const filteredSystemOptions = computed(() => {
  if (!model.value.sourceOrgCode) return [];
  return systemData.value
    .filter(d => d.remark === model.value.sourceOrgCode)
    .map(d => ({ label: d.dictLabel, value: d.dictValue }));
});

// 来源类型二级：按一级代码过滤
const sourceTypeL2Options = computed(() => {
  if (!sourceTypeL1.value) return [];
  return sourceTypeL2Data.value
    .filter(d => d.remark === sourceTypeL1.value)
    .map(d => ({ label: d.dictLabel, value: d.dictValue }));
});

// 选择来源单位 → 自动填充名称 + 清空下级
watch(
  () => model.value.sourceOrgCode,
  code => {
    const org = orgData.value.find(d => d.dictValue === code);
    model.value.sourceOrgName = org?.dictLabel ?? null;
    model.value.sourceDept = null;
    model.value.sourceSystem = null;
  }
);

// 选择来源类型一级 → 清空二级
watch(sourceTypeL1, () => {
  sourceTypeL2.value = null;
  model.value.sourceType = null;
});

// 选择来源类型二级 → 拼合5位代码
watch(sourceTypeL2, l2 => {
  if (sourceTypeL1.value && l2) {
    model.value.sourceType = sourceTypeL1.value + l2;
  } else {
    model.value.sourceType = null;
  }
});

// 编辑回填：从已有 sourceType 拆解回一级/二级
function initSourceType(code: string | null | undefined) {
  if (!code || code.length < 3) {
    sourceTypeL1.value = null;
    sourceTypeL2.value = null;
    return;
  }
  sourceTypeL1.value = code.substring(0, 2);
  sourceTypeL2.value = code.substring(2);
}

// Kerberos 开关（双向绑定到 connModel.properties）
const kerberosEnabled = computed({
  get: () => connModel.value.properties?.['kerberos.enable'] === 'true',
  set: (val: boolean) => {
    if (!connModel.value.properties) connModel.value.properties = {};
    connModel.value.properties['kerberos.enable'] = val ? 'true' : 'false';
    testStatus.value = 'idle';
  }
});

// ────────────── 计算属性 ──────────────
const selectedTypeInfo = computed(
  () => SERVICE_TYPES.find(t => t.key === model.value.datasourceType) ?? SERVICE_TYPES[0]
);
const { width: windowWidth } = useWindowSize();
const isCompactDrawer = computed(() => windowWidth.value < 1024);
const drawerWidth = computed(() => {
  if (windowWidth.value < 640) return '100%';
  if (windowWidth.value < 1280) return 760;
  return 900;
});

const isEdit = computed(() => props.operateType === 'edit');

const drawerTitle = computed(() => (isEdit.value ? '编辑数据源' : '新建数据源'));

// ────────────── 连接帮助信息 ──────────────
const connectionHelp: Record<ServiceKey, { title: string; items: { icon: string; label: string; text: string }[] }> = {
  mysql: {
    title: 'MySQL 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'MySQL 服务器的 IP 地址或域名，例如 192.168.1.100' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 3306，请确保防火墙已放行对应端口' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，填写后仅同步该数据库；不填则同步全部可见库' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要 SELECT 权限；推荐使用只读账号' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储，不会明文保存' }
    ]
  },
  postgresql: {
    title: 'PostgreSQL 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'PostgreSQL 服务器的 IP 地址或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 5432' },
      { icon: 'i-mdi-database', label: '数据库', text: '需要指定具体的 database 名称，如 postgres' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要 CONNECT 权限和对应 schema 的 USAGE 权限' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  oracle: {
    title: 'Oracle 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'Oracle 数据库服务器地址' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 1521，对应 Oracle Listener 端口' },
      { icon: 'i-mdi-database', label: '服务名/SID', text: '填写 Oracle 的 Service Name 或 SID，如 ORCL' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要 SELECT ANY DICTIONARY 或相应权限' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  clickhouse: {
    title: 'ClickHouse 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'ClickHouse 服务器地址' },
      { icon: 'i-mdi-numeric', label: '端口', text: 'HTTP 端口默认 8123；原生 TCP 端口 9000' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，填写后仅同步该数据库' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '默认用户名为 default' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '默认无密码；密码将加密存储' }
    ]
  },
  hive: {
    title: 'Hive 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'HiveServer2 所在节点的 IP 或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: 'HiveServer2 默认 Thrift 端口为 10000' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，不填默认连接 default 库' },
      { icon: 'i-mdi-account-key', label: '用户名/密码', text: '非 Kerberos 模式下填写；Kerberos 模式可留空' },
      {
        icon: 'i-mdi-shield-key-outline',
        label: 'Kerberos',
        text: '启用后需提供 principal、keytab 路径；服务端 principal 写入 JDBC URL'
      }
    ]
  },
  doris: {
    title: 'Doris 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'Doris FE 节点的 IP 地址或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: 'MySQL 协议端口默认 9030' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，填写后仅同步该数据库' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '默认用户名为 root' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  greenplum: {
    title: 'Greenplum 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'Greenplum Master 节点的 IP 或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 5432，与 PostgreSQL 兼容' },
      { icon: 'i-mdi-database', label: '数据库', text: '需指定具体数据库名称' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要对应 schema 的访问权限' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  mariadb: {
    title: 'MariaDB 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'MariaDB 服务器的 IP 地址或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 3306，与 MySQL 相同' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，填写后仅同步该数据库' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要 SELECT 权限；推荐使用只读账号' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  sqlite: {
    title: 'SQLite 连接说明',
    items: [
      { icon: 'i-mdi-file-outline', label: '文件路径', text: 'SQLite 数据库文件的绝对路径，如 /data/app.db' },
      { icon: 'i-mdi-information-outline', label: '说明', text: 'SQLite 为嵌入式数据库，无需主机、端口和认证信息' }
    ]
  },
  starrocks: {
    title: 'StarRocks 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'StarRocks FE 节点的 IP 地址或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: 'MySQL 协议端口默认 9030' },
      { icon: 'i-mdi-database', label: '数据库', text: '可选，填写后仅同步该数据库' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '默认用户名为 root' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  },
  vertica: {
    title: 'Vertica 连接说明',
    items: [
      { icon: 'i-mdi-server-network', label: '主机地址', text: 'Vertica 服务器的 IP 地址或域名' },
      { icon: 'i-mdi-numeric', label: '端口', text: '默认 5433' },
      { icon: 'i-mdi-database', label: '数据库', text: '需指定具体数据库名称' },
      { icon: 'i-mdi-account-key', label: '用户名', text: '需要对应 schema 的查询权限' },
      { icon: 'i-mdi-lock-outline', label: '密码', text: '密码将加密存储' }
    ]
  }
};

const currentHelp = computed(() => connectionHelp[model.value.datasourceType as ServiceKey] ?? connectionHelp.mysql);

// ────────────── 表单 ──────────────
const { formRef: step2FormRef, validate: validateStep2, restoreValidation: restoreStep2 } = useNaiveForm();
const { formRef: step3FormRef, validate: validateStep3, restoreValidation: restoreStep3 } = useNaiveForm();
const { createRequiredRule } = useFormRules();

const basicRules = {
  datasourceName: createRequiredRule('数据源名称不能为空')
};

const connRules = computed(() => ({
  host: createRequiredRule('主机地址不能为空'),
  port: createRequiredRule('端口不能为空'),
  username: kerberosEnabled.value ? [] : createRequiredRule('用户名不能为空'),
  password: kerberosEnabled.value ? [] : createRequiredRule('密码不能为空'),
  kerberosPrincipal: kerberosEnabled.value ? createRequiredRule('客户端 Principal 不能为空') : [],
  hiveServerPrincipal: kerberosEnabled.value ? createRequiredRule('服务端 Principal 不能为空') : [],
  kerberosKeytab: kerberosEnabled.value ? createRequiredRule('Keytab 文件路径不能为空') : []
}));

// ────────────── 初始化 ──────────────
function handleUpdateModelWhenEdit() {
  model.value = createDefaultModel();
  filterModel.value = createDefaultFilterModel();
  connModel.value = {
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    kerberosPrincipal: '',
    hiveServerPrincipal: '',
    kerberosKeytab: '',
    kerberosKrb5conf: '',
    properties: {}
  };
  testStatus.value = 'idle';
  currentStep.value = isEdit.value ? 2 : 1;

  sourceTypeL1.value = null;
  sourceTypeL2.value = null;

  if (isEdit.value && props.rowData) {
    Object.assign(model.value, jsonClone(props.rowData));
    if (model.value.connParams) {
      try {
        const parsedConnParams = JSON.parse(model.value.connParams as string);
        Object.assign(connModel.value, parsedConnParams);
        connModel.value.kerberosPrincipal = parsedConnParams.properties?.['kerberos.principal'] ?? '';
        connModel.value.hiveServerPrincipal = parsedConnParams.properties?.['hive.server.principal'] ?? '';
        connModel.value.kerberosKeytab = parsedConnParams.properties?.['kerberos.keytab'] ?? '';
        connModel.value.kerberosKrb5conf = parsedConnParams.properties?.['kerberos.krb5conf'] ?? '';
      } catch {
        /* ignore */
      }
    }
    if (model.value.filterConfig) {
      try {
        const parsed =
          typeof model.value.filterConfig === 'string'
            ? JSON.parse(model.value.filterConfig)
            : model.value.filterConfig;
        filterModel.value = normalizeParsedFilterModel(parsed);
      } catch {
        filterModel.value = createDefaultFilterModel();
      }
    }
    initSourceType(model.value.sourceType);
  }
}

function selectType(key: string) {
  model.value.datasourceType = key;
  const found = SERVICE_TYPES.find(t => t.key === key);
  if (found) connModel.value.port = found.port;
  testStatus.value = 'idle';
}

// ────────────── 步骤导航 ──────────────
function closeDrawer() {
  visible.value = false;
}

async function goNext() {
  if (currentStep.value === 1) {
    currentStep.value = 2;
  } else if (currentStep.value === 2) {
    try {
      await validateStep2();
      currentStep.value = 3;
    } catch {
      /* validation failed, stay on step 2 */
    }
  } else if (currentStep.value === 3) {
    try {
      await validateStep3();
      currentStep.value = 4;
    } catch {
      /* validation failed, stay on step 3 */
    }
  }
}

function goBack() {
  if (currentStep.value === 3) {
    restoreStep3();
    testStatus.value = 'idle';
  }
  if (currentStep.value > 1) currentStep.value -= 1;
}

// ────────────── 测试连接 ──────────────
async function handleTestConnection() {
  try {
    await validateStep3();
  } catch {
    return;
  }
  testLoading.value = true;
  testStatus.value = 'testing';
  const testModel = jsonClone(model.value);
  syncConnectionProperties();
  testModel.connParams = JSON.stringify(buildConnParamsPayload());
  const { error, data } = await fetchTestConnection(testModel);
  const success = !error && data === true;
  testStatus.value = success ? 'success' : 'fail';
  testLoading.value = false;
  if (success) window.$message?.success('连接测试通过');
  else window.$message?.error('连接失败，请检查配置');
}

// ────────────── 提交 ──────────────
async function handleSubmit() {
  syncConnectionProperties();
  model.value.connParams = JSON.stringify(buildConnParamsPayload());
  const normalizedFilterConfig = normalizeFilterConfig(filterModel.value);
  model.value.filterConfig = normalizedFilterConfig ? JSON.stringify(normalizedFilterConfig) : null;

  const fn = isEdit.value ? fetchUpdateDatasource : fetchCreateDatasource;
  const { error } = await fn(model.value);
  if (error) return;

  window.$message?.success($t('common.updateSuccess'));
  closeDrawer();
  emit('submitted');
}

function normalizeFilterConfig(config: FilterModel) {
  const normalizePattern = (pattern?: Api.Metadata.FilterPattern) => {
    if (!pattern) return null;
    const includes = [...new Set((pattern.includes ?? []).map(v => v.trim()).filter(Boolean))];
    const excludes = [...new Set((pattern.excludes ?? []).map(v => v.trim()).filter(Boolean))];
    if (!includes.length && !excludes.length) return null;
    return { includes, excludes };
  };

  const schemaFilterPattern = normalizePattern(config.schemaFilterPattern);
  const tableFilterPattern = normalizePattern(config.tableFilterPattern);

  if (!schemaFilterPattern && !tableFilterPattern) {
    return null;
  }

  return { schemaFilterPattern, tableFilterPattern };
}

function syncConnectionProperties() {
  if (!connModel.value.properties) connModel.value.properties = {};

  if (!kerberosEnabled.value) {
    delete connModel.value.properties['kerberos.principal'];
    delete connModel.value.properties['hive.server.principal'];
    delete connModel.value.properties['kerberos.keytab'];
    delete connModel.value.properties['kerberos.krb5conf'];
    return;
  }

  connModel.value.properties['kerberos.principal'] = connModel.value.kerberosPrincipal.trim();
  connModel.value.properties['hive.server.principal'] = connModel.value.hiveServerPrincipal.trim();
  connModel.value.properties['kerberos.keytab'] = connModel.value.kerberosKeytab.trim();

  const krb5conf = connModel.value.kerberosKrb5conf.trim();
  if (krb5conf) {
    connModel.value.properties['kerberos.krb5conf'] = krb5conf;
  } else {
    delete connModel.value.properties['kerberos.krb5conf'];
  }
}

function buildConnParamsPayload() {
  const {
    kerberosPrincipal: _kerberosPrincipal,
    hiveServerPrincipal: _hiveServerPrincipal,
    kerberosKeytab: _kerberosKeytab,
    kerberosKrb5conf: _kerberosKrb5conf,
    ...payload
  } = jsonClone(connModel.value);
  return payload;
}

watch(visible, v => {
  if (v) {
    handleUpdateModelWhenEdit();
    restoreStep2();
    restoreStep3();
  }
});

watch(
  () => [visible.value, props.operateType, props.rowData] as const,
  ([isVisible]) => {
    if (!isVisible) return;
    handleUpdateModelWhenEdit();
    restoreStep2();
    restoreStep3();
  }
);
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="drawerWidth" class="max-w-100vw">
    <NDrawerContent :native-scrollbar="false" class="flex flex-col">
      <!-- ═══ HEADER ═══ -->
      <template #header>
        <div class="w-full flex flex-col">
          <!-- 标题行 -->
          <div class="flex items-center gap-10px">
            <div class="h-30px w-30px flex-center flex-shrink-0 rounded-8px bg-gray-50 dark:bg-gray-800">
              <img
                :src="getDatasourceIcon(model.datasourceType)"
                :alt="selectedTypeInfo.label"
                class="h-20px w-20px object-contain"
              />
            </div>
            <span class="text-15px text-gray-900 font-semibold dark:text-gray-100">
              {{ drawerTitle }}
            </span>
            <NTag size="small" :bordered="false" class="ml-4px">
              {{ selectedTypeInfo.label }}
            </NTag>
          </div>

          <!-- 步骤条 -->
          <div
            class="mt-16px flex items-center justify-center"
            role="group"
            :aria-label="`数据源配置步骤，当前第 ${currentStep} 步，共 ${STEPS.length} 步`"
          >
            <template v-for="(step, i) in STEPS" :key="i">
              <!-- 步骤圆 -->
              <div class="flex flex-col items-center gap-6px">
                <div
                  class="h-28px w-28px flex-center rounded-full text-12px font-bold transition-all duration-200"
                  :class="{
                    'bg-primary text-white shadow-sm shadow-primary/40': i + 1 === currentStep,
                    'bg-primary/10 text-primary': i + 1 < currentStep,
                    'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500': i + 1 > currentStep
                  }"
                >
                  <span v-if="i + 1 < currentStep" class="i-mdi-check text-14px" />
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span
                  class="text-11px transition-colors"
                  :class="{
                    'text-primary font-semibold': i + 1 === currentStep,
                    'text-gray-500 dark:text-gray-400': i + 1 !== currentStep
                  }"
                >
                  {{ step }}
                </span>
              </div>

              <!-- 连接线 -->
              <div
                v-if="i < STEPS.length - 1"
                class="mb-18px h-0.5 w-80px flex-shrink-0 transition-colors duration-300"
                :class="i + 1 < currentStep ? 'bg-primary/40' : 'bg-gray-200 dark:bg-gray-700'"
              />
            </template>
          </div>
        </div>
      </template>

      <!-- ═══ BODY ═══ -->
      <div class="h-full flex flex-col overflow-hidden">
        <!-- ── Step 1: 选择类型 ── -->
        <div v-if="currentStep === 1" class="flex flex-col flex-1 overflow-y-auto px-8px py-4px">
          <div class="mb-20px text-center">
            <p class="text-13px text-gray-500 dark:text-gray-400">
              选择您要接入的数据库类型，我们将自动配置对应的连接参数
            </p>
          </div>

          <div
            class="grid grid-cols-1 mx-auto max-w-720px w-full gap-14px sm:grid-cols-2 xl:grid-cols-4"
            role="radiogroup"
            aria-label="选择数据源类型"
          >
            <button
              v-for="type in SERVICE_TYPES"
              :key="type.key"
              type="button"
              role="radio"
              class="relative flex flex-col select-none items-center border-2 rounded-12px px-12px py-20px text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary dark:focus-visible:ring-offset-[#18181c]"
              :aria-checked="model.datasourceType === type.key"
              :aria-label="`${type.label}，${type.desc}`"
              :class="
                model.datasourceType === type.key
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#18181c] hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5'
              "
              @click="selectType(type.key)"
            >
              <!-- 选中徽章 -->
              <div
                v-if="model.datasourceType === type.key"
                class="absolute right-8px top-8px h-18px w-18px flex-center rounded-full bg-primary"
              >
                <span class="i-mdi-check text-10px text-white" />
              </div>

              <!-- 图标 -->
              <div class="mb-12px h-52px w-52px flex-center rounded-12px bg-gray-50 dark:bg-gray-800">
                <img :src="getDatasourceIcon(type.key)" :alt="type.label" class="h-36px w-36px object-contain" />
              </div>

              <!-- 名称 -->
              <span
                class="text-13px font-semibold"
                :class="model.datasourceType === type.key ? 'text-primary' : 'text-gray-700 dark:text-gray-300'"
              >
                {{ type.label }}
              </span>

              <!-- 描述 -->
              <span class="mt-4px text-center text-11px text-gray-400 leading-tight">
                {{ type.desc }}
              </span>
            </button>
          </div>
        </div>

        <!-- ── Step 2: 基本信息 ── -->
        <div v-else-if="currentStep === 2" class="flex-1 overflow-y-auto px-8px py-4px">
          <div class="mx-auto max-w-480px">
            <p class="mb-20px text-13px text-gray-500 dark:text-gray-400">
              配置数据源的基本信息，名称用于在平台中标识该数据源
            </p>

            <NForm
              ref="step2FormRef"
              :model="model"
              :rules="basicRules"
              label-placement="top"
              require-mark-placement="right-hanging"
            >
              <NFormItem label="数据源名称" path="datasourceName" required>
                <NInput
                  v-model:value="model.datasourceName"
                  placeholder="例如：生产-MySQL-用户库"
                  :maxlength="128"
                  show-count
                />
              </NFormItem>

              <NFormItem label="所属分类" path="categoryId">
                <NTreeSelect
                  v-model:value="model.categoryId"
                  :options="categoryTree"
                  key-field="id"
                  label-field="name"
                  children-field="children"
                  placeholder="选择数据源分类（可选）"
                  clearable
                />
              </NFormItem>

              <NFormItem label="备注" path="remark">
                <NInput
                  v-model:value="model.remark"
                  :rows="3"
                  type="textarea"
                  placeholder="描述该数据源的用途或其他说明（可选）"
                  :maxlength="500"
                  show-count
                />
              </NFormItem>

              <!-- 数据来源信息 -->
              <NDivider class="my-16px!">
                <span class="text-12px text-gray-400">数据来源信息</span>
              </NDivider>

              <NFormItem label="来源单位" path="sourceOrgCode">
                <DictSelect
                  v-model:value="model.sourceOrgCode"
                  dict-code="meta_source_org"
                  placeholder="选择来源单位（可选）"
                  clearable
                  filterable
                  immediate
                />
              </NFormItem>

              <div class="grid grid-cols-1 gap-x-16px sm:grid-cols-2">
                <NFormItem label="来源部门" path="sourceDept">
                  <NSelect
                    v-model:value="model.sourceDept"
                    :options="filteredDeptOptions"
                    :disabled="!model.sourceOrgCode"
                    placeholder="请先选择来源单位"
                    clearable
                    filterable
                  />
                </NFormItem>
                <NFormItem label="来源应用系统" path="sourceSystem">
                  <NSelect
                    v-model:value="model.sourceSystem"
                    :options="filteredSystemOptions"
                    :disabled="!model.sourceOrgCode"
                    placeholder="请先选择来源单位"
                    clearable
                    filterable
                  />
                </NFormItem>
              </div>

              <div class="grid grid-cols-1 gap-x-16px sm:grid-cols-2">
                <NFormItem label="来源类型（一级）" path="sourceType">
                  <DictSelect
                    v-model:value="sourceTypeL1"
                    dict-code="meta_source_type_l1"
                    placeholder="选择一级分类"
                    clearable
                    immediate
                  />
                </NFormItem>
                <NFormItem label="来源类型（二级）">
                  <NSelect
                    v-model:value="sourceTypeL2"
                    :options="sourceTypeL2Options"
                    :disabled="!sourceTypeL1"
                    placeholder="选择二级分类"
                    clearable
                    filterable
                  />
                </NFormItem>
              </div>

              <div class="grid grid-cols-1 gap-x-16px sm:grid-cols-2">
                <NFormItem label="数据联系人" path="contactPerson">
                  <NInput v-model:value="model.contactPerson" placeholder="联系人姓名" :maxlength="64" />
                </NFormItem>
                <NFormItem label="联系电话" path="contactPhone">
                  <NInput v-model:value="model.contactPhone" placeholder="手机号码" :maxlength="20" />
                </NFormItem>
              </div>
            </NForm>
          </div>
        </div>

        <!-- ── Step 3: 连接配置 ── -->
        <div v-else-if="currentStep === 3" class="flex flex-col flex-1 gap-0 overflow-hidden lg:flex-row">
          <!-- 左侧：表单 -->
          <div class="flex-1 overflow-y-auto px-20px py-4px lg:border-r lg:border-gray-100 dark:lg:border-gray-800">
            <!-- 测试状态 Banner -->
            <div
              v-if="testStatus !== 'idle'"
              class="mb-16px flex items-center gap-10px rounded-8px px-14px py-10px text-13px font-medium transition-all"
              :class="{
                'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400': testStatus === 'success',
                'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400': testStatus === 'fail',
                'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400': testStatus === 'testing'
              }"
            >
              <NIcon :size="16">
                <div
                  :class="{
                    'i-mdi-check-circle-outline': testStatus === 'success',
                    'i-mdi-alert-circle-outline': testStatus === 'fail',
                    'i-mdi-loading animate-spin': testStatus === 'testing'
                  }"
                />
              </NIcon>
              <span v-if="testStatus === 'success'">连接测试通过，数据源可用</span>
              <span v-else-if="testStatus === 'fail'">连接失败，请检查配置后重试</span>
              <span v-else>正在测试连接...</span>
            </div>

            <NForm
              ref="step3FormRef"
              :model="connModel"
              :rules="connRules"
              label-placement="top"
              require-mark-placement="right-hanging"
              @update:model="testStatus = 'idle'"
            >
              <div class="grid grid-cols-1 gap-x-16px sm:grid-cols-3">
                <NFormItem class="col-span-2" label="主机地址" path="host" required>
                  <NInput
                    v-model:value="connModel.host"
                    placeholder="例如：192.168.1.100"
                    @update:value="testStatus = 'idle'"
                  />
                </NFormItem>
                <NFormItem label="端口" path="port" required>
                  <NInputNumber
                    v-model:value="connModel.port"
                    class="w-full"
                    :min="1"
                    :max="65535"
                    @update:value="testStatus = 'idle'"
                  />
                </NFormItem>
              </div>

              <NFormItem label="数据库名称" path="database">
                <NInput
                  v-model:value="connModel.database"
                  :placeholder="
                    model.datasourceType === 'oracle'
                      ? '填写 Service Name 或 SID，如 ORCL'
                      : '可选，不填则同步全部数据库'
                  "
                  @update:value="testStatus = 'idle'"
                />
              </NFormItem>

              <div class="grid grid-cols-1 gap-x-16px sm:grid-cols-2">
                <NFormItem label="用户名" path="username" required>
                  <NInput
                    v-model:value="connModel.username"
                    placeholder="数据库用户名"
                    autocomplete="new-username"
                    @update:value="testStatus = 'idle'"
                  />
                </NFormItem>
                <NFormItem label="密码" path="password" required>
                  <NInput
                    v-model:value="connModel.password"
                    type="password"
                    show-password-on="click"
                    placeholder="数据库密码"
                    autocomplete="new-password"
                    @update:value="testStatus = 'idle'"
                  />
                </NFormItem>
              </div>
            </NForm>

            <!-- Kerberos 认证配置（仅 Hive） -->
            <template v-if="model.datasourceType === 'hive'">
              <div
                class="mb-16px mt-4px border border-amber-200 rounded-10px bg-amber-50/60 px-16px py-12px dark:border-amber-800/40 dark:bg-amber-900/10"
              >
                <!-- 开关标题行 -->
                <div class="mb-2px flex items-center justify-between">
                  <div class="flex items-center gap-8px">
                    <NIcon :size="15" class="text-amber-600 dark:text-amber-400">
                      <div class="i-mdi-shield-key-outline" />
                    </NIcon>
                    <span class="text-13px text-amber-800 font-semibold dark:text-amber-300">Kerberos 认证</span>
                  </div>
                  <NSwitch v-model:value="kerberosEnabled" size="small" />
                </div>
                <p class="mb-12px text-11px text-amber-600/80 leading-relaxed dark:text-amber-400/70">
                  启用后将通过 keytab 文件获取 TGT，连接 Kerberos 保护的 HiveServer2
                </p>

                <template v-if="kerberosEnabled">
                  <div class="grid grid-cols-1 gap-x-12px gap-y-0 sm:grid-cols-2">
                    <NFormItem label="客户端 Principal" path="kerberosPrincipal" required>
                      <NInput
                        v-model:value="connModel.kerberosPrincipal"
                        placeholder="hive/host@REALM"
                        size="small"
                        @update:value="testStatus = 'idle'"
                      />
                    </NFormItem>
                    <NFormItem label="服务端 Principal" path="hiveServerPrincipal" required>
                      <NInput
                        v-model:value="connModel.hiveServerPrincipal"
                        placeholder="hive/_HOST@REALM"
                        size="small"
                        @update:value="testStatus = 'idle'"
                      />
                    </NFormItem>
                  </div>
                  <NFormItem class="mt-8px" label="Keytab 文件路径" path="kerberosKeytab" required>
                    <NInput
                      v-model:value="connModel.kerberosKeytab"
                      placeholder="/etc/security/keytabs/hive.service.keytab"
                      size="small"
                      @update:value="testStatus = 'idle'"
                    />
                  </NFormItem>
                  <NFormItem class="mt-8px" label="krb5.conf 路径（可选）" path="kerberosKrb5conf">
                    <NInput
                      v-model:value="connModel.kerberosKrb5conf"
                      placeholder="/etc/krb5.conf（留空使用系统默认）"
                      size="small"
                      @update:value="testStatus = 'idle'"
                    />
                  </NFormItem>
                </template>
              </div>
            </template>

            <!-- 测试连接按钮 -->
            <div class="mt-4px">
              <NButton
                :loading="testLoading"
                :type="testStatus === 'success' ? 'success' : 'default'"
                dashed
                class="w-full"
                @click="handleTestConnection"
              >
                <template #icon>
                  <NIcon>
                    <div :class="testStatus === 'success' ? 'i-mdi-check-circle' : 'i-mdi-connection'" />
                  </NIcon>
                </template>
                {{ testStatus === 'success' ? '连接正常（点击重新测试）' : '测试连接' }}
              </NButton>
            </div>
          </div>

          <!-- 右侧：帮助面板 -->
          <div
            class="overflow-y-auto bg-gray-50/80 px-16px py-16px lg:w-240px lg:flex-shrink-0 dark:bg-[#18181c]"
            :class="isCompactDrawer ? 'border-t border-gray-100 dark:border-gray-800' : ''"
          >
            <div class="mb-12px flex items-center gap-8px">
              <div class="h-24px w-24px flex-center flex-shrink-0 rounded-6px bg-gray-50 dark:bg-gray-800">
                <img
                  :src="getDatasourceIcon(model.datasourceType)"
                  :alt="selectedTypeInfo.label"
                  class="h-16px w-16px object-contain"
                />
              </div>
              <span class="text-12px text-gray-700 font-semibold dark:text-gray-200">
                {{ currentHelp.title }}
              </span>
            </div>

            <NDivider class="my-10px!" />

            <div class="flex flex-col gap-12px">
              <div v-for="item in currentHelp.items" :key="item.label" class="flex flex-col gap-3px">
                <div class="flex items-center gap-6px">
                  <NIcon :size="13" class="flex-shrink-0 text-gray-400">
                    <div :class="item.icon" />
                  </NIcon>
                  <span class="text-11px text-gray-600 font-semibold dark:text-gray-300">
                    {{ item.label }}
                  </span>
                </div>
                <p class="pl-19px text-11px text-gray-400 leading-relaxed dark:text-gray-500">
                  {{ item.text }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 4: 过滤器 ── -->
        <div v-else-if="currentStep === 4" class="flex flex-col flex-1 gap-0 overflow-hidden lg:flex-row">
          <div class="flex-1 overflow-y-auto px-20px py-4px lg:border-r lg:border-gray-100 dark:lg:border-gray-800">
            <div
              class="mb-16px rounded-10px bg-amber-50 px-14px py-12px text-12px text-amber-700 leading-relaxed dark:bg-amber-900/10 dark:text-amber-300"
            >
              过滤器只影响后续元数据同步范围，不改变连接测试。支持填写正则表达式；未命中 includes 的对象不会同步，命中
              excludes 的对象会被排除。
            </div>

            <div class="flex flex-col gap-16px">
              <div class="border border-gray-200 rounded-12px px-16px py-14px dark:border-gray-700">
                <div class="mb-12px flex items-center justify-between">
                  <div>
                    <div class="text-14px text-gray-900 font-semibold dark:text-gray-100">Schema 过滤</div>
                    <div class="mt-4px text-12px text-gray-500 dark:text-gray-400">
                      MySQL 类数据源这里实际对应库名；PostgreSQL 对应 schema 名称。
                    </div>
                  </div>
                </div>

                <div class="mb-12px">
                  <div class="mb-6px text-12px text-gray-600 font-medium dark:text-gray-300">includes</div>
                  <NDynamicTags v-model:value="filterModel.schemaFilterPattern.includes" />
                  <div class="mt-6px text-12px text-gray-400 dark:text-gray-500">
                    仅同步命中的库/Schema，如 `^ods_.*$`
                  </div>
                </div>

                <div>
                  <div class="mb-6px text-12px text-gray-600 font-medium dark:text-gray-300">excludes</div>
                  <NDynamicTags v-model:value="filterModel.schemaFilterPattern.excludes" />
                  <div class="mt-6px text-12px text-gray-400 dark:text-gray-500">
                    从同步结果中排除命中的库/Schema，如 `^tmp_.*$`
                  </div>
                </div>
              </div>

              <div class="border border-gray-200 rounded-12px px-16px py-14px dark:border-gray-700">
                <div class="mb-12px">
                  <div class="text-14px text-gray-900 font-semibold dark:text-gray-100">Table 过滤</div>
                  <div class="mt-4px text-12px text-gray-500 dark:text-gray-400">
                    用于限制需要同步的表范围。建议先用 includes 缩小范围，再用 excludes 补充剔除特殊表。
                  </div>
                </div>

                <div class="mb-12px">
                  <div class="mb-6px text-12px text-gray-600 font-medium dark:text-gray-300">includes</div>
                  <NDynamicTags v-model:value="filterModel.tableFilterPattern.includes" />
                  <div class="mt-6px text-12px text-gray-400 dark:text-gray-500">
                    仅同步命中的表，如 `^(user|order)_.*$`
                  </div>
                </div>

                <div>
                  <div class="mb-6px text-12px text-gray-600 font-medium dark:text-gray-300">excludes</div>
                  <NDynamicTags v-model:value="filterModel.tableFilterPattern.excludes" />
                  <div class="mt-6px text-12px text-gray-400 dark:text-gray-500">
                    排除命中的表，如 `^bak_.*$`、`^tmp_.*$`
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="overflow-y-auto bg-gray-50/80 px-16px py-16px lg:w-240px lg:flex-shrink-0 dark:bg-[#18181c]"
            :class="isCompactDrawer ? 'border-t border-gray-100 dark:border-gray-800' : ''"
          >
            <div class="mb-12px text-12px text-gray-700 font-semibold dark:text-gray-200">规则说明</div>
            <div class="flex flex-col gap-10px text-12px text-gray-500 leading-relaxed dark:text-gray-400">
              <div>1. 未配置过滤器时，同步该数据源下全部可见对象。</div>
              <div>2. 配置 includes 后，仅保留匹配 includes 的对象。</div>
              <div>3. 配置 excludes 后，命中 excludes 的对象会被排除。</div>
              <div>4. 正则区分写法，不需要写分隔符，直接输入表达式即可。</div>
              <div>5. 过滤器只影响后续同步，不影响已存在连接配置。</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ FOOTER ═══ -->
      <template #footer>
        <div class="w-full flex items-center justify-between">
          <!-- 左侧取消 -->
          <NButton quaternary @click="closeDrawer">
            {{ $t('common.cancel') }}
          </NButton>

          <!-- 右侧导航 -->
          <NSpace :size="12">
            <NButton v-if="currentStep > (isEdit ? 2 : 1)" @click="goBack">
              <template #icon>
                <NIcon><div class="i-mdi-arrow-left" /></NIcon>
              </template>
              上一步
            </NButton>

            <!-- Step 1 / 2: 下一步 -->
            <NButton v-if="currentStep < 4" type="primary" @click="goNext">
              下一步
              <template #icon>
                <NIcon><div class="i-mdi-arrow-right" /></NIcon>
              </template>
            </NButton>

            <!-- Step 4: 保存 -->
            <NButton v-else type="primary" @click="handleSubmit">
              <template #icon>
                <NIcon><div class="i-mdi-check" /></NIcon>
              </template>
              {{ isEdit ? '保存修改' : '完成创建' }}
            </NButton>
          </NSpace>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
