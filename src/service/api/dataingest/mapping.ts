import { request } from '@/service/request';

/** 预览字段映射 */
export function fetchPreviewIngestMapping(data: Api.Dataingest.IngestJobPreviewMappingParams) {
  return request<Api.Dataingest.IngestMappingPreview>({ url: '/dataingest/job/preview-mapping', method: 'post', data });
}

/** 校验接入作业 */
export function fetchValidateIngestJob(data: Api.Dataingest.IngestJobValidateParams) {
  return request<Api.Dataingest.IngestValidationResult>({ url: '/dataingest/job/validate', method: 'post', data });
}
