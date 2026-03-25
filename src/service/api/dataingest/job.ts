import { request } from '@/service/request';

/** 获取接入作业分页列表 */
export function fetchGetIngestJobList(params?: Api.Dataingest.IngestJobSearchParams) {
  return request<Api.Dataingest.IngestJobList>({ url: '/dataingest/job/list', method: 'get', params });
}

/** 获取接入作业详情（含任务节点） */
export function fetchGetIngestJob(jobId: CommonType.IdType) {
  return request<Api.Dataingest.IngestJob>({ url: `/dataingest/job/${jobId}`, method: 'get' });
}

/** 获取作业下的任务节点列表 */
export function fetchGetIngestJobTasks(jobId: CommonType.IdType) {
  return request<Api.Dataingest.IngestJobTask[]>({ url: `/dataingest/job/${jobId}/tasks`, method: 'get' });
}

/** Get DAG lines for a job */
export function fetchGetIngestJobLines(jobId: CommonType.IdType) {
  return request<Api.Dataingest.IngestJobLine[]>({ url: `/dataingest/job/${jobId}/lines`, method: 'get' });
}

/** 获取作业下的字段映射列表 */
export function fetchGetIngestJobMappings(jobId: CommonType.IdType) {
  return request<Api.Dataingest.IngestFieldMappingOperate[]>({
    url: `/dataingest/job/${jobId}/mappings`,
    method: 'get'
  });
}

/** 新增接入作业 */
export function fetchCreateIngestJob(data: Api.Dataingest.IngestJobWithTasksParams) {
  return request<CommonType.IdType>({ url: '/dataingest/job', method: 'post', data });
}

/** 修改接入作业 */
export function fetchUpdateIngestJob(data: Api.Dataingest.IngestJobWithTasksParams) {
  return request<boolean>({ url: '/dataingest/job', method: 'put', data });
}

/** 删除接入作业 */
export function fetchBatchDeleteIngestJob(jobIds: CommonType.IdType[]) {
  return request<boolean>({ url: `/dataingest/job/${jobIds.join(',')}`, method: 'delete' });
}

/** 获取作业的多表配置 */
export function fetchGetIngestJobTableConfigs(jobId: CommonType.IdType) {
  return request<Api.Dataingest.IngestJobTableConfig[]>({
    url: `/dataingest/job/${jobId}/tableConfigs`,
    method: 'get'
  });
}

/** 整库同步表发现 */
export function fetchDiscoverTables(params: {
  datasourceId: CommonType.IdType;
  databaseName?: string;
  schemaName?: string;
  includePattern?: string;
  excludePattern?: string;
}) {
  return request<string[]>({ url: '/dataingest/job/discoverTables', method: 'post', data: params });
}

/** 获取 Sink 能力 */
export function fetchGetIngestSinkCapabilities(datasourceId: CommonType.IdType, pluginType: string) {
  return request<Api.Dataingest.IngestSinkCapability>({
    url: '/dataingest/sink/capabilities',
    method: 'get',
    params: { datasourceId, pluginType }
  });
}
