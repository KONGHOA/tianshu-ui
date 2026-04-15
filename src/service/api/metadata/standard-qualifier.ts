import { request } from '@/service/request';

export function fetchGetStdQualifierList(params?: Api.Metadata.StdQualifierSearchParams) {
  return request<Api.Metadata.StdQualifierList>({
    url: '/metadata/standard/qualifier/list',
    method: 'get',
    params
  });
}

export function fetchGetStdQualifier(qualifierId: CommonType.IdType) {
  return request<Api.Metadata.StdQualifier>({
    url: `/metadata/standard/qualifier/${qualifierId}`,
    method: 'get'
  });
}

export function fetchGetStdQualifierHistory(bizId: string) {
  return request<Api.Metadata.StdQualifierVersion[]>({
    url: `/metadata/standard/qualifier/history/${bizId}`,
    method: 'get'
  });
}

export function fetchCreateStdQualifier(data: Api.Metadata.StdQualifierOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/qualifier',
    method: 'post',
    data
  });
}

export function fetchUpdateStdQualifier(data: Api.Metadata.StdQualifierOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/qualifier',
    method: 'put',
    data
  });
}

export function fetchSubmitStdQualifier(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/qualifier/submit',
    method: 'post',
    data
  });
}

export function fetchChangeStdQualifier(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/qualifier/change',
    method: 'post',
    data
  });
}

export function fetchAbolishStdQualifier(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/qualifier/abolish',
    method: 'post',
    data
  });
}
