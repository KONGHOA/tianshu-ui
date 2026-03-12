<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { NAlert, NDivider, NDynamicTags, NForm, NFormItem, NInput, NSelect } from 'naive-ui';

defineOptions({
  name: 'SourceSinkStep'
});

type SelectOption = { label: string; value: string | number };

interface Props {
  datasourceOptions: { label: string; value: CommonType.IdType }[];
  sourceDatabaseOptions: SelectOption[];
  sourceSchemaOptions: SelectOption[];
  sourceTableOptions: SelectOption[];
  sinkDatabaseOptions: SelectOption[];
  sinkSchemaOptions: SelectOption[];
  sinkTableOptions: SelectOption[];
  sourceIncrementalFieldOptions: SelectOption[];
  targetPrimaryKeyOptions: SelectOption[];
  readModeOptions: { label: string; value: string }[];
  writeModeOptions: { label: string; value: string }[];
  sourceModel: Api.Dataingest.IngestJobSourceOperate;
  sinkModel: Api.Dataingest.IngestJobSinkOperate;
  datasourceLoading: boolean;
  sourceDatabaseLoading: boolean;
  sourceSchemaLoading: boolean;
  sourceTableLoading: boolean;
  sourceFieldLoading: boolean;
  sinkDatabaseLoading: boolean;
  sinkSchemaLoading: boolean;
  sinkTableLoading: boolean;
  sinkFieldLoading: boolean;
}

defineProps<Props>();

interface Emits {
  (e: 'source-datasource-change', value: CommonType.IdType | null): void;
  (e: 'source-database-change', value: string | null): void;
  (e: 'source-schema-change', value: string | null): void;
  (e: 'source-table-change', value: string | null): void;
  (e: 'sink-datasource-change', value: CommonType.IdType | null): void;
  (e: 'sink-database-change', value: string | null): void;
  (e: 'sink-schema-change', value: string | null): void;
  (e: 'sink-table-change', value: string | null): void;
}

defineEmits<Emits>();
</script>

<template>
  <div class="flex-col gap-16px">
    <div class="grid grid-cols-2 gap-16px lt-md:grid-cols-1">
      <div>
        <NDivider>源表配置</NDivider>
        <NForm :model="sourceModel" label-placement="left" :label-width="96">
          <NFormItem label="数据源">
            <NSelect
              :value="sourceModel.datasourceId"
              :options="datasourceOptions"
              filterable
              clearable
              :loading="datasourceLoading"
              @update:value="$emit('source-datasource-change', $event)"
            />
          </NFormItem>
          <NFormItem label="数据库">
            <NSelect
              :value="sourceModel.databaseName"
              :options="sourceDatabaseOptions"
              clearable
              filterable
              :loading="sourceDatabaseLoading"
              :disabled="!sourceModel.datasourceId || datasourceLoading"
              @update:value="$emit('source-database-change', $event)"
            />
          </NFormItem>
          <NFormItem label="Schema">
            <NSelect
              :value="sourceModel.schemaName"
              :options="sourceSchemaOptions"
              clearable
              :loading="sourceSchemaLoading"
              :disabled="!sourceModel.databaseName || sourceDatabaseLoading || sourceSchemaOptions.length === 0"
              @update:value="$emit('source-schema-change', $event)"
            />
          </NFormItem>
          <NFormItem label="表名">
            <NSelect
              :value="sourceModel.tableName"
              :options="sourceTableOptions"
              filterable
              clearable
              :loading="sourceTableLoading"
              :disabled="!sourceModel.databaseName || sourceTableLoading || sourceSchemaLoading"
              @update:value="$emit('source-table-change', $event)"
            />
          </NFormItem>
          <NFormItem label="读取方式">
            <NSelect v-model:value="sourceModel.readMode" :options="readModeOptions" :disabled="sourceFieldLoading" />
          </NFormItem>
          <NFormItem label="增量字段">
            <NSelect
              v-model:value="sourceModel.incrementalColumn"
              :options="sourceIncrementalFieldOptions"
              filterable
              clearable
              :loading="sourceFieldLoading"
              :disabled="!sourceModel.tableName || sourceFieldLoading || sourceModel.readMode !== 'INCREMENTAL'"
            />
          </NFormItem>
          <NFormItem label="WHERE 条件">
            <NInput
              v-model:value="sourceModel.whereCondition"
              placeholder="如 status = 1（不含 WHERE）"
              :disabled="sourceFieldLoading"
            />
          </NFormItem>
          <NFormItem label="读取字段">
            <NDynamicTags
              v-model:value="sourceModel.fieldList"
              :disabled="!sourceModel.tableName || sourceFieldLoading"
            />
          </NFormItem>
          <NAlert v-if="sourceFieldLoading" type="info" :show-icon="false">正在加载源表字段...</NAlert>
        </NForm>
      </div>

      <div>
        <NDivider>目标表配置</NDivider>
        <NForm :model="sinkModel" label-placement="left" :label-width="96">
          <NFormItem label="数据源">
            <NSelect
              :value="sinkModel.datasourceId"
              :options="datasourceOptions"
              filterable
              clearable
              :loading="datasourceLoading"
              @update:value="$emit('sink-datasource-change', $event)"
            />
          </NFormItem>
          <NFormItem label="数据库">
            <NSelect
              :value="sinkModel.databaseName"
              :options="sinkDatabaseOptions"
              clearable
              filterable
              :loading="sinkDatabaseLoading"
              :disabled="!sinkModel.datasourceId || datasourceLoading"
              @update:value="$emit('sink-database-change', $event)"
            />
          </NFormItem>
          <NFormItem label="Schema">
            <NSelect
              :value="sinkModel.schemaName"
              :options="sinkSchemaOptions"
              clearable
              :loading="sinkSchemaLoading"
              :disabled="!sinkModel.databaseName || sinkDatabaseLoading || sinkSchemaOptions.length === 0"
              @update:value="$emit('sink-schema-change', $event)"
            />
          </NFormItem>
          <NFormItem label="表名">
            <NSelect
              :value="sinkModel.tableName"
              :options="sinkTableOptions"
              filterable
              clearable
              :loading="sinkTableLoading"
              :disabled="!sinkModel.databaseName || sinkTableLoading || sinkSchemaLoading"
              @update:value="$emit('sink-table-change', $event)"
            />
          </NFormItem>
          <NFormItem label="写入模式">
            <NSelect v-model:value="sinkModel.writeMode" :options="writeModeOptions" :disabled="sinkFieldLoading" />
          </NFormItem>
          <NFormItem label="主键字段">
            <NSelect
              v-model:value="sinkModel.primaryKeys"
              :options="targetPrimaryKeyOptions"
              filterable
              clearable
              multiple
              :loading="sinkFieldLoading"
              :disabled="!sinkModel.tableName || sinkFieldLoading"
            />
          </NFormItem>
          <NAlert v-if="sinkFieldLoading" type="info" :show-icon="false">正在加载目标表字段...</NAlert>
        </NForm>
      </div>
    </div>
  </div>
</template>
