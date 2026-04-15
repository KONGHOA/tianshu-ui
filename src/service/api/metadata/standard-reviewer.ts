import { request } from '@/service/request';

export function fetchGetStdReviewerConfigList(params?: Api.Metadata.StdReviewerConfigSearchParams) {
  return request<Api.Metadata.StdReviewerConfigList>({
    url: '/metadata/standard/reviewer/list',
    method: 'get',
    params
  });
}

export function fetchGetStdReviewerConfig(reviewerConfigId: CommonType.IdType) {
  return request<Api.Metadata.StdReviewerConfig>({
    url: `/metadata/standard/reviewer/${reviewerConfigId}`,
    method: 'get'
  });
}

export function fetchCreateStdReviewerConfig(data: Api.Metadata.StdReviewerConfigOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/reviewer',
    method: 'post',
    data
  });
}

export function fetchUpdateStdReviewerConfig(data: Api.Metadata.StdReviewerConfigOperateParams) {
  return request<boolean>({
    url: '/metadata/standard/reviewer',
    method: 'put',
    data
  });
}

export function fetchDeleteStdReviewerConfig(reviewerConfigId: CommonType.IdType) {
  return request<boolean>({
    url: `/metadata/standard/reviewer/${reviewerConfigId}`,
    method: 'delete'
  });
}
