<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NPagination } from 'naive-ui';
import { fetchGetSchemaChangeList } from '@/service/api/metadata/schema-change';
import ChangeTimeline from '@/views/metadata_datasource-explorer/modules/ChangeTimeline.vue';

interface Props {
  datasourceId: CommonType.IdType | null;
}

const props = defineProps<Props>();

type ChangeRow = Api.Metadata.SchemaChange;

const loading = ref(false);
const records = ref<ChangeRow[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(15);

async function loadData() {
  if (!props.datasourceId) return;
  loading.value = true;
  const { data, error } = await fetchGetSchemaChangeList({
    datasourceId: Number(props.datasourceId),
    pageNum: pageNum.value,
    pageSize: pageSize.value
  });
  if (!error && data) {
    records.value = data.rows ?? [];
    total.value = data.total ?? 0;
  }
  loading.value = false;
}

watch(
  () => props.datasourceId,
  () => {
    pageNum.value = 1;
    loadData();
  }
);

onMounted(loadData);
</script>

<template>
  <div class="schema-change-panel flex flex-col gap-12px">
    <ChangeTimeline :records="records" :loading="loading" empty-description="暂无变更记录，数据源刷新后自动生成" />

    <div v-if="total > 0" class="flex justify-end">
      <NPagination
        v-model:page="pageNum"
        v-model:page-size="pageSize"
        :item-count="total"
        :page-sizes="[15, 30, 50]"
        show-size-picker
        size="small"
        @update:page="loadData"
        @update:page-size="loadData"
      />
    </div>
  </div>
</template>

<style scoped>
.schema-change-panel {
  padding: 2px 2px 4px;
}
</style>
