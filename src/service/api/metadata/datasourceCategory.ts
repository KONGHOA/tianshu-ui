import { request } from '../../request';

/**
 * 获取分类树
 */
export function fetchGetCategoryTree() {
  return request<any[]>({ url: '/metadata/datasourceCategory/tree', method: 'get' });
}

/**
 * 新增数据源分类
 */
export function fetchAddCategory(data: any) {
  return request({ url: '/metadata/datasourceCategory', method: 'post', data });
}

/**
 * 修改数据源分类
 */
export function fetchEditCategory(data: any) {
  return request({ url: '/metadata/datasourceCategory', method: 'put', data });
}

/**
 * 删除数据源分类
 */
export function fetchDeleteCategory(categoryId: string | number) {
  return request({ url: `/metadata/datasourceCategory/${categoryId}`, method: 'delete' });
}
