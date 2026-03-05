import { request } from '../../request';

export interface ProfileSearchParams extends Api.Common.CommonSearchParams {
  entityUuid?: string;
}

/** 查询实体特征信息列表 (分页) */
export function fetchGetProfileList(params?: ProfileSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Metadata.EntityProfile>>({
    url: '/metadata/profile/list',
    method: 'get',
    params
  });
}

/** 查询实体所有特征信息 */
export function fetchGetAllProfiles(entityUuid?: string) {
  return request<Api.Metadata.EntityProfile[]>({
    url: '/metadata/profile/listAll',
    method: 'get',
    params: { entityUuid }
  });
}

/** 获取特征信息详情 */
export function fetchGetProfile(id: string | number) {
  return request<Api.Metadata.EntityProfile>({
    url: `/metadata/profile/${id}`,
    method: 'get'
  });
}

/** 触发表数据概览（异步执行） */
export function fetchTriggerTableProfile(tableUuid: string) {
  return request<null>({
    url: '/metadata/profile/trigger',
    method: 'post',
    params: { tableUuid }
  });
}
