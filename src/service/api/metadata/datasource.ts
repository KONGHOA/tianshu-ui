import { request } from '@/service/request';

/** 获取数据源分页列表 */
export function fetchGetDatasourceList(params?: Api.Metadata.DatasourceSearchParams) {
  return request<Api.Metadata.DatasourceList>({ url: '/metadata/datasource/list', method: 'get', params });
}

/** 获取数据源详情 */
export function fetchGetDatasource(datasourceId: CommonType.IdType) {
  return request<Api.Metadata.Datasource>({ url: `/metadata/datasource/${datasourceId}`, method: 'get' });
}

/** 新增数据源 */
export function fetchCreateDatasource(data: Api.Metadata.DatasourceOperateParams) {
  return request<boolean>({ url: '/metadata/datasource', method: 'post', data });
}

/** 修改数据源 */
export function fetchUpdateDatasource(data: Api.Metadata.DatasourceOperateParams) {
  return request<boolean>({ url: '/metadata/datasource', method: 'put', data });
}

/** 删除数据源 */
export function fetchBatchDeleteDatasource(datasourceIds: CommonType.IdType[]) {
  return request<boolean>({ url: `/metadata/datasource/${datasourceIds.join(',')}`, method: 'delete' });
}

/** 测试已保存数据源连接 */
export function fetchTestConnectionById(datasourceId: CommonType.IdType) {
  return request<boolean>({ url: `/metadata/datasource/testConnection/${datasourceId}`, method: 'get' });
}

/** 测试未保存数据源连接 */
export function fetchTestConnection(data: Api.Metadata.DatasourceOperateParams) {
  return request<boolean>({ url: '/metadata/datasource/testConnection', method: 'post', data });
}

/** 刷新数据源元数据（兼容旧调用，实际提交异步同步任务） */
export function fetchRefreshDatasource(datasourceId: CommonType.IdType) {
  return request<boolean>({ url: `/metadata/sync/trigger/${datasourceId}`, method: 'post' });
}

/** 获取数据源下拉列表 */
export function fetchGetDatasourceSelect() {
  return request<Api.Metadata.Datasource[]>({ url: '/metadata/datasource/selectList', method: 'get' });
}

/** 获取数据源统计信息 */
export function fetchGetDatasourceStats() {
  return request<Api.Metadata.DatasourceStats>({ url: '/metadata/datasource/stats', method: 'get' });
}

/** 获取数据源摘要（数据库数、表数、字段数、最近同步时间、近7天变更数） */
export function fetchGetDatasourceSummary(datasourceId: CommonType.IdType) {
  return request<Api.Metadata.DatasourceSummary>({
    url: `/metadata/datasource/summary/${datasourceId}`,
    method: 'get'
  });
}

/** 获取数据源 Schema 列表 */
export function fetchGetDatasourceSchemas(datasourceId: CommonType.IdType) {
  return request<Api.Metadata.DatasourceSchemaMeta[]>({
    url: `/metadata/datasource/${datasourceId}/schemas`,
    method: 'get'
  });
}

/** 获取数据源表列表 */
export function fetchGetDatasourceTables(datasourceId: CommonType.IdType, schemaName?: string | null) {
  return request<Api.Metadata.DatasourceTableMeta[]>({
    url: `/metadata/datasource/${datasourceId}/tables`,
    method: 'get',
    params: { schemaName: schemaName ?? undefined }
  });
}

/** 获取数据源字段列表 */
export function fetchGetDatasourceColumns(
  datasourceId: CommonType.IdType,
  params: { schemaName?: string | null; tableName: string }
) {
  return request<Api.Metadata.DatasourceColumnMeta[]>({
    url: `/metadata/datasource/${datasourceId}/columns`,
    method: 'get',
    params: {
      schemaName: params.schemaName ?? undefined,
      tableName: params.tableName
    }
  });
}
