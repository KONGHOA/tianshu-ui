import { request } from '../../request';

export function fetchGetTableProfileOverview(tableUuid: string) {
  return request<Api.Metadata.TableProfileOverview>({
    url: '/metadata/profile/query/table/overview',
    method: 'get',
    params: { tableUuid }
  });
}

export function fetchGetTableProfileTrend(tableUuid: string) {
  return request<Api.Metadata.ProfileTrendPoint[]>({
    url: '/metadata/profile/query/table/trend',
    method: 'get',
    params: { tableUuid }
  });
}

export function fetchGetTableProfileAnomalies(tableUuid: string) {
  return request<Api.Metadata.ProfileAnomaly[]>({
    url: '/metadata/profile/query/table/anomalies',
    method: 'get',
    params: { tableUuid }
  });
}

export function fetchGetColumnProfileDetail(columnUuid: string, batchNo?: string) {
  return request<
    Api.Metadata.ColumnStringProfile | Api.Metadata.ColumnNumericProfile | Api.Metadata.ColumnDateTimeProfile
  >({
    url: '/metadata/profile/query/column/detail',
    method: 'get',
    params: { columnUuid, batchNo }
  });
}

export function fetchGetDatabaseProfileOverview(databaseUuid: string) {
  return request<Api.Metadata.DatabaseProfileOverview>({
    url: '/metadata/profile/query/database/overview',
    method: 'get',
    params: { databaseUuid }
  });
}

export function fetchGetDatabaseProfileTrend(databaseUuid: string) {
  return request<Api.Metadata.ProfileTrendPoint[]>({
    url: '/metadata/profile/query/database/trend',
    method: 'get',
    params: { databaseUuid }
  });
}

export function fetchGetDatabaseProfileAnomalies(databaseUuid: string) {
  return request<Api.Metadata.ProfileAnomaly[]>({
    url: '/metadata/profile/query/database/anomalies',
    method: 'get',
    params: { databaseUuid }
  });
}
