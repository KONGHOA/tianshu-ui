import { request } from '@/service/request';

export function fetchGetStdDataElementList(params?: Api.Metadata.StdDataElementSearchParams) {
  return request<Api.Metadata.StdDataElementList>({
    url: '/metadata/standard/element/list',
    method: 'get',
    params
  });
}

export function fetchGetStdDataElement(dataElementId: CommonType.IdType) {
  return request<Api.Metadata.StdDataElement>({
    url: `/metadata/standard/element/${dataElementId}`,
    method: 'get'
  });
}

export function fetchGetStdDataElementHistory(bizId: string) {
  return request<Api.Metadata.StdDataElementVersion[]>({
    url: `/metadata/standard/element/history/${bizId}`,
    method: 'get'
  });
}

export function fetchCreateStdDataElement(data: Api.Metadata.StdDataElementOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/element',
    method: 'post',
    data
  });
}

export function fetchUpdateStdDataElement(data: Api.Metadata.StdDataElementOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/element',
    method: 'put',
    data
  });
}

export function fetchSubmitStdDataElement(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/element/submit',
    method: 'post',
    data
  });
}

export function fetchChangeStdDataElement(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/element/change',
    method: 'post',
    data
  });
}

export function fetchAbolishStdDataElement(data: Api.Metadata.StdSubmitParams) {
  return request<boolean>({
    url: '/metadata/standard/element/abolish',
    method: 'post',
    data
  });
}
