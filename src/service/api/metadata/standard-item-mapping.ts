import { request } from '@/service/request';

/** 获取字段映射分页列表 */
export function fetchGetStdDataItemMappingList(params?: Api.Metadata.StdDataItemMappingSearchParams) {
  return request<Api.Metadata.StdDataItemMappingList>({
    url: '/metadata/standard/item/mapping/list',
    method: 'get',
    params
  });
}

/** 获取字段映射详情 */
export function fetchGetStdDataItemMapping(mappingId: CommonType.IdType) {
  return request<Api.Metadata.StdDataItemMapping>({
    url: `/metadata/standard/item/mapping/${mappingId}`,
    method: 'get'
  });
}

/** 获取映射推荐 */
export function fetchRecommendStdDataItemMapping(data: Api.Metadata.StdDataItemMappingRecommendParams) {
  return request<Api.Metadata.StdMappingRecommend>({
    url: '/metadata/standard/item/mapping/recommend',
    method: 'post',
    data
  });
}

/** 新增字段映射 */
export function fetchCreateStdDataItemMapping(data: Api.Metadata.StdDataItemMappingOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/item/mapping',
    method: 'post',
    data
  });
}

/** 修改字段映射 */
export function fetchUpdateStdDataItemMapping(data: Api.Metadata.StdDataItemMappingOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/item/mapping',
    method: 'put',
    data
  });
}

/** 删除字段映射 */
export function fetchDeleteStdDataItemMapping(mappingIds: CommonType.IdType[]) {
  return request<boolean>({
    url: `/metadata/standard/item/mapping/${mappingIds.join(',')}`,
    method: 'delete'
  });
}
