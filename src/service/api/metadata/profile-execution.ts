import { request } from '../../request';

export interface ProfileExecutionSearchParams extends Api.Common.CommonSearchParams {
  taskId?: CommonType.IdType;
  entityUuid?: string;
}

export function fetchGetProfileExecutionList(params?: ProfileExecutionSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Metadata.ProfileExecution>>({
    url: '/metadata/profile/execution/list',
    method: 'get',
    params
  });
}

export function fetchGetProfileExecution(executionId: CommonType.IdType) {
  return request<Api.Metadata.ProfileExecution>({
    url: `/metadata/profile/execution/${executionId}`,
    method: 'get'
  });
}

export function fetchGetProfileExecutionLog(executionId: CommonType.IdType) {
  return request<string>({
    url: `/metadata/profile/execution/${executionId}/log`,
    method: 'get'
  });
}
