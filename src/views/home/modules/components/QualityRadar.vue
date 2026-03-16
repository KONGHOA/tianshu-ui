<script setup lang="ts">
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({
  name: 'QualityRadar'
});

const { domRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['空值率', '规范性错误', '去重拦截'],
    bottom: 0,
    textStyle: {
      color: '#666'
    }
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '15%',
    top: '10%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    axisLine: {
      lineStyle: {
        color: '#ccc'
      }
    },
    axisLabel: {
      color: '#666'
    }
  },
  yAxis: {
    type: 'value',
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    splitLine: {
      lineStyle: {
        color: '#eee',
        type: 'dashed'
      }
    },
    axisLabel: {
      color: '#666'
    }
  },
  series: [
    {
      name: '空值率',
      type: 'line',
      smooth: true,
      symbol: 'none',
      itemStyle: {
        color: '#3B82F6'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
          ]
        }
      },
      data: [120, 132, 101, 134, 90, 230, 210]
    },
    {
      name: '规范性错误',
      type: 'line',
      smooth: true,
      symbol: 'none',
      itemStyle: {
        color: '#EF4444'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }
          ]
        }
      },
      data: [220, 182, 191, 234, 290, 330, 310]
    },
    {
      name: '去重拦截',
      type: 'line',
      smooth: true,
      symbol: 'none',
      itemStyle: {
        color: '#10B981'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
          ]
        }
      },
      data: [150, 232, 201, 154, 190, 330, 410]
    }
  ]
}));
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2 text-16px text-gray-800 font-semibold dark:text-gray-100">
        <div class="h-3 w-3 rd-full bg-red-500"></div>
        质量检核拦截趋势
      </div>
      <div class="flex gap-2">
        <NTag size="small" type="primary" :bordered="false">近7天</NTag>
      </div>
    </div>
    <div ref="domRef" class="min-h-240px flex-1"></div>
  </div>
</template>

<style scoped></style>
