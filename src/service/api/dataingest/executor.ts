import { request } from '@/service/request';

/** 执行作业 */
export function fetchExecuteJob(jobId: CommonType.IdType) {
  return request<CommonType.IdType>({ url: `/dataingest/executor/execute/${jobId}`, method: 'post' });
}

/** 取消作业实例 */
export function fetchCancelJobInstance(instanceId: CommonType.IdType) {
  return request<boolean>({ url: `/dataingest/executor/cancel/${instanceId}`, method: 'post' });
}

/** 同步实例状态 */
export function fetchSyncInstanceStatus(instanceId: CommonType.IdType) {
  return request<string>({ url: `/dataingest/executor/syncStatus/${instanceId}`, method: 'get' });
}

/** 获取执行实例分页列表 */
export function fetchGetJobInstanceList(params?: Api.Dataingest.IngestJobInstanceSearchParams) {
  return request<Api.Dataingest.IngestJobInstanceList>({
    url: '/dataingest/executor/instances',
    method: 'get',
    params
  });
}

/** 获取执行实例详情 */
export function fetchGetJobInstanceDetail(instanceId: CommonType.IdType) {
  return request<Api.Dataingest.IngestJobInstance>({
    url: `/dataingest/executor/instances/${instanceId}`,
    method: 'get'
  });
}

/** 查询引擎健康状态 */
export function fetchGetEngineHealth() {
  return request<Api.Dataingest.EngineHealth>({ url: '/dataingest/executor/engine/health', method: 'get' });
}
