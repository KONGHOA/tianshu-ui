<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NFormItem, NGrid, NGridItem, NSelect } from 'naive-ui';
import { fetchGetDatabases, fetchGetSchemas } from '@/service/api/metadata/catalog';
import { type SelectOption, findOptionLabel, mapCatalogOptions } from './dag/utils/catalog';

defineOptions({ name: 'DbSchemaSelector' });

interface ModelValue {
  datasourceId: CommonType.IdType | null;
  databaseName: string;
  schemaName: string;
}

interface Props {
  datasourceOptions: { label: string; value: CommonType.IdType }[];
}

defineProps<Props>();
const model = defineModel<ModelValue>('value', { required: true });

const databaseOptions = ref<SelectOption[]>([]);
const schemaOptions = ref<SelectOption[]>([]);

const selectedDatabaseUuid = ref('');
const selectedSchemaUuid = ref('');

const databaseLoading = ref(false);
const schemaLoading = ref(false);
const hydrating = ref(false);

const selectMenuProps = { style: { zIndex: 2200 } };

function resetAfterDatasource() {
  databaseOptions.value = [];
  schemaOptions.value = [];
  selectedDatabaseUuid.value = '';
  selectedSchemaUuid.value = '';
  model.value.databaseName = '';
  model.value.schemaName = '';
}

function resetAfterDatabase() {
  schemaOptions.value = [];
  selectedSchemaUuid.value = '';
  model.value.schemaName = '';
}

async function loadDatabases(datasourceId: CommonType.IdType, restoring = false) {
  databaseLoading.value = true;
  const { data, error } = await fetchGetDatabases(datasourceId);
  databaseLoading.value = false;
  databaseOptions.value = !error && data ? mapCatalogOptions(data) : [];

  if (!restoring || !model.value.databaseName) return;
  const target = databaseOptions.value.find((item: SelectOption) => item.label === model.value.databaseName);
  if (target) {
    selectedDatabaseUuid.value = target.value;
    await loadSchemas(true);
  }
}

async function loadSchemas(restoring = false) {
  if (!selectedDatabaseUuid.value) return;
  schemaLoading.value = true;
  const { data, error } = await fetchGetSchemas(selectedDatabaseUuid.value);
  schemaLoading.value = false;

  if (error || !data || data.length === 0) {
    schemaOptions.value = [];
    model.value.schemaName = '';
    return;
  }

  schemaOptions.value = mapCatalogOptions(data);
  if (!restoring || !model.value.schemaName) return;
  const target = schemaOptions.value.find((item: SelectOption) => item.label === model.value.schemaName);
  if (target) {
    selectedSchemaUuid.value = target.value;
  }
}

async function hydrateFromConfig() {
  hydrating.value = true;
  const savedDb = model.value.databaseName;
  const savedSchema = model.value.schemaName;

  resetAfterDatasource();
  model.value.databaseName = savedDb;
  model.value.schemaName = savedSchema;

  if (model.value.datasourceId !== null) {
    await loadDatabases(model.value.datasourceId, true);
  }
  hydrating.value = false;
}

watch(
  () => model.value.datasourceId,
  async value => {
    if (hydrating.value) return;
    resetAfterDatasource();
    if (value !== null) {
      await loadDatabases(value);
    }
  }
);

watch(selectedDatabaseUuid, async value => {
  if (hydrating.value) return;
  model.value.databaseName = value ? findOptionLabel(databaseOptions.value, value) : '';
  resetAfterDatabase();
  if (value) {
    await loadSchemas();
  }
});

watch(selectedSchemaUuid, async value => {
  if (hydrating.value) return;
  model.value.schemaName = value ? findOptionLabel(schemaOptions.value, value) : '';
});

// Expose hydration method for manual triggering (e.g. edit mode)
defineExpose({ hydrateFromConfig });

onMounted(async () => {
  if (model.value.datasourceId !== null) {
    await hydrateFromConfig();
  }
});
</script>

<template>
  <NGrid :x-gap="24" :cols="3">
    <NGridItem>
      <NFormItem label="数据源" path="datasourceId">
        <NSelect
          v-model:value="model.datasourceId"
          :options="datasourceOptions"
          filterable
          clearable
          :loading="databaseLoading"
          :menu-props="selectMenuProps"
          class="w-full"
        />
      </NFormItem>
    </NGridItem>
    <NGridItem>
      <NFormItem label="数据库" path="databaseName">
        <NSelect
          v-model:value="selectedDatabaseUuid"
          :options="databaseOptions"
          :disabled="model.datasourceId == null"
          :loading="databaseLoading"
          filterable
          clearable
          :menu-props="selectMenuProps"
          class="w-full"
        />
      </NFormItem>
    </NGridItem>
    <NGridItem>
      <NFormItem label="Schema (选填)" path="schemaName">
        <NSelect
          v-model:value="selectedSchemaUuid"
          :options="schemaOptions"
          :disabled="schemaOptions.length === 0"
          :loading="schemaLoading"
          clearable
          :menu-props="selectMenuProps"
          class="w-full"
        />
      </NFormItem>
    </NGridItem>
  </NGrid>
</template>
