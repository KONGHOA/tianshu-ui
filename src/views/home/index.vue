<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import GlobalMetrics from './modules/components/GlobalMetrics.vue';
import DataPipeline from './modules/components/DataPipeline.vue';
import AssetDonut from './modules/components/AssetDonut.vue';
import QualityRadar from './modules/components/QualityRadar.vue';
import ModelLabelCloud from './modules/components/ModelLabelCloud.vue';
import LineageOps from './modules/components/LineageOps.vue';

const appStore = useAppStore();

const gap = computed(() => (appStore.isMobile ? 0 : 16));
</script>

<template>
  <NSpace vertical :size="16" class="min-h-full p-1">
    <NAlert title="态势感知：公安大数据处理全流程与数据治理态势感知大屏" type="info" class="shadow-sm">
      <div class="text-14px">
        本页面按照《GADSJ 200-2019
        公安大数据处理总体技术规范》构建，全景展示数据接入、处理、组织到服务的全生命周期，并凸显数据治理管控成效。
      </div>
    </NAlert>

    <!-- 1. 顶部数据总览区 -->
    <GlobalMetrics />

    <!-- 2 & 3. 核心业务全流程链路图 与 治理面板A -->
    <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:16">
        <NCard :bordered="false" class="h-full card-wrapper shadow-sm transition-shadow hover:shadow-md">
          <DataPipeline />
        </NCard>
      </NGi>
      <NGi span="24 s:24 m:8">
        <NCard :bordered="false" class="h-full card-wrapper shadow-sm transition-shadow hover:shadow-md">
          <AssetDonut />
        </NCard>
      </NGi>
    </NGrid>

    <!-- 4. 下方数据治理深度看版 -->
    <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:8">
        <NCard :bordered="false" class="h-full card-wrapper shadow-sm transition-shadow hover:shadow-md">
          <QualityRadar />
        </NCard>
      </NGi>
      <NGi span="24 s:24 m:8">
        <NCard :bordered="false" class="h-full card-wrapper shadow-sm transition-shadow hover:shadow-md">
          <ModelLabelCloud />
        </NCard>
      </NGi>
      <NGi span="24 s:24 m:8">
        <NCard :bordered="false" class="h-full card-wrapper shadow-sm transition-shadow hover:shadow-md">
          <LineageOps />
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped>
.card-wrapper {
  border-radius: 12px;
}
.dark .card-wrapper {
  background: rgba(31, 34, 37, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
