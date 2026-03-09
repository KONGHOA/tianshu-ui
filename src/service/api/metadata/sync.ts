import { request } from '@/service/request';

/** 获取数据源同步任务配置 */
export function fetchGetSyncSchedule(datasourceId: CommonType.IdType) {
  return request<Api.Metadata.SyncTask>({ url: `/metadata/sync/schedule/${datasourceId}`, method: 'get' });
}

/** 新增或更新同步任务配置 */
export function fetchCreateOrUpdateSyncSchedule(data: Api.Metadata.SyncTaskOperateParams) {
  return request<boolean>({ url: '/metadata/sync/schedule/createOrUpdate', method: 'post', data });
}

/** 立即触发元数据同步 */
export function fetchTriggerSyncNow(datasourceId: CommonType.IdType) {
  return request<boolean>({ url: `/metadata/sync/trigger/${datasourceId}`, method: 'post' });
}

/** 获取同步执行记录分页列表 */
export function fetchGetSyncRecordList(params?: Api.Metadata.SyncRecordSearchParams) {
  return request<Api.Metadata.SyncRecordList>({ url: '/metadata/sync/record/page', method: 'get', params });
}
