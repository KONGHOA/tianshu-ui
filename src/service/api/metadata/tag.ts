import { request } from '../../request';

/** 查询标签列表 */
export function fetchGetTagList(params?: Api.Metadata.TagSearchParams) {
  return request<Api.Metadata.TagList>({
    url: '/metadata/tag/list',
    method: 'get',
    params
  });
}

/** 查询所有标签 */
export function fetchGetAllTags(params?: Api.Metadata.TagSearchParams) {
  return request<Api.Metadata.Tag[]>({
    url: '/metadata/tag/listAll',
    method: 'get',
    params
  });
}

/** 获取标签详情 */
export function fetchGetTag(id: string | number) {
  return request<Api.Metadata.Tag>({
    url: `/metadata/tag/${id}`,
    method: 'get'
  });
}

/** 新增标签 */
export function fetchAddTag(data: Api.Metadata.TagOperateParams) {
  return request<any>({
    url: '/metadata/tag',
    method: 'post',
    data
  });
}

/** 修改标签 */
export function fetchUpdateTag(data: Api.Metadata.TagOperateParams) {
  return request<any>({
    url: '/metadata/tag',
    method: 'put',
    data
  });
}

/** 删除标签 */
export function fetchDeleteTag(id: string | number | (string | number)[]) {
  return request<any>({
    url: `/metadata/tag/${id}`,
    method: 'delete'
  });
}
