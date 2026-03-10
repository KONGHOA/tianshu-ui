/**
 * 元数据管理 API 类型定义
 */
declare namespace Api {
  namespace Metadata {
    /** 数据源连接参数 */
    type ConnParam = {
      host: string;
      port: number;
      database?: string;
      username: string;
      password: string;
      properties?: Record<string, string>;
    };

    /** 数据源 */
    type Datasource = Common.CommonRecord<{
      datasourceId: CommonType.IdType;
      categoryId?: number;
      datasourceName: string;
      datasourceType: string;
      connParams: string;
      /** 连接状态: '0'=未检测 '1'=在线 '2'=离线 */
      status: string;
      /** 最近一次连接检测时间 */
      lastCheckTime?: string;
      sourceOrgCode?: string;
      sourceOrgName?: string;
      sourceDept?: string;
      sourceType?: string;
      sourceSystem?: string;
      contactPerson?: string;
      contactPhone?: string;
      remark: string;
    }>;

    type DatasourceSearchParams = CommonType.RecordNullable<
      Pick<Datasource, 'datasourceName' | 'datasourceType' | 'status' | 'categoryId'> & Api.Common.CommonSearchParams
    >;

    type DatasourceOperateParams = CommonType.RecordNullable<
      Pick<
        Datasource,
        | 'datasourceId'
        | 'categoryId'
        | 'datasourceName'
        | 'datasourceType'
        | 'connParams'
        | 'status'
        | 'sourceOrgCode'
        | 'sourceOrgName'
        | 'sourceDept'
        | 'sourceType'
        | 'sourceSystem'
        | 'contactPerson'
        | 'contactPhone'
        | 'remark'
      >
    >;

    type DatasourceList = Common.PaginatingQueryRecord<Datasource>;

    /** 数据源摘要统计 */
    type DatasourceSummary = {
      databaseCount: number;
      tableCount: number;
      columnCount: number;
      lastSyncTime: string | null;
      recentChangeCount: number;
    };

    /** 数据源统计信息 */
    type DatasourceStats = {
      /** 数据源总数 */
      totalCount: number;
      /** 接入类型数 */
      typeCount: number;
      /** 运行中数量 */
      activeCount: number;
      /** 已停用数量 */
      inactiveCount: number;
    };

    /** 元数据实体实例 */
    type EntityInstance = Common.CommonRecord<{
      instanceId: CommonType.IdType;
      uuid: string;
      entityType: string;
      datasourceId: CommonType.IdType;
      categoryId?: number;
      fullyQualifiedName: string;
      displayName: string;
      description: string;
      properties: string;
      status: string;
    }>;

    /** 标签 */
    type Tag = Common.CommonRecord<{
      tagId: CommonType.IdType;
      uuid: string;
      categoryUuid: string;
      name: string;
    }>;

    type TagSearchParams = CommonType.RecordNullable<
      Pick<Tag, 'name' | 'categoryUuid'> & Api.Common.CommonSearchParams
    >;

    type TagOperateParams = CommonType.RecordNullable<Pick<Tag, 'tagId' | 'name' | 'categoryUuid'>>;

    type TagList = Common.PaginatingQueryRecord<Tag>;

    /** 标签分类 */
    type TagCategory = Common.CommonRecord<{
      categoryId: CommonType.IdType;
      uuid: string;
      name: string;
    }>;

    type TagCategorySearchParams = CommonType.RecordNullable<Pick<TagCategory, 'name'> & Api.Common.CommonSearchParams>;

    type TagCategoryOperateParams = CommonType.RecordNullable<Pick<TagCategory, 'categoryId' | 'name'>>;

    type TagCategoryList = Common.PaginatingQueryRecord<TagCategory>;

    /** 实体特征信息 (Profile) */
    type EntityProfile = Common.CommonRecord<{
      profileId: CommonType.IdType;
      entityUuid: string;
      metricName: string;
      actualValue: string;
      actualValueType: string;
      dataDate: string;
      createTime: string;
    }>;

    /** Schema 变更记录 */
    type SchemaChange = Common.CommonRecord<{
      changeId: CommonType.IdType;
      parentUuid: string;
      entityUuid: string;
      datasourceId: CommonType.IdType;
      entityLevel: 'database' | 'schema' | 'table' | 'column';
      changeType: string;
      databaseName: string;
      tableName: string;
      columnName: string;
      changeBefore: string;
      changeAfter: string;
      createTime: string;
    }>;

    type SchemaChangeSearchParams = CommonType.RecordNullable<
      {
        datasourceId?: number | string;
        entityLevel?: string;
        databaseName?: string;
        schemaName?: string;
        tableName?: string;
      } & Api.Common.CommonSearchParams
    >;

    type SchemaChangeList = Common.PaginatingQueryRecord<SchemaChange>;

    /** 数据源同步调度任务 */
    type SyncTask = Common.CommonRecord<{
      datasourceId: CommonType.IdType;
      jobId?: CommonType.IdType;
      cronExpression: string;
      status: number;
      remark: string;
      createTime: string;
    }>;

    type SyncTaskOperateParams = CommonType.RecordNullable<
      Pick<SyncTask, 'datasourceId' | 'cronExpression' | 'status' | 'remark'>
    >;

    type SyncMode = 'FULL' | 'NEW_TABLES_ONLY' | 'TABLE_SCOPED';

    type TableSyncParams = {
      schemaName: string;
      tableName: string;
    };

    /** 数据源同步执行记录 */
    type SyncRecord = Common.CommonRecord<{
      recordId: CommonType.IdType;
      datasourceId: CommonType.IdType;
      startTime: string;
      endTime: string;
      status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAIL' | 'SKIPPED';
      syncMode?: SyncMode;
      schemaName?: string;
      tableName?: string;
      errorMsg: string;
      createTime: string;
    }>;

    type SyncRecordSearchParams = CommonType.RecordNullable<
      {
        datasourceId: CommonType.IdType;
        status?: string;
      } & Api.Common.CommonSearchParams
    >;

    type SyncRecordList = Common.PaginatingQueryRecord<SyncRecord>;
  }
}
