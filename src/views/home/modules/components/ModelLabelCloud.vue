<script setup lang="ts">
import { useEcharts } from '@/hooks/common/echarts';
import 'echarts-wordcloud';

defineOptions({
  name: 'ModelLabelCloud'
});

const { domRef } = useEcharts(() => {
  const data = [
    { name: '涉诈高危', value: 1000 },
    { name: '车辆轨迹', value: 800 },
    { name: '重点前科', value: 650 },
    { name: '涉毒网络', value: 500 },
    { name: '资金洗钱', value: 450 },
    { name: '敏感区域', value: 300 },
    { name: '同行同住', value: 720 },
    { name: '异地登录', value: 210 },
    { name: '常住异动', value: 600 },
    { name: '时空交集', value: 920 }
  ];

  return {
    tooltip: {
      show: true,
      formatter: '{b}: {c} 次调用'
    },
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '100%',
        height: '100%',
        right: null,
        bottom: null,
        sizeRange: [12, 40],
        rotationRange: [-45, 90],
        rotationStep: 45,
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: {
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          color() {
            return `rgb(${[
              Math.round(Math.random() * 160) + 40,
              Math.round(Math.random() * 160) + 40,
              Math.round(Math.random() * 160) + 40
            ].join(',')})`;
          }
        },
        emphasis: {
          focus: 'self',
          textStyle: {
            textShadowBlur: 10,
            textShadowColor: '#333'
          }
        },
        data
      }
    ]
  } as any;
});
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2 text-16px text-gray-800 font-semibold dark:text-gray-100">
        <div class="h-3 w-3 rd-full bg-purple-500"></div>
        热点标签与模型
      </div>
    </div>
    <div ref="domRef" class="min-h-240px flex-1"></div>
  </div>
</template>

<style scoped></style>
