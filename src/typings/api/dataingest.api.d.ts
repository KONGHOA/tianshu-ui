/**
 * 数据接入管理 API 类型定义
 */
declare namespace Api {
  namespace Dataingest {
    type SyncMode = 'SINGLE' | 'WHOLE_DATABASE';

    type IngestJobTableConfig = {
      tableConfigId?: CommonType.IdType;
      jobId?: CommonType.IdType;
      taskId?: CommonType.IdType;
      sourceTableName: string;
      targetTableName?: string | null;
      mappingMode?: 'AUTO' | 'CUSTOM';
      whereCondition?: string | null;
      isEnable?: string;
      sortNum?: number;
    };

    /** 接入作业 */
    type IngestJob = Common.CommonRecord<{
      jobId: CommonType.IdType;
      jobName: string;
      jobType: 'BATCH' | 'STREAM' | 'CDC';
      syncMode?: SyncMode;
      srcDatasourceId?: CommonType.IdType;
      sinkDatasourceId?: CommonType.IdType;
      scheduleType?: string;
      scheduleExpression?: string;
      parallelism?: number;
      checkpointInterval?: number;
      jobVersion?: number;
      maxRetryTimes?: number;
      alertEmail?: string;
      status: string;
      remark?: string;
      editorMode?: string;
    }>;

    /** DAG edge (connection line between nodes) */
    type IngestJobLine = {
      lineId?: CommonType.IdType;
      jobId?: CommonType.IdType;
      sourceNodeCode: string;
      targetNodeCode: string;
      sortNum?: number;
    };

    type IngestJobSearchParams = CommonType.RecordNullable<
      Pick<IngestJob, 'jobName' | 'jobType' | 'status' | 'srcDatasourceId' | 'sinkDatasourceId'> &
        Api.Common.CommonSearchParams
    >;

    type IngestJobOperateParams = CommonType.RecordNullable<
      Pick<
        IngestJob,
        | 'jobId'
        | 'jobName'
        | 'jobType'
        | 'syncMode'
        | 'srcDatasourceId'
        | 'sinkDatasourceId'
        | 'scheduleType'
        | 'scheduleExpression'
        | 'parallelism'
        | 'checkpointInterval'
        | 'maxRetryTimes'
        | 'alertEmail'
        | 'status'
        | 'remark'
        | 'editorMode'
      >
    >;

    type IngestJobList = Common.PaginatingQueryRecord<IngestJob>;

    /** 接入作业任务节点 */
    type IngestJobTask = {
      taskId?: CommonType.IdType;
      jobId?: CommonType.IdType;
      nodeCode?: string;
      nodeName?: string;
      taskType: 'SOURCE' | 'SINK' | 'TRANSFORM';
      pluginType: string;
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName?: string;
      tablePattern?: string;
      tableIncludePattern?: string;
      tableExcludePattern?: string;
      whereCondition?: string;
      readMode?: 'FULL' | 'INCREMENTAL';
      incrementalColumn?: string;
      incrementalLastValue?: string;
      fieldList?: string[];
      writeMode?: string;
      primaryKeys?: string[];
      extraConfig?: string;
      nodeConfig?: string;
      inputSchemaJson?: string;
      outputSchemaJson?: string;
      sortNum?: number;
      posX?: number;
      posY?: number;
    };

    /** 创建/更新作业请求（含任务节点） */
    type IngestJobWithTasksParams = {
      job: IngestJobOperateParams;
      tasks: IngestJobTask[];
      lines?: IngestJobLine[];
      fieldMappings?: IngestFieldMappingOperate[];
      tableConfigs?: IngestJobTableConfig[];
    };

    /** 作业执行实例 */
    type IngestJobInstance = Common.CommonRecord<{
      instanceId: CommonType.IdType;
      jobId: CommonType.IdType;
      jobName?: string;
      jobVersion?: number;
      engineType?: string;
      engineJobId?: string;
      jobStatus: 'SUBMITTED' | 'RUNNING' | 'SUCCEED' | 'FAILED' | 'CANCELLED' | 'PAUSED' | 'UNKNOWN';
      triggerType?: string;
      startTime?: string;
      endTime?: string;
      readRowCount?: number;
      writeRowCount?: number;
      metricsJson?: string;
      jobConfig?: string;
      configSnapshot?: string;
      mappingSnapshot?: string;
      errorMsg?: string;
      errorNodeCode?: string;
      retryCount?: number;
    }>;

    type IngestFieldMeta = {
      fieldName: string;
      normalizedFieldName?: string;
      dataType: string;
      nullable?: boolean;
      primaryKey?: boolean;
      comment?: string;
      sortNum?: number;
    };

    type IngestMappingPreviewItem = {
      sourceField?: string;
      targetField?: string;
      mappingType: 'DIRECT' | 'CONSTANT' | 'DICT' | 'EXPRESSION';
      sourceDataType?: string;
      targetDataType?: string;
      compatible?: boolean;
      compatibilityLevel?: 'EXACT' | 'SAFE_CAST' | 'RISKY_CAST' | 'INCOMPATIBLE';
      message?: string;
      matchScore?: number;
      autoMatched?: boolean;
    };

    type IngestMappingPreview = {
      sourceFields: IngestFieldMeta[];
      targetFields: IngestFieldMeta[];
      mappings: IngestMappingPreviewItem[];
      unmatchedSourceFields: string[];
      unmatchedTargetFields: string[];
      requiredTargetFields: string[];
      primaryKeyFields: string[];
      warnings: string[];
    };

    type IngestFieldMappingOperate = {
      sourceNodeCode?: string;
      targetNodeCode?: string;
      sourceField?: string;
      sourceDataType?: string;
      targetField: string;
      targetDataType?: string;
      mappingType?: 'DIRECT' | 'CONSTANT' | 'DICT' | 'EXPRESSION';
      transformExpr?: string;
      dictType?: string;
      constantValue?: string;
      compatibilityLevel?: 'EXACT' | 'SAFE_CAST' | 'RISKY_CAST' | 'INCOMPATIBLE';
      message?: string;
      autoMatched?: boolean;
      isEnable?: string;
      sortNum?: number;
    };

    type IngestJobSourceOperate = {
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName?: string;
      whereCondition?: string;
      readMode?: 'FULL' | 'INCREMENTAL';
      incrementalColumn?: string;
      fieldList?: string[];
    };

    type IngestJobSinkOperate = {
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName?: string;
      writeMode?: string;
      primaryKeys?: string[];
    };

    type IngestJobPreviewMappingParams = {
      srcDatasourceId: CommonType.IdType;
      srcDatabaseName?: string | null;
      srcSchemaName?: string | null;
      srcTableName: string;
      sinkDatasourceId: CommonType.IdType;
      sinkDatabaseName?: string | null;
      sinkSchemaName?: string | null;
      sinkTableName: string;
    };

    type IngestJobValidateParams = {
      job: IngestJobOperateParams;
      source: IngestJobSourceOperate;
      sink: IngestJobSinkOperate;
      fieldMappings: IngestFieldMappingOperate[];
    };

    type IngestValidationMessage = {
      field: string;
      message: string;
      severity: 'ERROR' | 'WARN';
    };

    type IngestValidationResult = {
      valid: boolean;
      errors: IngestValidationMessage[];
      warnings: IngestValidationMessage[];
    };

    type IngestJobInstanceSearchParams = CommonType.RecordNullable<
      {
        jobId?: string;
        jobStatus?: IngestJobInstance['jobStatus'];
        triggerType?: string;
      } & Api.Common.CommonSearchParams
    >;

    type IngestJobInstanceList = Common.PaginatingQueryRecord<IngestJobInstance>;

    /** 引擎健康状态 */
    type EngineHealth = {
      alive: boolean;
      message?: string;
    };
  }
}
