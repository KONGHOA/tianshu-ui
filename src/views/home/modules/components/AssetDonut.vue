<script setup lang="ts">
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({
  name: 'AssetDonut'
});

const { domRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: '0%',
    left: 'center',
    icon: 'circle',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: {
      color: '#666'
    }
  },
  color: ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F'],
  series: [
    {
      name: '数据资源分级',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: '16',
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: [
        { value: 15, name: '绝密' },
        { value: 25, name: '机密' },
        { value: 40, name: '秘密' },
        { value: 120, name: '内部' }
      ]
    }
  ]
}));
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2 text-16px text-gray-800 font-semibold dark:text-gray-100">
        <div class="h-3 w-3 rd-full bg-blue-500"></div>
        资产分级占比
      </div>
      <div class="i-ph-dots-three cursor-pointer text-xl text-gray-400"></div>
    </div>
    <div ref="domRef" class="flex-1"></div>
  </div>
</template>

<style scoped></style>
