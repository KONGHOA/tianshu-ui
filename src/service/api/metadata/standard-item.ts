import { request } from '@/service/request';

/** 获取数据项分页列表 */
export function fetchGetStdDataItemList(params?: Api.Metadata.StdDataItemSearchParams) {
  return request<Api.Metadata.StdDataItemList>({
    url: '/metadata/standard/item/list',
    method: 'get',
    params
  });
}

/** 获取数据项详情 */
export function fetchGetStdDataItem(itemId: CommonType.IdType) {
  return request<Api.Metadata.StdDataItem>({
    url: `/metadata/standard/item/${itemId}`,
    method: 'get'
  });
}

/** 预览数据项名称和标识符 */
export function fetchPreviewStdDataItem(data: Api.Metadata.StdDataItemPreviewParams) {
  return request<Api.Metadata.StdDataItemPreview>({
    url: '/metadata/standard/item/preview',
    method: 'post',
    data
  });
}

/** 新增数据项 */
export function fetchCreateStdDataItem(data: Api.Metadata.StdDataItemOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/item',
    method: 'post',
    data
  });
}

/** 修改数据项 */
export function fetchUpdateStdDataItem(data: Api.Metadata.StdDataItemOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/item',
    method: 'put',
    data
  });
}

/** 删除数据项 */
export function fetchDeleteStdDataItem(itemIds: CommonType.IdType[]) {
  return request<boolean>({
    url: `/metadata/standard/item/${itemIds.join(',')}`,
    method: 'delete'
  });
}
