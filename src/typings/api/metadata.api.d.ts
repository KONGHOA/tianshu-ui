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
      status: string;
      remark: string;
    }>;

    type DatasourceSearchParams = CommonType.RecordNullable<
      Pick<Datasource, 'datasourceName' | 'datasourceType' | 'status' | 'categoryId'> & Api.Common.CommonSearchParams
    >;

    type DatasourceOperateParams = CommonType.RecordNullable<
      Pick<
        Datasource,
        'datasourceId' | 'categoryId' | 'datasourceName' | 'datasourceType' | 'connParams' | 'status' | 'remark'
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
      changeType: string;
      databaseName: string;
      tableName: string;
      columnName: string;
      changeBefore: string;
      changeAfter: string;
      createTime: string;
    }>;

    type SchemaChangeSearchParams = CommonType.RecordNullable<
      Pick<SchemaChange, 'entityUuid' | 'parentUuid'> & { datasourceId?: number } & Api.Common.CommonSearchParams
    >;

    type SchemaChangeList = Common.PaginatingQueryRecord<SchemaChange>;
  }
}
