import { request } from '@/service/request';

/** 获取数据源下的数据库列表 */
export function fetchGetDatabases(datasourceId: CommonType.IdType) {
  return request<Api.Metadata.EntityInstance[]>({ url: `/metadata/catalog/databases/${datasourceId}`, method: 'get' });
}

/** 获取数据库下的 Schema 列表（三层架构数据库专用，如 PostgreSQL） */
export function fetchGetSchemas(databaseUuid: string) {
  return request<Api.Metadata.EntityInstance[]>({ url: `/metadata/catalog/schemas/${databaseUuid}`, method: 'get' });
}

/** 获取数据库/Schema 下的表列表 */
export function fetchGetTables(parentUuid: string) {
  return request<Api.Metadata.EntityInstance[]>({ url: `/metadata/catalog/tables/${parentUuid}`, method: 'get' });
}

/** 获取表下的列列表 */
export function fetchGetColumns(tableUuid: string) {
  return request<Api.Metadata.EntityInstance[]>({ url: `/metadata/catalog/columns/${tableUuid}`, method: 'get' });
}

/** 获取实体详情 */
export function fetchGetEntityDetail(uuid: string) {
  return request<Api.Metadata.EntityInstance>({ url: `/metadata/catalog/detail/${uuid}`, method: 'get' });
}

/** 获取支持的数据源类型 */
export function fetchGetSupportedTypes() {
  return request<string[]>({ url: '/metadata/catalog/supportedTypes', method: 'get' });
}
