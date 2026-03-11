import { request } from '../../request';

export interface ProfileTaskSearchParams extends Api.Common.CommonSearchParams {
  scopeType?: 'database' | 'table';
  entityUuid?: string;
  enabled?: number;
  taskName?: string;
}

export interface ProfileTaskOperateParams {
  taskId?: CommonType.IdType;
  taskName: string;
  scopeType: 'database' | 'table';
  entityUuid: string;
  datasourceId?: CommonType.IdType;
  selectAllColumns?: number;
  selectedColumns?: string[];
  rowFilterSql?: string;
  enabled?: number;
  cronExpression?: string;
  remark?: string;
}

export function fetchGetProfileTaskList(params?: ProfileTaskSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Metadata.ProfileTask>>({
    url: '/metadata/profile/task/list',
    method: 'get',
    params
  });
}

export function fetchCreateTableProfileTask(data: ProfileTaskOperateParams) {
  return request<CommonType.IdType>({
    url: '/metadata/profile/task/table',
    method: 'post',
    data
  });
}

export function fetchCreateDatabaseProfileTask(data: ProfileTaskOperateParams) {
  return request<CommonType.IdType>({
    url: '/metadata/profile/task/database',
    method: 'post',
    data
  });
}

export function fetchUpdateProfileTask(data: ProfileTaskOperateParams) {
  return request<null>({
    url: '/metadata/profile/task',
    method: 'put',
    data
  });
}

export function fetchExecuteProfileTask(taskId: CommonType.IdType) {
  return request<CommonType.IdType>({
    url: `/metadata/profile/task/${taskId}/execute`,
    method: 'post'
  });
}

export function fetchEnableProfileTask(taskId: CommonType.IdType) {
  return request<null>({
    url: `/metadata/profile/task/${taskId}/enable`,
    method: 'post'
  });
}

export function fetchDisableProfileTask(taskId: CommonType.IdType) {
  return request<null>({
    url: `/metadata/profile/task/${taskId}/disable`,
    method: 'post'
  });
}
