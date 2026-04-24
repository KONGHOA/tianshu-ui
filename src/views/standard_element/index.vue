<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import {
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTag
} from 'naive-ui';
import {
  fetchAbolishStdDataElement,
  fetchChangeStdDataElement,
  fetchCreateStdDataElement,
  fetchGetStdDataElement,
  fetchGetStdDataElementHistory,
  fetchGetStdDataElementList,
  fetchSubmitStdDataElement,
  fetchUpdateStdDataElement
} from '@/service/api/metadata/standard-element';
import { fetchGetStdCodeSetList } from '@/service/api/metadata/standard-code-set';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import HelpLabel from './components/HelpLabel.vue';

defineOptions({
  name: 'StandardElement'
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const dataElementTypeOptions = [
  { label: '部标', value: 'NATIONAL' },
  { label: '省标', value: 'PROVINCIAL' },
  { label: '市标', value: 'MUNICIPAL' },
  { label: '自定义', value: 'CUSTOM' }
];

// GA/T 542-2011 表3：国际范围内认可的表示词
const representationTermOptions = [
  { label: '金额 — 货币单位的数量', value: '金额' },
  { label: '日期 — 特定的年月日', value: '日期' },
  { label: '日期时间 — 特定的年月日中的特定时间点', value: '日期时间' },
  { label: '代码 — 表示一组值中的一个值的字符串', value: '代码' },
  { label: '描述 — 一系列句子，如说明、备注、意见', value: '描述' },
  { label: '名称 — 指定的一个词或短语', value: '名称' },
  { label: '号码 — 特定值的数字表示，暗示顺序', value: '号码' },
  { label: '百分比 — 百分数形式的比率', value: '百分比' },
  { label: '量 — 非货币单位数量，通常与计量单位有关', value: '量' },
  { label: '比率 — 两个计量量或金额之比', value: '比率' },
  { label: '指示符 — 两个且只有两个条件值，如 on/off', value: '指示符' }
];

// GA/T 542-2011 表4：数据类型的取值
const dataTypeOptions = [
  { label: '字符型 (string)', value: '字符型' },
  { label: '数值型 (numeric)', value: '数值型' },
  { label: '日期型 (date)', value: '日期型' },
  { label: '日期时间型 (datetime)', value: '日期时间型' },
  { label: '时间型 (time)', value: '时间型' },
  { label: '布尔型 (boolean)', value: '布尔型' },
  { label: '二进制型 (binary)', value: '二进制型' }
];

// ---------- GA/T 542-2011 §4.5.3 表示格式智能构建器 ----------

// GA/T 542-2011 各属性含义说明（用于帮助图标气泡）
const FIELD_TIPS: Record<string, string> = {
  dataElementType: '数据元所属的业务分类类型，用于区分不同领域数据元。',
  internalIdentifier: '是在一个注册机构内由注册机构自行分配的，与语言无关的数据元的唯一标识符。',
  chineseName: '赋予数据元的单个或多个中文字词的指称；原则上由对象类词、特性词和表示词组成。',
  englishName: '赋予数据元的单个或多个英文字词的指称。',
  pinyinName: '分为数据元名称中的每一个汉字的拼音组成。中间用连字符连接，并全部使用小写。',
  symbol: '在数据应用中对数据元的统一标识。由该数据元中文名称中每个汉字的汉语拼音首字母组成。',
  language: '是对产生或使用数据元的应用环境或应用规程的说明或描述。',
  version: '是在一个注册机构内的一系列逐渐完善的数据元规范中，某个数据元规范发布的标识。',
  synonym: '是一个数据元在不同应用环境下的不同称谓。一个数据元可以有多个同义名称。',
  definition: '是用描述性的短语或句子对一个数据元所作的解释。',
  objectTerm: '表示数据元所属的事物或概念的集合，表示某一语境下的一个活动或对象。',
  featureTerm: '用以表达数据元所属的对象类的某个显著的、有区别的特征。',
  applicationConstraint: '表示数据元在实际应用中的相关约束，侧重于描述从应用中提取出的用法、规则等要求。',
  classificationScheme: '是根据数据元的来源、组成、功能等共同特性，将数据元排列或划分成组的模式。',
  classificationValue: '是指某个数据元在一个分类方案中所处的位置，用分类代码表示。',
  relationship: '用以描述当前数据元与其他相关数据元之间的关系（派生、组成、替代、连用）。',
  representationTerm: '用于描述数据元值域的表示形式。是数据元名称的组成成分之一。',
  dataType: '数据类型指数据元的表示方法（如：字符型、数值型等）。',
  dataFormat: '指从业务视角规定的数据元值的表示方式，包括所允许的最大和/或最小长度等。',
  valueRange: '是根据相应属性中规定的数据类型、表示格式而决定的数据元的允许值的集合。',
  normalizedIdentifier: '为规范查询、布控格式，将需要进行归一化处理的数据元素编码倒序重排生成。',
  codeSet: '当值域为标准代码集时，关联的代码集定义。选择后代码集名称和编码将自动填入。',
  measurementUnit: '计量单位为数值型数据元的一个属性。名称应符合 GB/T 17295 中的计量单位名称。',
  fusionUnitType: '描述融合数据元的来源单位。支持用多值表示，用逗号进行分隔。',
  fusionUnitCode: '描述对应单位的数据元编码，采用对应数据元的唯一标识符。支持用多值表示。',
  submissionOrg: '提出对数据元注册系统中的数据元新增、变更或废止的机构或所属部门。',
  registrationOrg: '公安部标准化行政主管部门授权对公安数据元实施注册、维护和管理功能的组织。',
  responsiblePerson: '提交数据元的主要起草人员。',
  description: '备注用以描述数据元的附加注释，即其他类属性未能描述的其他注释。'
};

const FORMAT_BUILDER_TYPES = ['字符型', '数值型', '日期型', '日期时间型', '时间型', '布尔型', '二进制型'];

const datePresetOptions = [
  { label: 'd4 — 仅年份 (YYYY)', value: 'd4' },
  { label: 'd6 — 年月 (YYYYMM)', value: 'd6' },
  { label: 'd8 — 年月日 (YYYYMMDD)', value: 'd8' }
];

const timePresetOptions = [
  { label: 't2 — 仅小时 (hh)', value: 't2' },
  { label: 't4 — 时分 (hhmm)', value: 't4' },
  { label: 't6 — 时分秒 (hhmmss)', value: 't6' }
];

const formatBuilder = reactive({
  lengthMode: 'fixed' as 'fixed' | 'variable' | 'unlimited',
  fixedLen: null as number | null,
  minLen: null as number | null,
  maxLen: null as number | null,
  datePreset: 'd8',
  timePreset: 't6',
  binarySubFormat: '',
  hasDecimal: false,
  decimalLen: null as number | null
});

const searchParams = reactive<Api.Metadata.StdDataElementSearchParams>({
  pageNum: 1,
  pageSize: 15,
  chineseName: null,
  internalIdentifier: null,
  symbol: null,
  lifecycleStatus: null,
  standardCategory: null,
  params: {}
});

const { data, loading, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetStdDataElementList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.pageNum = params.page;
    searchParams.pageSize = params.pageSize;
  },
  paginationProps: {
    pageSize: 15
  },
  columns: () => []
});

const formRef = ref<FormInst | null>(null);
const modalVisible = ref(false);
const modalLoading = ref(false);
const historyVisible = ref(false);
const historyLoading = ref(false);
const codeSetVisible = ref(false);
const codeSetLoading = ref(false);
const editingId = ref<CommonType.IdType | null>(null);
const historyList = ref<Api.Metadata.StdDataElementVersion[]>([]);
const historyTitle = ref('');
const codeSetList = ref<Api.Metadata.StdCodeSet[]>([]);

const formModel = reactive<Api.Metadata.StdDataElementOperateParams>({
  dataElementId: undefined,
  bizId: '',
  dataElementType: 'CUSTOM',
  internalIdentifier: '',
  chineseName: '',
  englishName: '',
  pinyinName: '',
  keywordFieldName: '',
  publishedName: '',
  language: '',
  symbol: '',
  context: '',
  version: '1.0',
  synonym: '',
  definition: '',
  objectTerm: '',
  featureTerm: '',
  applicationConstraint: '',
  applicationContext: '',
  classificationScheme: '',
  classificationValue: '',
  relationship: '',
  relationshipDescription: '',
  representationTerm: '',
  dataType: '',
  dataFormat: '',
  normalizedIdentifier: '',
  codeSetId: undefined,
  codeSetCode: '',
  codeSetName: '',
  valueRange: '',
  measurementUnit: '',
  fusionUnitType: '',
  fusionUnitCode: '',
  lifecycleStatus: 'ORIGIN',
  submissionOrg: '',
  registrationOrg: '',
  responsiblePerson: '',
  standardCategory: '',
  standardNumber: '',
  standardName: '',
  standardStatus: '',
  description: '',
  remark: ''
});

// ---------- 表示格式弹窗 ----------
const formatModalVisible = ref(false);
const builderDataType = ref('');

function buildTextNumericFormat(t: string): string {
  const pfx = t === '字符型' ? 'c' : 'n';
  const decPart =
    t === '数值型' && formatBuilder.hasDecimal && formatBuilder.decimalLen !== null
      ? `,${formatBuilder.decimalLen}`
      : '';
  if (formatBuilder.lengthMode === 'fixed') {
    if (formatBuilder.fixedLen === null) return '';
    return `${pfx}${formatBuilder.fixedLen}${decPart}`;
  }
  if (formatBuilder.lengthMode === 'unlimited') return `${pfx}..ul`;
  const minStr = formatBuilder.minLen !== null ? String(formatBuilder.minLen) : '';
  const maxStr = formatBuilder.maxLen !== null ? String(formatBuilder.maxLen) : '';
  if (minStr && maxStr) return `${pfx}${minStr}..${maxStr}${decPart}`;
  if (maxStr) return `${pfx}..${maxStr}${decPart}`;
  if (minStr) return `${pfx}${minStr}..`;
  return '';
}

const builtFormat = computed<string>(() => {
  const t = builderDataType.value;
  if (!t || !FORMAT_BUILDER_TYPES.includes(t)) return '';
  if (t === '布尔型') return 'bl';
  if (t === '日期时间型') return 'd14';
  if (t === '二进制型')
    return formatBuilder.binarySubFormat ? `bn ${formatBuilder.binarySubFormat.toUpperCase()}` : 'bn';
  if (t === '日期型') return formatBuilder.datePreset;
  if (t === '时间型') return formatBuilder.timePreset;
  return buildTextNumericFormat(t);
});

watch(builderDataType, (newType, oldType) => {
  if (newType === oldType) return;
  resetFormatBuilder();
});

function resetFormatBuilder() {
  Object.assign(formatBuilder, {
    lengthMode: 'fixed',
    fixedLen: null,
    minLen: null,
    maxLen: null,
    datePreset: 'd8',
    timePreset: 't6',
    binarySubFormat: '',
    hasDecimal: false,
    decimalLen: null
  });
}

function parseNumericFormat(rest: string) {
  if (rest === '..ul') {
    formatBuilder.lengthMode = 'unlimited';
    return;
  }
  if (rest.includes('..')) {
    formatBuilder.lengthMode = 'variable';
    const dotIdx = rest.indexOf('..');
    const minStr = rest.slice(0, dotIdx);
    const afterDots = rest.slice(dotIdx + 2);
    formatBuilder.minLen = minStr ? Number.parseInt(minStr, 10) || null : null;
    if (afterDots.includes(',')) {
      const [maxStr, decStr] = afterDots.split(',');
      formatBuilder.maxLen = maxStr ? Number.parseInt(maxStr, 10) || null : null;
      formatBuilder.decimalLen = decStr ? Number.parseInt(decStr, 10) || null : null;
      formatBuilder.hasDecimal = true;
    } else {
      formatBuilder.maxLen = afterDots && afterDots !== 'ul' ? Number.parseInt(afterDots, 10) || null : null;
    }
  } else if (rest.includes(',')) {
    formatBuilder.lengthMode = 'fixed';
    const [lenStr, decStr] = rest.split(',');
    formatBuilder.fixedLen = lenStr ? Number.parseInt(lenStr, 10) || null : null;
    formatBuilder.decimalLen = decStr ? Number.parseInt(decStr, 10) || null : null;
    formatBuilder.hasDecimal = true;
  } else if (rest) {
    formatBuilder.lengthMode = 'fixed';
    formatBuilder.fixedLen = Number.parseInt(rest, 10) || null;
  }
}

function parseFormatString(fmt: string, type: string) {
  if (!fmt || !type) return;
  if (type === '日期型') {
    if (['d4', 'd6', 'd8'].includes(fmt)) formatBuilder.datePreset = fmt;
    return;
  }
  if (type === '时间型') {
    if (['t2', 't4', 't6'].includes(fmt)) formatBuilder.timePreset = fmt;
    return;
  }
  if (type === '二进制型') {
    formatBuilder.binarySubFormat = fmt.replace(/^bn\s*/i, '');
    return;
  }
  if (type !== '字符型' && type !== '数值型') return;
  const pfx = type === '字符型' ? 'c' : 'n';
  const rest = fmt.startsWith(pfx) ? fmt.slice(pfx.length) : fmt;
  parseNumericFormat(rest);
}

const rules: FormRules = {
  // ── 必选属性（GA/T 542-2011 表1 提交机构侧）─────────────────────
  dataElementType: { required: true, message: '请选择数据元类型', trigger: ['change', 'blur'] },
  chineseName: { required: true, message: '请填写中文名称', trigger: ['blur', 'input'] },
  pinyinName: { required: true, message: '请填写中文全拼', trigger: ['blur', 'input'] },
  symbol: { required: true, message: '请填写标识符', trigger: ['blur', 'input'] },
  definition: { required: true, message: '请填写数据元说明', trigger: ['blur', 'input'] },
  objectTerm: { required: true, message: '请填写对象类词', trigger: ['blur', 'input'] },
  featureTerm: { required: true, message: '请填写特性词', trigger: ['blur', 'input'] },
  representationTerm: { required: true, message: '请选择表示词', trigger: ['change', 'blur'] },
  dataFormat: { required: true, message: '请设置表示格式（含数据类型）', trigger: ['change', 'blur'] },
  submissionOrg: { required: true, message: '请填写提交机构', trigger: ['blur', 'input'] },
  version: { required: true, message: '请填写版本', trigger: ['blur', 'input'] }
};

function resetForm() {
  editingId.value = null;
  Object.assign(formModel, {
    dataElementId: undefined,
    bizId: '',
    dataElementType: 'CUSTOM',
    internalIdentifier: '',
    chineseName: '',
    englishName: '',
    pinyinName: '',
    keywordFieldName: '',
    publishedName: '',
    language: '',
    symbol: '',
    context: '',
    version: '1.0',
    synonym: '',
    definition: '',
    objectTerm: '',
    featureTerm: '',
    applicationConstraint: '',
    applicationContext: '',
    classificationScheme: '',
    classificationValue: '',
    relationship: '',
    relationshipDescription: '',
    representationTerm: '',
    dataType: '',
    dataFormat: '',
    normalizedIdentifier: '',
    codeSetId: undefined,
    codeSetCode: '',
    codeSetName: '',
    valueRange: '',
    measurementUnit: '',
    fusionUnitType: '',
    fusionUnitCode: '',
    lifecycleStatus: 'ORIGIN',
    submissionOrg: '',
    registrationOrg: '',
    responsiblePerson: '',
    standardCategory: '',
    standardNumber: '',
    standardName: '',
    standardStatus: '',
    description: '',
    remark: ''
  });
  resetFormatBuilder();
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleAdd() {
  resetForm();
  modalVisible.value = true;
}

async function handleEdit(dataElementId: CommonType.IdType) {
  resetForm();
  const { data: detail, error } = await fetchGetStdDataElement(dataElementId);
  if (error || !detail) return;
  editingId.value = dataElementId;
  Object.assign(formModel, detail);
  if (detail.dataFormat && detail.dataType) {
    parseFormatString(detail.dataFormat, detail.dataType);
  }
  modalVisible.value = true;
}

async function handleHistory(row: Api.Metadata.StdDataElement) {
  historyTitle.value = row.chineseName;
  historyVisible.value = true;
  historyLoading.value = true;
  const { data: history } = await fetchGetStdDataElementHistory(row.bizId);
  historyList.value = history || [];
  historyLoading.value = false;
}

async function handleSubmit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const request = editingId.value ? fetchUpdateStdDataElement(formModel) : fetchCreateStdDataElement(formModel);
  const { error } = await request;
  modalLoading.value = false;
  if (error) return;
  window.$message?.success(editingId.value ? '修改成功' : '新增成功');
  modalVisible.value = false;
  getData();
}

async function handleWorkflowSubmit(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchSubmitStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `提交数据元《${row.chineseName}》进入审批流程`
  });
  if (error) return;
  window.$message?.success('提交审批成功');
  getData();
}

async function handleWorkflowChange(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchChangeStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `发起数据元《${row.chineseName}》变更审批`
  });
  if (error) return;
  window.$message?.success('变更申请已提交');
  getData();
}

async function handleWorkflowAbolish(row: Api.Metadata.StdDataElement) {
  const { error } = await fetchAbolishStdDataElement({
    id: row.dataElementId,
    bizId: row.bizId,
    flowCode: 'std_data_element',
    submitReason: `发起数据元《${row.chineseName}》废止审批`
  });
  if (error) return;
  window.$message?.success('废止申请已提交');
  getData();
}

async function openCodeSetSelector() {
  codeSetVisible.value = true;
  if (codeSetList.value.length > 0) return;
  codeSetLoading.value = true;
  const { data: list } = await fetchGetStdCodeSetList({ pageNum: 1, pageSize: 200, params: {} });
  codeSetList.value = list?.rows || [];
  codeSetLoading.value = false;
}

function selectCodeSet(row: Api.Metadata.StdCodeSet) {
  formModel.codeSetId = row.codeSetId;
  formModel.codeSetCode = row.codeSetCode;
  formModel.codeSetName = row.codeSetName;
  codeSetVisible.value = false;
}

function clearCodeSet() {
  formModel.codeSetId = undefined;
  formModel.codeSetCode = '';
  formModel.codeSetName = '';
}

function openFormatModal() {
  builderDataType.value = formModel.dataType || '';
  if (formModel.dataFormat && formModel.dataType) {
    resetFormatBuilder();
    parseFormatString(formModel.dataFormat, formModel.dataType);
  } else {
    resetFormatBuilder();
  }
  formatModalVisible.value = true;
}

function confirmFormat() {
  formModel.dataType = builderDataType.value;
  formModel.dataFormat = builtFormat.value;
  formatModalVisible.value = false;
}

function clearFormat() {
  formModel.dataType = '';
  formModel.dataFormat = '';
  builderDataType.value = '';
  resetFormatBuilder();
}

function handleSimilaritySuggest() {
  window.$message?.info('相似推荐待接入');
}

const columns = computed<DataTableColumns<Api.Metadata.StdDataElement>>(() => [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    render: (_, index) => {
      const page = mobilePagination.value?.page || 1;
      const pageSize = mobilePagination.value?.pageSize || 10;
      return (page - 1) * pageSize + index + 1;
    }
  },
  { key: 'internalIdentifier', title: '内部标识符', width: 110, align: 'center' },
  { key: 'symbol', title: '标识符', minWidth: 120, align: 'center' },
  { key: 'chineseName', title: '中文名称', minWidth: 140, align: 'center' },
  { key: 'definition', title: '说明', minWidth: 280, ellipsis: { tooltip: true }, align: 'center' },
  { key: 'dataType', title: '数据类型', width: 100, align: 'center' },
  { key: 'dataFormat', title: '表示格式', width: 120, align: 'center' },
  { key: 'version', title: '版本号', width: 90, align: 'center' },
  {
    key: 'lifecycleStatus',
    title: '状态',
    width: 100,
    align: 'center',
    render: row => {
      const statusMap: Record<string, string> = {
        ORIGINAL: '原始',
        DRAFT: '草案',
        SOLICITING: '征求意见',
        FOR_APPROVAL: '报批',
        STANDARD: '标准',
        REJECTED: '未批准',
        DEPRECATED: '废止'
      };

      const typeMap: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
        ORIGINAL: 'default',
        DRAFT: 'default',
        SOLICITING: 'info',
        FOR_APPROVAL: 'warning',
        STANDARD: 'success',
        REJECTED: 'error',
        DEPRECATED: 'error'
      };

      const tagType = typeMap[row.lifecycleStatus || ''] || 'default';

      return h(
        NTag,
        { size: 'small', type: tagType },
        { default: () => statusMap[row.lifecycleStatus || ''] || row.lifecycleStatus || '-' }
      );
    }
  },
  {
    key: 'approvalDate',
    title: '批准日期',
    width: 100,
    align: 'center',
    render: row => {
      // 从 2024-11-09 00:00:00 截取前面的日期部分
      if (!row.approvalDate) return '-';
      return String(row.approvalDate).split(' ')[0];
    }
  },
  {
    key: 'operate',
    title: '操作',
    width: 180,
    fixed: 'right',
    align: 'center',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        hasAuth('metadata:standard:element:edit')
          ? h(
              NButton,
              { text: true, type: 'primary', size: 'small', onClick: () => handleEdit(row.dataElementId) },
              { default: () => '编辑' }
            )
          : null,
        hasAuth('metadata:standard:element:submit') && ['ORIGIN', 'REJECTED'].includes(row.lifecycleStatus || '')
          ? h(
              NButton,
              { text: true, type: 'success', size: 'small', onClick: () => handleWorkflowSubmit(row) },
              { default: () => '提交' }
            )
          : null,
        hasAuth('metadata:standard:element:change') && row.lifecycleStatus === 'STANDARD'
          ? h(
              NButton,
              { text: true, type: 'primary', size: 'small', onClick: () => handleWorkflowChange(row) },
              { default: () => '变更' }
            )
          : null,
        hasAuth('metadata:standard:element:abolish') && row.lifecycleStatus === 'STANDARD'
          ? h(
              NButton,
              { text: true, type: 'error', size: 'small', onClick: () => handleWorkflowAbolish(row) },
              { default: () => '废止' }
            )
          : null,
        h(NButton, { text: true, size: 'small', onClick: () => handleHistory(row) }, { default: () => '历史' })
      ])
  }
]);

const historyColumns: DataTableColumns<Api.Metadata.StdDataElementVersion> = [
  { key: 'versionNo', title: '版本号', width: 100, align: 'center' },
  { key: 'actionType', title: '操作类型', width: 100, align: 'center' },
  { key: 'chineseName', title: '名称', minWidth: 160, align: 'center' },
  { key: 'symbol', title: '标识符', minWidth: 140, align: 'center' },
  {
    key: 'lifecycleStatus',
    title: '状态',
    width: 100,
    align: 'center',
    render: row => {
      const statusMap: Record<string, string> = {
        ORIGINAL: '原始',
        DRAFT: '草案',
        SOLICITING: '征求意见',
        FOR_APPROVAL: '报批',
        STANDARD: '标准',
        REJECTED: '未批准',
        DEPRECATED: '废止'
      };
      const typeMap: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
        ORIGINAL: 'default',
        DRAFT: 'default',
        SOLICITING: 'info',
        FOR_APPROVAL: 'warning',
        STANDARD: 'success',
        REJECTED: 'error',
        DEPRECATED: 'error'
      };
      const tagType = typeMap[row.lifecycleStatus || ''] || 'default';
      return h(
        NTag,
        { size: 'small', type: tagType },
        { default: () => statusMap[row.lifecycleStatus || ''] || row.lifecycleStatus || '-' }
      );
    }
  },
  {
    key: 'isCurrent',
    title: '当前版本',
    width: 90,
    align: 'center',
    render: row => (row.isCurrent === '1' ? '是' : '否')
  }
];

const codeSetColumns: DataTableColumns<Api.Metadata.StdCodeSet> = [
  { key: 'codeSetCode', title: '代码集编码', width: 140, align: 'center' },
  { key: 'codeSetName', title: '代码集名称', minWidth: 220, align: 'center' },
  { key: 'version', title: '版本', width: 80, align: 'center' },
  {
    key: 'operate',
    title: '选择',
    width: 90,
    align: 'center',
    render: row =>
      h(NButton, { size: 'small', type: 'primary', onClick: () => selectCodeSet(row) }, { default: () => '选择' })
  }
];
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <NCard title="数据元列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace align="center" :size="12">
          <NInput
            v-model:value="(searchParams.params as any).searchValue"
            placeholder="输入中文名称或标识符"
            clearable
            size="small"
            style="width: 260px"
            @keyup.enter="handleSearch"
          />
          <NButton size="small" type="primary" ghost @click="handleSearch">
            <template #icon><icon-mdi-magnify /></template>
            查询
          </NButton>
          <NButton v-if="hasAuth('metadata:standard:element:add')" size="small" type="primary" @click="handleAdd">
            <template #icon><icon-mdi-plus /></template>
            新增数据元
          </NButton>
          <NButton size="small" @click="getData">
            <template #icon><icon-mdi-refresh /></template>
            刷新
          </NButton>
        </NSpace>
      </template>
      <NDataTable
        :columns="columns"
        :data="data as Api.Metadata.StdDataElement[]"
        :loading="loading"
        :pagination="mobilePagination"
        :flex-height="!appStore.isMobile"
        remote
        :row-key="row => row.dataElementId"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '数据元编辑' : '数据元新增'"
      class="std-element-modal"
    >
      <NForm
        ref="formRef"
        :model="formModel"
        :rules="rules"
        label-placement="left"
        label-width="115"
        size="small"
        require-mark-placement="left"
      >
        <NGrid :x-gap="16" :cols="2">
          <!-- 左侧区块 -->
          <NGridItem>
            <div class="flex flex-col gap-12px pt-4px">
              <!-- 1. 标识类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">1. 标识类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem path="dataElementType">
                    <template #label><HelpLabel label="数据元类型" :tip="FIELD_TIPS.dataElementType" /></template>
                    <NSelect
                      v-model:value="formModel.dataElementType"
                      :options="dataElementTypeOptions"
                      placeholder="请选择"
                      clearable
                    />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="内部标识符" :tip="FIELD_TIPS.internalIdentifier" /></template>
                    <NInput v-model:value="formModel.internalIdentifier" placeholder="系统自动生成" readonly />
                  </NFormItem>
                  <NFormItem class="span-2" path="chineseName">
                    <template #label><HelpLabel label="中文名称" :tip="FIELD_TIPS.chineseName" /></template>
                    <div class="inline-field">
                      <NInput
                        v-model:value="formModel.chineseName"
                        maxlength="200"
                        show-count
                        placeholder="请输入中文名"
                      />
                      <NButton secondary type="primary" @click="handleSimilaritySuggest">推荐</NButton>
                    </div>
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="英文名称" :tip="FIELD_TIPS.englishName" /></template>
                    <NInput v-model:value="formModel.englishName" maxlength="200" show-count />
                  </NFormItem>
                  <NFormItem path="pinyinName">
                    <template #label><HelpLabel label="中文全拼" :tip="FIELD_TIPS.pinyinName" /></template>
                    <NInput v-model:value="formModel.pinyinName" maxlength="200" show-count />
                  </NFormItem>
                  <NFormItem path="symbol">
                    <template #label><HelpLabel label="标识符" :tip="FIELD_TIPS.symbol" /></template>
                    <NInput v-model:value="formModel.symbol" maxlength="100" show-count placeholder="请输入标识符" />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="语境" :tip="FIELD_TIPS.language" /></template>
                    <NInput v-model:value="formModel.language" maxlength="50" show-count />
                  </NFormItem>
                  <NFormItem path="version">
                    <template #label><HelpLabel label="版本" :tip="FIELD_TIPS.version" /></template>
                    <NInput v-model:value="formModel.version" />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="同义名称" :tip="FIELD_TIPS.synonym" /></template>
                    <NInput v-model:value="formModel.synonym" />
                  </NFormItem>
                </div>
              </NCard>

              <!-- 3. 表示类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">3. 表示类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem path="representationTerm">
                    <template #label><HelpLabel label="表示词" :tip="FIELD_TIPS.representationTerm" /></template>
                    <NSelect
                      v-model:value="formModel.representationTerm"
                      :options="representationTermOptions"
                      placeholder="请选择"
                      clearable
                      filterable
                      tag
                    />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="数据类型" :tip="FIELD_TIPS.dataType" /></template>
                    <NInput :value="formModel.dataType || ''" readonly placeholder="自动填充" />
                  </NFormItem>
                  <NFormItem class="span-2" path="dataFormat">
                    <template #label><HelpLabel label="表示格式" :tip="FIELD_TIPS.dataFormat" /></template>
                    <div class="inline-field">
                      <NInput :value="formModel.dataFormat || ''" readonly placeholder="点击下方「设置格式」配置" />
                      <NButton type="primary" secondary @click="openFormatModal">设置格式</NButton>
                      <NButton v-if="formModel.dataFormat" @click="clearFormat">清除</NButton>
                    </div>
                  </NFormItem>
                  <NFormItem path="valueRange">
                    <template #label><HelpLabel label="值域" :tip="FIELD_TIPS.valueRange" /></template>
                    <NInput v-model:value="formModel.valueRange" maxlength="1000" show-count />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="归一化标识" :tip="FIELD_TIPS.normalizedIdentifier" /></template>
                    <NInput v-model:value="formModel.normalizedIdentifier" maxlength="50" show-count />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="代码集" :tip="FIELD_TIPS.codeSet" /></template>
                    <div class="inline-field">
                      <NInput :value="formModel.codeSetName || ''" placeholder="请选择" readonly />
                      <NButton secondary type="primary" @click="openCodeSetSelector">选择</NButton>
                      <NButton @click="clearCodeSet">清除</NButton>
                    </div>
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="计量单位" :tip="FIELD_TIPS.measurementUnit" /></template>
                    <NInput v-model:value="formModel.measurementUnit" placeholder="请输入" />
                  </NFormItem>
                </div>
              </NCard>

              <!-- 6. 融合类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">6. 融合类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem>
                    <template #label><HelpLabel label="融合类型" :tip="FIELD_TIPS.fusionUnitType" /></template>
                    <NInput
                      v-model:value="formModel.fusionUnitType"
                      maxlength="200"
                      show-count
                      placeholder="01(网安); 02(技侦)"
                    />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="融合编码" :tip="FIELD_TIPS.fusionUnitCode" /></template>
                    <NInput v-model:value="formModel.fusionUnitCode" maxlength="200" show-count />
                  </NFormItem>
                </div>
              </NCard>
            </div>
          </NGridItem>

          <!-- 右侧区块 -->
          <NGridItem>
            <div class="flex flex-col gap-12px pt-4px">
              <!-- 2. 定义类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">2. 定义类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem class="span-2" path="definition">
                    <template #label><HelpLabel label="说明" :tip="FIELD_TIPS.definition" /></template>
                    <NInput v-model:value="formModel.definition" maxlength="255" show-count placeholder="请输入说明" />
                  </NFormItem>
                  <NFormItem path="objectTerm">
                    <template #label><HelpLabel label="对象类词" :tip="FIELD_TIPS.objectTerm" /></template>
                    <NInput v-model:value="formModel.objectTerm" />
                  </NFormItem>
                  <NFormItem path="featureTerm">
                    <template #label><HelpLabel label="特性词" :tip="FIELD_TIPS.featureTerm" /></template>
                    <NInput v-model:value="formModel.featureTerm" />
                  </NFormItem>
                  <NFormItem class="span-2">
                    <template #label><HelpLabel label="应用约束" :tip="FIELD_TIPS.applicationConstraint" /></template>
                    <NInput v-model:value="formModel.applicationConstraint" maxlength="200" show-count />
                  </NFormItem>
                </div>
              </NCard>

              <!-- 4. 关系类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">4. 关系类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem>
                    <template #label><HelpLabel label="分类方案" :tip="FIELD_TIPS.classificationScheme" /></template>
                    <NInput v-model:value="formModel.classificationScheme" placeholder="请输入" />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="分类方案值" :tip="FIELD_TIPS.classificationValue" /></template>
                    <NInput v-model:value="formModel.classificationValue" placeholder="请输入" />
                  </NFormItem>
                  <NFormItem class="span-2">
                    <template #label><HelpLabel label="关系" :tip="FIELD_TIPS.relationship" /></template>
                    <NInput v-model:value="formModel.relationship" maxlength="200" show-count />
                  </NFormItem>
                </div>
              </NCard>

              <!-- 5. 管理类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">5. 管理类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem path="submissionOrg">
                    <template #label><HelpLabel label="提交机构" :tip="FIELD_TIPS.submissionOrg" /></template>
                    <NInput v-model:value="formModel.submissionOrg" maxlength="200" show-count />
                  </NFormItem>
                  <NFormItem>
                    <template #label><HelpLabel label="注册机构" :tip="FIELD_TIPS.registrationOrg" /></template>
                    <NInput v-model:value="formModel.registrationOrg" maxlength="200" show-count />
                  </NFormItem>
                  <NFormItem class="span-2">
                    <template #label><HelpLabel label="主要起草人" :tip="FIELD_TIPS.responsiblePerson" /></template>
                    <NInput v-model:value="formModel.responsiblePerson" maxlength="20" show-count />
                  </NFormItem>
                </div>
              </NCard>

              <!-- 7. 附加类属性 -->
              <NCard size="small" class="border border-gray-200 rounded-8px shadow-sm">
                <template #header><span class="text-[14px] font-bold">7. 附加类属性</span></template>
                <div class="dashboard-grid">
                  <NFormItem class="span-2">
                    <template #label><HelpLabel label="描述(备注)" :tip="FIELD_TIPS.description" /></template>
                    <NInput
                      v-model:value="formModel.description"
                      type="textarea"
                      placeholder="请输入描述"
                      :autosize="{ minRows: 2, maxRows: 3 }"
                    />
                  </NFormItem>
                </div>
              </NCard>
            </div>
          </NGridItem>
        </NGrid>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="modalLoading" @click="handleSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 表示格式构建器弹窗 -->
    <NModal v-model:show="formatModalVisible" preset="card" title="设置表示格式" class="format-builder-modal">
      <div class="fmt-modal-body">
        <!-- Step 1: 数据类型卡片选择 -->
        <div class="fmt-section-label">选择数据类型</div>
        <div class="fmt-type-grid">
          <div
            v-for="opt in dataTypeOptions"
            :key="opt.value"
            class="fmt-type-card"
            :class="{ 'fmt-type-card--active': builderDataType === opt.value }"
            @click="builderDataType = opt.value"
          >
            <span class="fmt-type-name">{{ opt.label.split(' ')[0] }}</span>
            <span class="fmt-type-eng">{{ opt.label.match(/\(([^)]+)\)/)?.[1] ?? '' }}</span>
          </div>
        </div>

        <!-- Step 2: 格式配置 -->
        <template v-if="builderDataType">
          <div class="fmt-section-label" style="margin-top: 16px">配置格式</div>
          <div class="fmt-config-area">
            <!-- 布尔型：固定 bl -->
            <template v-if="builderDataType === '布尔型'">
              <div class="format-auto">
                <code class="format-badge">bl</code>
                <span class="format-hint">布尔型格式固定为 bl，无需配置</span>
              </div>
            </template>
            <!-- 日期时间型：固定 d14 -->
            <template v-else-if="builderDataType === '日期时间型'">
              <div class="format-auto">
                <code class="format-badge">d14</code>
                <span class="format-hint">日期时间型格式固定为 d14（YYYYMMDDhhmmss）</span>
              </div>
            </template>
            <!-- 日期型：精度选择 -->
            <template v-else-if="builderDataType === '日期型'">
              <NSelect v-model:value="formatBuilder.datePreset" :options="datePresetOptions" style="width: 100%" />
            </template>
            <!-- 时间型：精度选择 -->
            <template v-else-if="builderDataType === '时间型'">
              <NSelect v-model:value="formatBuilder.timePreset" :options="timePresetOptions" style="width: 100%" />
            </template>
            <!-- 二进制型：子格式输入 -->
            <template v-else-if="builderDataType === '二进制型'">
              <NInput v-model:value="formatBuilder.binarySubFormat" placeholder="请输入具体格式，如 JPEG、MP3">
                <template #prefix><span style="color: var(--n-text-color3)">bn&nbsp;</span></template>
              </NInput>
            </template>
            <!-- 字符型 / 数值型：长度构建器 -->
            <template v-else>
              <div class="format-length-builder">
                <NRadioGroup v-model:value="formatBuilder.lengthMode" size="small">
                  <NRadioButton value="fixed">定长</NRadioButton>
                  <NRadioButton value="variable">不定长</NRadioButton>
                  <NRadioButton v-if="builderDataType === '字符型'" value="unlimited">不限长度</NRadioButton>
                </NRadioGroup>
                <div v-if="formatBuilder.lengthMode === 'fixed'" class="format-len-row">
                  <span class="format-label">长度</span>
                  <NInputNumber
                    v-model:value="formatBuilder.fixedLen"
                    :min="1"
                    :precision="0"
                    size="small"
                    placeholder="输入长度"
                    class="format-num"
                  />
                </div>
                <div v-else-if="formatBuilder.lengthMode === 'variable'" class="format-len-row">
                  <NInputNumber
                    v-model:value="formatBuilder.minLen"
                    :min="0"
                    :precision="0"
                    size="small"
                    placeholder="最小（可选）"
                    class="format-num"
                  />
                  <span class="format-dots">..</span>
                  <NInputNumber
                    v-model:value="formatBuilder.maxLen"
                    :min="1"
                    :precision="0"
                    size="small"
                    placeholder="最大"
                    class="format-num"
                  />
                </div>
                <div v-else-if="formatBuilder.lengthMode === 'unlimited'" class="format-auto">
                  <code class="format-badge">c..ul</code>
                  <span class="format-hint">长度不确定的文本，无最大限制</span>
                </div>
                <div v-if="builderDataType === '数值型'" class="format-decimal-row">
                  <NCheckbox v-model:checked="formatBuilder.hasDecimal" size="small">含小数</NCheckbox>
                  <template v-if="formatBuilder.hasDecimal">
                    <span class="format-label">小数位</span>
                    <NInputNumber
                      v-model:value="formatBuilder.decimalLen"
                      :min="1"
                      :max="10"
                      :precision="0"
                      size="small"
                      class="format-num"
                      style="width: 64px"
                    />
                    <span class="format-label">位</span>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- 结果预览 -->
        <div v-if="builtFormat" class="fmt-result-bar">
          <span class="fmt-result-label">生成格式</span>
          <code class="fmt-result-code">{{ builtFormat }}</code>
          <span class="fmt-result-type">数据类型将设为「{{ builderDataType }}」</span>
        </div>
      </div>
      <template #action>
        <NSpace justify="end">
          <NButton size="small" @click="formatModalVisible = false">取消</NButton>
          <NButton size="small" type="primary" :disabled="!builtFormat" @click="confirmFormat">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="codeSetVisible" preset="card" title="选择代码集" class="w-880px">
      <NDataTable
        size="small"
        :columns="codeSetColumns"
        :data="codeSetList"
        :loading="codeSetLoading"
        :pagination="false"
        :row-key="row => row.codeSetId"
      />
    </NModal>

    <NModal
      v-model:show="historyVisible"
      preset="card"
      title="数据元历史版本"
      style="width: 1050px"
      class="std-history-modal"
      size="small"
    >
      <NDataTable
        size="small"
        :columns="historyColumns"
        :data="historyList"
        :loading="historyLoading"
        :pagination="false"
      />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
:deep(.n-data-table-wrapper),
:deep(.n-data-table-base-table),
:deep(.n-data-table-base-table-body) {
  height: 100%;
}

:global(.std-element-modal) {
  width: min(1320px, 88vw) !important;
}

:global(.std-element-modal) .n-card__content {
  overflow: visible;
}

.std-element-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 18px;
}

.inline-field {
  display: flex;
  gap: 8px;
  width: 100%;
}

.inline-field :deep(.n-input) {
  flex: 1;
}

.format-builder-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.format-length-builder {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.format-len-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.format-decimal-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.format-num {
  width: 88px !important;
}

.format-auto {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-preview-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
}

.format-label {
  font-size: 12px;
  color: var(--n-text-color3, #999);
  white-space: nowrap;
}

.format-dots {
  font-weight: 600;
  color: var(--n-primary-color, #2080f0);
  padding: 0 2px;
}

.format-hint {
  font-size: 12px;
  color: var(--n-text-color3, #999);
}

.format-badge {
  background: var(--n-primary-color-suppl, #ddeeff);
  color: var(--n-primary-color, #2080f0);
  border: 1px solid currentcolor;
  border-radius: 4px;
  padding: 1px 8px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.span-2 {
  grid-column: span 2;
}

@media (max-width: 1200px) {
  .std-element-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .std-element-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2 {
    grid-column: auto;
  }

  .inline-field {
    flex-wrap: wrap;
  }
}

/* 弹窗样式（通过 :global 穿透）*/
:global(.format-builder-modal) {
  width: min(640px, 90vw) !important;
}

:global(.format-builder-modal) .n-card__content {
  overflow: visible;
}

/* 格式构建器弹窗内部 */
.fmt-modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fmt-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color2);
  margin-bottom: 8px;
}

.fmt-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.fmt-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 6px;
  border: 1.5px solid var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--n-card-color);

  &:hover {
    border-color: var(--n-primary-color);
    background: var(--n-primary-color-hover);
  }

  &--active {
    border-color: var(--n-primary-color) !important;
    background: var(--n-primary-color-suppl, #e8f4ff) !important;

    .fmt-type-name {
      color: var(--n-primary-color);
    }
  }
}

.fmt-type-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color1);
  white-space: nowrap;
}

.fmt-type-eng {
  font-size: 11px;
  color: var(--n-text-color3);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.fmt-config-area {
  padding: 12px;
  background: var(--n-color-modal, rgba(0, 0, 0, 0.03));
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.fmt-result-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  padding: 10px 14px;
  background: var(--n-primary-color-suppl, #e8f4ff);
  border: 1px solid var(--n-primary-color, #2080f0);
  border-radius: 8px;
}

.fmt-result-label {
  font-size: 12px;
  color: var(--n-primary-color);
  white-space: nowrap;
  font-weight: 500;
}

.fmt-result-code {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--n-primary-color);
  letter-spacing: 0.5px;
}

.fmt-result-type {
  font-size: 12px;
  color: var(--n-text-color3);
  margin-left: auto;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}
.dashboard-grid > .span-2 {
  grid-column: span 2;
}
</style>
