/**
 * 数据接入管理 API 类型定义
 */
declare namespace Api {
  namespace Dataingest {
    /** 接入作业 */
    type IngestJob = Common.CommonRecord<{
      jobId: CommonType.IdType;
      jobName: string;
      jobType: 'BATCH' | 'STREAM' | 'CDC';
      srcDatasourceId?: CommonType.IdType;
      sinkDatasourceId?: CommonType.IdType;
      scheduleType?: string;
      scheduleExpression?: string;
      parallelism?: number;
      checkpointInterval?: number;
      maxRetryTimes?: number;
      alertEmail?: string;
      status: string;
      remark?: string;
    }>;

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
      >
    >;

    type IngestJobList = Common.PaginatingQueryRecord<IngestJob>;

    /** 接入作业任务节点 */
    type IngestJobTask = {
      taskId?: CommonType.IdType;
      jobId?: CommonType.IdType;
      taskType: 'SOURCE' | 'SINK' | 'TRANSFORM';
      pluginType: string;
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName?: string;
      tablePattern?: string;
      whereCondition?: string;
      partitionColumn?: string;
      partitionLowerBound?: string;
      partitionUpperBound?: string;
      partitionNum?: number;
      incrementalColumn?: string;
      incrementalLastValue?: string;
      fieldList?: string[];
      writeMode?: string;
      primaryKeys?: string[];
      startupMode?: string;
      startupTimestamp?: number;
      serverIdRange?: string;
      extraConfig?: string;
      sortNum?: number;
    };

    /** 创建/更新作业请求（含任务节点） */
    type IngestJobWithTasksParams = {
      job: IngestJobOperateParams;
      tasks: IngestJobTask[];
    };

    /** 作业执行实例 */
    type IngestJobInstance = Common.CommonRecord<{
      instanceId: CommonType.IdType;
      jobId: CommonType.IdType;
      jobName?: string;
      engineType?: string;
      engineJobId?: string;
      jobStatus: 'SUBMITTED' | 'RUNNING' | 'SUCCEED' | 'FAILED' | 'CANCELLED' | 'PAUSED' | 'UNKNOWN';
      triggerType?: string;
      startTime?: string;
      endTime?: string;
      readRowCount?: number;
      writeRowCount?: number;
      metricsJson?: string;
      retryCount?: number;
    }>;

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
