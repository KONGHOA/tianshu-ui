<script setup lang="ts">
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({
  name: 'DataPipeline'
});

const { domRef } = useEcharts(() => {
  // Define graph nodes and edges resembling the GA standard process
  const nodes = [
    // Layer 1: Data Ingestion (数据接入)
    { id: '1', name: '数据探查', category: 0, x: 0, y: 100, symbolSize: 60 },
    { id: '2', name: '数据定义', category: 0, x: 0, y: 300, symbolSize: 60 },
    { id: '3', name: '数据读取', category: 0, x: 0, y: 500, symbolSize: 60 },
    { id: '4', name: '数据对账', category: 0, x: 0, y: 700, symbolSize: 60 },
    // Layer 2: Data Processing (数据处理)
    { id: '5', name: '数据清洗\n(去重/过滤)', category: 1, x: 260, y: 200, symbolSize: 75 },
    { id: '6', name: '数据标识\n(打标/归档)', category: 1, x: 260, y: 500, symbolSize: 75 },
    { id: '7', name: '数据分发\n(路由/推送)', category: 1, x: 260, y: 700, symbolSize: 75 },
    // Layer 3: Data Organization (数据组织)
    { id: '8', name: '原始库', category: 2, x: 540, y: 100, symbolSize: 85, itemStyle: { color: '#E9C46A' } },
    { id: '9', name: '资源库', category: 2, x: 540, y: 300, symbolSize: 85, itemStyle: { color: '#F4A261' } },
    { id: '10', name: '主题库', category: 2, x: 540, y: 500, symbolSize: 85, itemStyle: { color: '#E76F51' } },
    { id: '11', name: '业务库', category: 2, x: 540, y: 700, symbolSize: 85, itemStyle: { color: '#2A9D8F' } },
    // Layer 4: Data Service (数据服务)
    { id: '12', name: '查询检索\n开放通用API', category: 3, x: 800, y: 200, symbolSize: 70 },
    { id: '13', name: '业务协同\n消息订阅', category: 3, x: 800, y: 500, symbolSize: 70 },
    { id: '14', name: '实战分析\n模型集群', category: 3, x: 800, y: 700, symbolSize: 70 }
  ];

  const links = [
    // L1 -> L2
    { source: '1', target: '5' },
    { source: '2', target: '5' },
    { source: '3', target: '6' },
    { source: '4', target: '7' },
    // L2 -> L3
    { source: '5', target: '8' },
    { source: '5', target: '9' },
    { source: '6', target: '10' },
    { source: '7', target: '11' },
    // L3 -> L4
    { source: '8', target: '12' },
    { source: '9', target: '12' },
    { source: '10', target: '13' },
    { source: '11', target: '14' },
    // Inter-layer (dashed)
    { source: '5', target: '6', lineStyle: { type: 'dashed', curveness: 0.1, opacity: 0.3 } },
    { source: '6', target: '7', lineStyle: { type: 'dashed', curveness: 0.1, opacity: 0.3 } },
    { source: '8', target: '9', lineStyle: { type: 'dashed', curveness: 0.1, opacity: 0.3 } },
    { source: '9', target: '10', lineStyle: { type: 'dashed', curveness: 0.1, opacity: 0.3 } },
    { source: '10', target: '11', lineStyle: { type: 'dashed', curveness: 0.1, opacity: 0.3 } }
  ];

  const categories = [
    { name: '数据接入 (Ingest)' },
    { name: '数据处理 (Process)' },
    { name: '数据组织 (Storage)' },
    { name: '数据服务 (Serve)' }
  ];

  return {
    tooltip: {
      formatter: '{b}'
    },
    legend: [
      {
        data: categories.map(a => a.name),
        textStyle: {
          color: '#666'
        },
        bottom: 0
      }
    ],
    animationDurationUpdate: 1500,
    animationEasingUpdate: 'quinticInOut',
    series: [
      {
        name: '公安大数据处理全流程',
        type: 'graph',
        layout: 'none',
        left: '8%',
        right: '8%',
        top: '15%',
        bottom: '15%',
        circular: {
          rotateLabel: true
        },
        data: nodes.map(node => ({
          ...node,
          symbolSize: node.symbolSize || 60,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}',
            color: '#fff',
            textBorderColor: 'transparent',
            textBorderWidth: 0,
            fontSize: 11,
            lineHeight: 14
          },
          itemStyle: {
            ...node.itemStyle,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
            shadowBlur: 5
          }
        })),
        links,
        categories,
        roam: true,
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [3, 8],
        lineStyle: {
          color: 'source',
          curveness: 0.2,
          width: 1.5,
          opacity: 0.6
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 3,
            opacity: 1
          }
        }
      }
    ]
  } as any;
});
</script>

<template>
  <div class="relative h-full min-h-400px flex flex-col">
    <div class="z-10 mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2 text-18px text-gray-800 font-bold dark:text-gray-100">
        <div class="i-ph-git-branch text-24px text-blue-500"></div>
        大数据处理全流程链路
      </div>
      <div>
        <NTag size="small" type="info" :bordered="false" class="cursor-pointer">查看详情</NTag>
      </div>
    </div>

    <!-- Governance Background Overlay -->
    <div
      class="pointer-events-none absolute inset-x-4 inset-y-12 z-0 flex items-end justify-center border-2 border-blue-200 rd-3xl border-dashed pb-8 opacity-40 transition-all dark:border-blue-900/50 hover:border-blue-400 hover:opacity-60"
    >
      <div
        class="rd-full bg-blue-50 px-8 py-2 text-sm text-blue-500 font-semibold tracking-widest shadow-sm dark:bg-blue-900/40 dark:text-blue-300"
      >
        全流程数据治理管控屏障 (Data Governance)
      </div>
    </div>

    <div ref="domRef" class="z-10 w-full flex-1"></div>
  </div>
</template>

<style scoped></style>
