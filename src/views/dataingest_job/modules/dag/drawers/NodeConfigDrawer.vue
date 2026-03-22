<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NAlert, NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSpace } from 'naive-ui';
import type { Graph } from '@antv/x6';
import type { DagNodeData } from '../composables/useDagGraph';
import SourceConfigPanel from './SourceConfigPanel.vue';
import SinkConfigPanel from './SinkConfigPanel.vue';
import TransformConfigPanel from './TransformConfigPanel.vue';

const visible = defineModel<boolean>('visible', { default: false });

interface Props {
  nodeData: DagNodeData | null;
  graph: Graph | null;
  datasourceOptions: { label: string; value: CommonType.IdType }[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'saved', payload: DagNodeData): void }>();

const config = reactive<Record<string, any>>({});
const nodeLabel = ref('');
const panelKey = ref(0);

const title = computed(() => {
  if (!props.nodeData) return '节点配置';
  return `${props.nodeData.label} 配置`;
});

function assignConfig(source: Record<string, any>) {
  Object.keys(config).forEach(key => {
    Reflect.deleteProperty(config, key);
  });
  Object.assign(config, source);
}

function hydrate() {
  nodeLabel.value = props.nodeData?.label ?? '';
  assignConfig(props.nodeData?.config ?? {});
  panelKey.value += 1;
}

watch(
  () => visible.value,
  value => {
    if (value) {
      hydrate();
    }
  }
);

watch(
  () => props.nodeData?.nodeCode,
  () => {
    if (visible.value) {
      hydrate();
    }
  }
);

function closeDrawer() {
  visible.value = false;
}

function persistNode() {
  if (!props.graph || !props.nodeData) return;
  const node = props.graph
    .getNodes()
    .find(item => (item.getData() as DagNodeData).nodeCode === props.nodeData?.nodeCode);
  if (!node) return;
  const current = node.getData() as DagNodeData;
  const label = nodeLabel.value?.trim() || current.nodeCode;
  const nextData: DagNodeData = {
    ...current,
    label,
    configured: true,
    config: {
      ...config,
      nodeName: label
    }
  };
  node.setData(nextData);
  emit('saved', nextData);
  closeDrawer();
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="640" placement="right" :trap-focus="false" :z-index="2100">
    <NDrawerContent :title="title" closable>
      <template v-if="props.nodeData">
        <div class="flex flex-col gap-16px">
          <NForm label-placement="left" :label-width="96">
            <NFormItem label="节点名称">
              <NInput v-model:value="nodeLabel" placeholder="用于画布显示" />
            </NFormItem>
          </NForm>
          <SourceConfigPanel
            v-if="props.nodeData.taskType === 'SOURCE'"
            :key="panelKey"
            :config="config"
            :datasource-options="datasourceOptions"
          />
          <SinkConfigPanel
            v-else-if="props.nodeData.taskType === 'SINK'"
            :key="panelKey"
            :config="config"
            :datasource-options="datasourceOptions"
          />
          <TransformConfigPanel v-else :key="panelKey" :config="config" :plugin-type="props.nodeData.pluginType" />
        </div>
      </template>
      <NAlert v-else type="info" :show-icon="false">请选择节点后进行配置</NAlert>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeDrawer">取消</NButton>
          <NButton type="primary" @click="persistNode">保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
