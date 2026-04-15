import { request } from '@/service/request';

/** 获取代码集分页列表 */
export function fetchGetStdCodeSetList(params?: Api.Metadata.StdCodeSetSearchParams) {
  return request<Api.Metadata.StdCodeSetList>({
    url: '/metadata/standard/code-set/list',
    method: 'get',
    params
  });
}

/** 获取代码集详情 */
export function fetchGetStdCodeSet(codeSetId: CommonType.IdType) {
  return request<Api.Metadata.StdCodeSet>({
    url: `/metadata/standard/code-set/${codeSetId}`,
    method: 'get'
  });
}

/** 获取代码项列表 */
export function fetchGetStdCodeItems(codeSetId: CommonType.IdType) {
  return request<Api.Metadata.StdCodeItem[]>({
    url: `/metadata/standard/code-set/items/${codeSetId}`,
    method: 'get'
  });
}

/** 新增代码集 */
export function fetchCreateStdCodeSet(data: Api.Metadata.StdCodeSetOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/code-set',
    method: 'post',
    data
  });
}

/** 修改代码集 */
export function fetchUpdateStdCodeSet(data: Api.Metadata.StdCodeSetOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/code-set',
    method: 'put',
    data
  });
}

/** 删除代码集 */
export function fetchDeleteStdCodeSet(codeSetIds: CommonType.IdType[]) {
  return request<boolean>({
    url: `/metadata/standard/code-set/${codeSetIds.join(',')}`,
    method: 'delete'
  });
}

/** 发布代码集 */
export function fetchPublishStdCodeSet(codeSetId: CommonType.IdType) {
  return request<boolean>({
    url: `/metadata/standard/code-set/publish/${codeSetId}`,
    method: 'post'
  });
}

/** 新增代码项 */
export function fetchCreateStdCodeItem(data: Api.Metadata.StdCodeItemOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/code-set/item',
    method: 'post',
    data
  });
}

/** 修改代码项 */
export function fetchUpdateStdCodeItem(data: Api.Metadata.StdCodeItemOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/code-set/item',
    method: 'put',
    data
  });
}

/** 删除代码项 */
export function fetchDeleteStdCodeItem(codeItemIds: CommonType.IdType[]) {
  return request<boolean>({
    url: `/metadata/standard/code-set/item/${codeItemIds.join(',')}`,
    method: 'delete'
  });
}
