import { request } from '../../request';

/** 查询Schema变更列表 (分页) */
export function fetchGetSchemaChangeList(params?: Api.Metadata.SchemaChangeSearchParams) {
  return request<Api.Metadata.SchemaChangeList>({
    url: '/metadata/schemaChange/list',
    method: 'get',
    params
  });
}

/** 查询实体Schema变更列表 */
export function fetchGetSchemaChangeByEntity(entityUuid: string) {
  return request<Api.Metadata.SchemaChange[]>({
    url: '/metadata/schemaChange/listByEntity',
    method: 'get',
    params: { entityUuid }
  });
}

/** 获取Schema变更详情 */
export function fetchGetSchemaChange(id: string | number) {
  return request<Api.Metadata.SchemaChange>({
    url: `/metadata/schemaChange/${id}`,
    method: 'get'
  });
}
