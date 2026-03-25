/** Shared option arrays and composable for sink save-mode confirmations */

export const schemaSaveModeOptions = [
  { label: '不存在时创建 (CREATE)', value: 'CREATE_SCHEMA_WHEN_NOT_EXIST' },
  { label: '重建表结构 (RECREATE)', value: 'RECREATE_SCHEMA' },
  { label: '不存在时报错 (ERROR)', value: 'ERROR_WHEN_SCHEMA_NOT_EXIST' },
  { label: '忽略 (IGNORE)', value: 'IGNORE' }
];

export const dataSaveModeOptions = [
  { label: '追加数据 (APPEND)', value: 'APPEND_DATA' },
  { label: '清空数据 (DROP)', value: 'DROP_DATA' },
  { label: '自定义处理 (CUSTOM)', value: 'CUSTOM_PROCESSING' },
  { label: '已有数据时报错 (ERROR)', value: 'ERROR_WHEN_DATA_EXISTS' }
];

export const writeModeOptions = [
  { label: '追加写入 (APPEND)', value: 'APPEND' },
  { label: '覆盖写入 (OVERWRITE)', value: 'OVERWRITE' },
  { label: 'UPSERT', value: 'UPSERT' }
];
