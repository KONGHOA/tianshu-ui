<script setup lang="ts">
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({
  name: 'LineageOps'
});

const { domRef } = useEcharts(() => {
  const nodes = [
    { id: '1', name: '车辆卡口表\n(原始)', category: 0, x: 100, y: 300, symbolSize: 45 },
    { id: '2', name: '车辆清洗表\n(资源)', category: 1, x: 300, y: 300, symbolSize: 55 },
    { id: '3', name: '同行同乘表\n(主题)', category: 2, x: 500, y: 200, symbolSize: 65 },
    { id: '4', name: '重点车辆库\n(业务)', category: 3, x: 500, y: 400, symbolSize: 65 },
    { id: '5', name: '车辆研判API', category: 4, x: 700, y: 300, symbolSize: 40 }
  ];

  const links = [
    { source: '1', target: '2' },
    { source: '2', target: '3' },
    { source: '2', target: '4' },
    { source: '3', target: '5' },
    { source: '4', target: '5' }
  ];

  const categories = [
    { name: '原始', itemStyle: { color: '#E9C46A' } },
    { name: '资源', itemStyle: { color: '#F4A261' } },
    { name: '主题', itemStyle: { color: '#E76F51' } },
    { name: '业务', itemStyle: { color: '#2A9D8F' } },
    { name: '服务', itemStyle: { color: '#3B82F6' } }
  ];

  return {
    tooltip: {},
    legend: [
      {
        data: categories.map(a => a.name),
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#666' }
      }
    ],
    series: [
      {
        name: '数据血缘探索',
        type: 'graph',
        layout: 'none',
        data: nodes.map(node => ({
          ...node,
          label: { show: true, fontSize: 10, color: '#fff' },
          itemStyle: { shadowColor: 'rgba(0,0,0,0.2)', shadowBlur: 5 }
        })),
        links,
        categories,
        roam: true,
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [4, 8],
        lineStyle: {
          color: 'source',
          curveness: 0.3,
          width: 2,
          opacity: 0.7
        }
      }
    ]
  };
});
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2 text-16px text-gray-800 font-semibold dark:text-gray-100">
        <div class="h-3 w-3 rd-full bg-cyan-500"></div>
        核心资产血缘探索
      </div>
      <div>
        <NTag size="small" type="success" :bordered="false" class="cursor-pointer">节点全绿</NTag>
      </div>
    </div>
    <div ref="domRef" class="min-h-240px flex-1"></div>
  </div>
</template>

<style scoped></style>
