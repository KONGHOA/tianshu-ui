import { request } from '../../request';

/** 查询标签分类列表 */
export function fetchGetTagCategoryList(params?: Api.Metadata.TagCategorySearchParams) {
  return request<Api.Metadata.TagCategoryList>({
    url: '/metadata/tagCategory/list',
    method: 'get',
    params
  });
}

/** 查询所有标签分类 */
export function fetchGetAllTagCategories(params?: Api.Metadata.TagCategorySearchParams) {
  return request<Api.Metadata.TagCategory[]>({
    url: '/metadata/tagCategory/listAll',
    method: 'get',
    params
  });
}

/** 获取标签分类详情 */
export function fetchGetTagCategory(id: string | number) {
  return request<Api.Metadata.TagCategory>({
    url: `/metadata/tagCategory/${id}`,
    method: 'get'
  });
}

/** 新增标签分类 */
export function fetchAddTagCategory(data: Api.Metadata.TagCategoryOperateParams) {
  return request<any>({
    url: '/metadata/tagCategory',
    method: 'post',
    data
  });
}

/** 修改标签分类 */
export function fetchUpdateTagCategory(data: Api.Metadata.TagCategoryOperateParams) {
  return request<any>({
    url: '/metadata/tagCategory',
    method: 'put',
    data
  });
}

/** 删除标签分类 */
export function fetchDeleteTagCategory(id: string | number | (string | number)[]) {
  return request<any>({
    url: `/metadata/tagCategory/${id}`,
    method: 'delete'
  });
}
