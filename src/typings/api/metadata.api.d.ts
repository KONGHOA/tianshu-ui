/**
 * 元数据管理 API 类型定义
 */
declare namespace Api {
  namespace Metadata {
    /** 数据源连接参数 */
    type ConnParam = {
      connectMode?: 'default' | 'url_only';
      connectType?: 'sid' | 'service_name';
      jdbcUrl?: string;
      host?: string;
      port?: number;
      database?: string;
      schema?: string;
      username?: string;
      password?: string;
      properties?: Record<string, string>;
    };

    type FilterPattern = {
      includes?: string[];
      excludes?: string[];
    };

    type DatasourceFilterConfig = {
      schemaFilterPattern?: FilterPattern;
      tableFilterPattern?: FilterPattern;
    };

    /** 数据源 */
    type Datasource = Common.CommonRecord<{
      datasourceId: CommonType.IdType;
      categoryId?: number;
      datasourceName: string;
      datasourceType: string;
      connParams: string;
      filterConfig?: string;
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
        | 'filterConfig'
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

    type DatasourceSchemaMeta = {
      schemaName: string;
      schemaLabel: string;
    };

    type DatasourceTableMeta = {
      tableName: string;
      tableType?: string;
      comment?: string;
    };

    type DatasourceColumnMeta = {
      columnName: string;
      dataType: string;
      nullable?: boolean;
      primaryKey?: boolean;
      comment?: string;
      sortNum?: number;
    };

    type StdQualifierRef = {
      qualifierId: CommonType.IdType;
      qualifierName: string;
      qualifierSymbol: string;
      sortNum?: number | null;
    };

    type StdDataItem = Common.CommonRecord<{
      itemId: CommonType.IdType;
      itemName: string;
      itemIdentifier: string;
      dataElementId: CommonType.IdType;
      qualifierSignature?: string;
      sourceType?: string;
      mappingStatus?: string;
      referenceCount?: number;
      baseItemType?: string;
      standardCategory?: string;
      standardNumber?: string;
      standardName?: string;
      standardStatus?: string;
      description?: string;
      dataElementName?: string;
      dataElementSymbol?: string;
      qualifiers?: StdQualifierRef[];
      remark?: string;
    }>;

    type StdDataItemSearchParams = CommonType.RecordNullable<
      Pick<StdDataItem, 'itemName' | 'itemIdentifier' | 'dataElementId' | 'sourceType' | 'mappingStatus'> &
        Api.Common.CommonSearchParams
    >;

    type StdDataItemOperateParams = CommonType.RecordNullable<
      Pick<
        StdDataItem,
        | 'itemId'
        | 'itemName'
        | 'itemIdentifier'
        | 'dataElementId'
        | 'description'
        | 'baseItemType'
        | 'sourceType'
        | 'mappingStatus'
        | 'standardCategory'
        | 'standardNumber'
        | 'standardName'
        | 'standardStatus'
        | 'remark'
        | 'dataElementName'
        | 'dataElementSymbol'
        | 'qualifiers'
      >
    >;

    type StdDataItemPreviewParams = {
      dataElementId: CommonType.IdType;
      dataElementName: string;
      dataElementSymbol: string;
      qualifiers?: StdQualifierRef[];
    };

    type StdDataItemPreview = {
      itemName: string;
      itemIdentifier: string;
      qualifierSignature: string;
    };

    type StdDataItemList = Common.PaginatingQueryRecord<StdDataItem>;

    type StdDataItemMapping = Common.CommonRecord<{
      mappingId: CommonType.IdType;
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName: string;
      columnName: string;
      columnComment?: string;
      entityUuid?: string;
      attributeUuid?: string;
      itemId: CommonType.IdType;
      dataElementId: CommonType.IdType;
      mappingBasis?: string;
      mappingConfidence?: number;
      status?: string;
      mappedTime?: string;
    }>;

    type StdDataItemMappingSearchParams = CommonType.RecordNullable<
      Pick<StdDataItemMapping, 'datasourceId' | 'tableName' | 'columnName' | 'itemId' | 'status'> &
        Api.Common.CommonSearchParams
    >;

    type StdDataItemMappingOperateParams = CommonType.RecordNullable<
      Pick<
        StdDataItemMapping,
        | 'mappingId'
        | 'datasourceId'
        | 'databaseName'
        | 'schemaName'
        | 'tableName'
        | 'columnName'
        | 'columnComment'
        | 'entityUuid'
        | 'attributeUuid'
        | 'itemId'
        | 'dataElementId'
        | 'mappingBasis'
        | 'mappingConfidence'
        | 'status'
      >
    >;

    type StdDataItemMappingRecommendParams = {
      datasourceId?: CommonType.IdType;
      databaseName?: string;
      schemaName?: string;
      tableName: string;
      columnName: string;
      columnComment?: string;
    };

    type StdMappingRecommend = {
      itemId?: CommonType.IdType;
      dataElementId?: CommonType.IdType;
      itemName?: string;
      itemIdentifier?: string;
      mappingBasis?: string;
      mappingConfidence?: number;
    };

    type StdDataItemMappingList = Common.PaginatingQueryRecord<StdDataItemMapping>;

    type StdCodeItem = Common.CommonRecord<{
      codeItemId: CommonType.IdType;
      codeSetId: CommonType.IdType;
      codeValue: string;
      codeName: string;
      description?: string;
      sortNum?: number;
      enabledFlag?: string;
    }>;

    type StdCodeSet = Common.CommonRecord<{
      codeSetId: CommonType.IdType;
      codeSetCode: string;
      codeSetName: string;
      description?: string;
      version?: string;
      source?: string;
      codeCount?: number;
      publishStatus?: string;
      standardCategory?: string;
      standardNumber?: string;
      standardName?: string;
      standardStatus?: string;
      remark?: string;
      items?: StdCodeItem[];
    }>;

    type StdCodeSetSearchParams = CommonType.RecordNullable<
      Pick<StdCodeSet, 'codeSetCode' | 'codeSetName' | 'publishStatus'> & Api.Common.CommonSearchParams
    >;

    type StdCodeSetOperateParams = CommonType.RecordNullable<
      Pick<
        StdCodeSet,
        | 'codeSetId'
        | 'codeSetCode'
        | 'codeSetName'
        | 'description'
        | 'version'
        | 'source'
        | 'publishStatus'
        | 'standardCategory'
        | 'standardNumber'
        | 'standardName'
        | 'standardStatus'
        | 'remark'
        | 'items'
      >
    >;

    type StdCodeItemOperateParams = CommonType.RecordNullable<
      Pick<
        StdCodeItem,
        'codeItemId' | 'codeSetId' | 'codeValue' | 'codeName' | 'description' | 'sortNum' | 'enabledFlag'
      >
    >;

    type StdCodeSetList = Common.PaginatingQueryRecord<StdCodeSet>;

    type StdDataElement = Common.CommonRecord<{
      dataElementId: CommonType.IdType;
      bizId: string;
      dataElementType?: string;
      internalIdentifier: string;
      chineseName: string;
      englishName?: string;
      pinyinName?: string;
      keywordFieldName?: string;
      publishedName?: string;
      language?: string;
      symbol?: string;
      context?: string;
      version?: string;
      synonym?: string;
      definition?: string;
      objectTerm?: string;
      featureTerm?: string;
      applicationConstraint?: string;
      applicationContext?: string;
      classificationScheme?: string;
      classificationValue?: string;
      relationship?: string;
      relationshipDescription?: string;
      representationTerm?: string;
      dataType?: string;
      dataFormat?: string;
      normalizedIdentifier?: string;
      codeSetId?: CommonType.IdType;
      codeSetCode?: string;
      codeSetName?: string;
      valueRange?: string;
      measurementUnit?: string;
      fusionUnitType?: string;
      fusionUnitCode?: string;
      lifecycleStatus?: string;
      submissionOrg?: string;
      registrationOrg?: string;
      responsiblePerson?: string;
      approvalDate?: string;
      standardCategory?: string;
      standardNumber?: string;
      standardName?: string;
      standardStatus?: string;
      description?: string;
      remark?: string;
    }>;

    type StdDataElementSearchParams = CommonType.RecordNullable<
      Pick<StdDataElement, 'chineseName' | 'internalIdentifier' | 'symbol' | 'lifecycleStatus' | 'standardCategory'> &
        Api.Common.CommonSearchParams
    >;

    type StdDataElementOperateParams = CommonType.RecordNullable<
      Pick<
        StdDataElement,
        | 'dataElementId'
        | 'bizId'
        | 'dataElementType'
        | 'internalIdentifier'
        | 'chineseName'
        | 'englishName'
        | 'pinyinName'
        | 'keywordFieldName'
        | 'publishedName'
        | 'language'
        | 'symbol'
        | 'context'
        | 'version'
        | 'synonym'
        | 'definition'
        | 'objectTerm'
        | 'featureTerm'
        | 'applicationConstraint'
        | 'applicationContext'
        | 'classificationScheme'
        | 'classificationValue'
        | 'relationship'
        | 'relationshipDescription'
        | 'representationTerm'
        | 'dataType'
        | 'dataFormat'
        | 'normalizedIdentifier'
        | 'codeSetId'
        | 'codeSetCode'
        | 'codeSetName'
        | 'valueRange'
        | 'measurementUnit'
        | 'fusionUnitType'
        | 'fusionUnitCode'
        | 'lifecycleStatus'
        | 'submissionOrg'
        | 'registrationOrg'
        | 'responsiblePerson'
        | 'approvalDate'
        | 'standardCategory'
        | 'standardNumber'
        | 'standardName'
        | 'standardStatus'
        | 'description'
        | 'remark'
      >
    >;

    type StdDataElementVersion = Common.CommonRecord<{
      versionId: CommonType.IdType;
      bizId: string;
      versionNo: string;
      actionType: string;
      chineseName: string;
      symbol: string;
      lifecycleStatus: string;
      isCurrent: string;
    }>;

    type StdDataElementList = Common.PaginatingQueryRecord<StdDataElement>;

    type StdSubmitParams = CommonType.RecordNullable<{
      id: CommonType.IdType;
      bizId: string;
      flowCode: string;
      submitReason?: string;
    }>;

    type StdReviewerConfig = Common.CommonRecord<{
      reviewerConfigId: CommonType.IdType;
      businessType: string;
      actionType: string;
      flowCode: string;
      stageCode: string;
      stageName: string;
      roleId?: CommonType.IdType;
      roleName?: string;
      userId?: CommonType.IdType;
      userName?: string;
      sortNum?: number;
      enabledFlag?: string;
      remark?: string;
    }>;

    type StdReviewerConfigSearchParams = CommonType.RecordNullable<
      Pick<StdReviewerConfig, 'businessType' | 'actionType' | 'flowCode' | 'stageCode' | 'enabledFlag'> &
        Api.Common.CommonSearchParams
    >;

    type StdReviewerConfigOperateParams = CommonType.RecordNullable<
      Pick<
        StdReviewerConfig,
        | 'reviewerConfigId'
        | 'businessType'
        | 'actionType'
        | 'flowCode'
        | 'stageCode'
        | 'stageName'
        | 'roleId'
        | 'roleName'
        | 'userId'
        | 'userName'
        | 'sortNum'
        | 'enabledFlag'
        | 'remark'
      >
    >;

    type StdReviewerConfigList = Common.PaginatingQueryRecord<StdReviewerConfig>;

    type StdQualifier = Common.CommonRecord<{
      qualifierId: CommonType.IdType;
      bizId: string;
      internalIdentifier: string;
      qualifierName: string;
      englishName?: string;
      pinyinName?: string;
      qualifierSymbol?: string;
      description?: string;
      context?: string;
      version?: string;
      lifecycleStatus?: string;
      submissionOrg?: string;
      registrationOrg?: string;
      responsiblePerson?: string;
      approvalDate?: string;
      standardCategory?: string;
      standardNumber?: string;
      standardName?: string;
      standardStatus?: string;
      remark?: string;
    }>;

    type StdQualifierSearchParams = CommonType.RecordNullable<
      Pick<
        StdQualifier,
        'qualifierName' | 'internalIdentifier' | 'qualifierSymbol' | 'lifecycleStatus' | 'standardCategory'
      > &
        Api.Common.CommonSearchParams
    >;

    type StdQualifierOperateParams = CommonType.RecordNullable<
      Pick<
        StdQualifier,
        | 'qualifierId'
        | 'bizId'
        | 'internalIdentifier'
        | 'qualifierName'
        | 'englishName'
        | 'pinyinName'
        | 'qualifierSymbol'
        | 'description'
        | 'context'
        | 'version'
        | 'lifecycleStatus'
        | 'submissionOrg'
        | 'registrationOrg'
        | 'responsiblePerson'
        | 'approvalDate'
        | 'standardCategory'
        | 'standardNumber'
        | 'standardName'
        | 'standardStatus'
        | 'remark'
      >
    >;

    type StdQualifierVersion = Common.CommonRecord<{
      versionId: CommonType.IdType;
      bizId: string;
      versionNo: string;
      actionType: string;
      qualifierName: string;
      qualifierSymbol: string;
      lifecycleStatus: string;
      isCurrent: string;
    }>;

    type StdQualifierList = Common.PaginatingQueryRecord<StdQualifier>;

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
      executionId?: CommonType.IdType;
      batchNo?: string;
      entityType?: string;
      scopeEntityUuid?: string;
      metricName: string;
      metricGroup?: string;
      actualValue: string;
      actualValueType: string;
      dataDate: string;
      createTime: string;
    }>;

    type ProfileTask = Common.CommonRecord<{
      taskId: CommonType.IdType;
      taskName: string;
      scopeType: 'database' | 'table';
      entityUuid: string;
      datasourceId: CommonType.IdType;
      selectAllColumns?: number;
      selectedColumnsJson?: string;
      rowFilterSql?: string;
      enabled?: number;
      cronExpression?: string;
      jobId?: CommonType.IdType;
      lastExecutionId?: CommonType.IdType;
      remark?: string;
    }>;

    type ProfileExecution = Common.CommonRecord<{
      executionId: CommonType.IdType;
      taskId: CommonType.IdType;
      batchNo: string;
      scopeType: 'database' | 'table';
      entityUuid: string;
      datasourceId: CommonType.IdType;
      status: string;
      startTime?: string;
      endTime?: string;
      durationMs?: number;
      snapshotDate?: string;
      operatorId?: CommonType.IdType;
      profiledTableCount?: number;
      successTableCount?: number;
      failedTableCount?: number;
      errorMessage?: string;
      executionLog?: string;
    }>;

    type ProfileTrendPoint = {
      batchNo?: string;
      snapshotDate?: string;
      metricName: string;
      actualValue: string;
    };

    type ProfileAnomaly = {
      type: 'error' | 'warning' | 'info';
      title: string;
      message: string;
    };

    type ColumnProfileBase = {
      uuid: string;
      name: string;
      type?: string;
      dataType?: string;
      nullCount?: string;
      nullPercentage?: string;
      notNullCount?: string;
      notNullPercentage?: string;
      distinctCount?: string;
      distinctPercentage?: string;
      uniqueCount?: string;
      uniquePercentage?: string;
    };

    type ColumnStringProfile = ColumnProfileBase & {
      maxValue?: string;
      minValue?: string;
      maxLength?: string;
      minLength?: string;
      avgLength?: string;
      top10Json?: string;
    };

    type ColumnNumericProfile = ColumnProfileBase & {
      maxValue?: string;
      minValue?: string;
      avgValue?: string;
      sumValue?: string;
      top10Json?: string;
    };

    type ColumnDateTimeProfile = ColumnProfileBase & {
      maxValue?: string;
      minValue?: string;
      top10Json?: string;
    };

    type TableProfileOverview = {
      tableUuid: string;
      tableName: string;
      latestBatchNo?: string;
      latestColumnBatchNo?: string;
      latestExecuteTime?: string;
      executionStatus?: string;
      tableRowCount?: number;
      columnProfiles: ColumnProfileBase[];
    };

    type DatabaseProfileOverview = {
      databaseUuid: string;
      databaseName: string;
      latestBatchNo?: string;
      latestExecuteTime?: string;
      executionStatus?: string;
      databaseRowCountTotal?: number;
      profiledTableCount?: number;
      successTableCount?: number;
      failedTableCount?: number;
    };

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
      status: 'QUEUED' | 'RUNNING' | 'DETACHED_RUNNING' | 'SUCCESS' | 'FAIL' | 'SKIPPED';
      syncMode?: SyncMode;
      triggerSource?: 'initial' | 'manual' | 'schedule' | string;
      schemaName?: string;
      tableName?: string;
      durationMs?: number;
      summaryJson?: string;
      failedStage?: string;
      failedSchemaName?: string;
      failedTableName?: string;
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
