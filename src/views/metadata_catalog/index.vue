<script setup lang="tsx">
import { computed, ref } from 'vue';
import type { TreeOption } from 'naive-ui';
import { useLoading } from '@sa/hooks';
import {
  fetchGetColumns,
  fetchGetDatabases,
  fetchGetEntityDetail,
  fetchGetTables
} from '@/service/api/metadata/catalog';
import { fetchGetDatasourceSelect } from '@/service/api/metadata/datasource';
import { useAuth } from '@/hooks/business/auth';
import SvgIcon from '@/components/custom/svg-icon.vue';

defineOptions({ name: 'MetadataCatalogBrowser' });

const { hasAuth } = useAuth();

type TreeNode = {
  key: string;
  label: string;
  type: 'datasource' | 'database' | 'table' | 'column';
  isLeaf?: boolean;
  datasourceId?: CommonType.IdType;
  uuid?: string;
  children?: TreeNode[];
};

const treePattern = ref<string>();
const treeData = ref<TreeNode[]>([]);
const expandedKeys = ref<string[]>([]);
const selectedKeys = ref<string[]>([]);
const allDatasources = ref<Api.Metadata.Datasource[]>([]);
const selectedDetail = ref<Record<string, any> | null>(null);

const { loading: treeLoading, startLoading: startTreeLoading, endLoading: endTreeLoading } = useLoading();

/** Normalized display fields from either Datasource or EntityInstance */
const detailName = computed(() => {
  if (!selectedDetail.value) return '-';
  return selectedDetail.value.displayName || selectedDetail.value.datasourceName || '-';
});
const detailType = computed(() => {
  if (!selectedDetail.value) return '-';
  return selectedDetail.value.entityType || selectedDetail.value.datasourceType || '-';
});
const detailFqn = computed(() => selectedDetail.value?.fullyQualifiedName || '-');
const detailDesc = computed(() => selectedDetail.value?.description || selectedDetail.value?.remark || '-');
const detailStatus = computed(() => selectedDetail.value?.status);
const detailCreateTime = computed(() => selectedDetail.value?.createTime || '-');
const isActiveStatus = computed(() => detailStatus.value === 'active' || detailStatus.value === '0');
const statusLabel = computed(() => (isActiveStatus.value ? '活跃' : '停用/已删除'));

const getIcon = (type: TreeNode['type']) => {
  switch (type) {
    case 'datasource':
      return 'mdi:database-outline';
    case 'database':
      return 'mdi:database';
    case 'table':
      return 'mdi:table';
    case 'column':
      return 'mdi:table-column';
    default:
      return 'mdi:folder-outline';
  }
};

const renderPrefix = ({ option }: { option: TreeOption }) => {
  const node = option as unknown as TreeNode;
  return <SvgIcon icon={getIcon(node.type)} class="text-16px" />;
};

async function getDatasources() {
  if (!hasAuth('metadata:catalog:list')) return;
  startTreeLoading();
  const { data, error } = await fetchGetDatasourceSelect();
  if (!error && data) {
    allDatasources.value = data;
    treeData.value = data.map(item => ({
      key: `ds_${item.datasourceId}`,
      label: item.datasourceName,
      type: 'datasource',
      isLeaf: false,
      datasourceId: item.datasourceId
    }));
  }
  endTreeLoading();
}

getDatasources();

async function handleLoadTree(node: TreeOption) {
  const treeNode = node as unknown as TreeNode;

  if (treeNode.type === 'datasource' && treeNode.datasourceId) {
    const { data, error } = await fetchGetDatabases(treeNode.datasourceId);
    if (!error && data) {
      treeNode.children = data.map(item => ({
        key: item.uuid,
        label: item.displayName,
        type: 'database',
        isLeaf: false,
        uuid: item.uuid
      }));
    } else {
      treeNode.children = [];
    }
  } else if (treeNode.type === 'database' && treeNode.uuid) {
    const { data, error } = await fetchGetTables(treeNode.uuid);
    if (!error && data) {
      treeNode.children = data.map(item => ({
        key: item.uuid,
        label: item.displayName,
        type: 'table',
        isLeaf: false,
        uuid: item.uuid
      }));
    } else {
      treeNode.children = [];
    }
  } else if (treeNode.type === 'table' && treeNode.uuid) {
    const { data, error } = await fetchGetColumns(treeNode.uuid);
    if (!error && data) {
      treeNode.children = data.map(item => ({
        key: item.uuid,
        label: item.displayName,
        type: 'column',
        isLeaf: true,
        uuid: item.uuid
      }));
    } else {
      treeNode.children = [];
    }
  }
  return Promise.resolve();
}

const parsedProperties = computed(() => {
  if (!selectedDetail.value?.properties) return null;
  try {
    const parsed = JSON.parse(selectedDetail.value.properties as string);
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
});

async function handleSelectNode(keys: Array<string | number>, options: Array<TreeOption | null>) {
  selectedKeys.value = keys as string[];
  if (!keys.length || !options.length || !options[0]) {
    selectedDetail.value = null;
    return;
  }

  const node = options[0] as unknown as TreeNode;
  if (node.type === 'datasource') {
    const selectedDsId = node.datasourceId;
    const ds = allDatasources.value.find(d => d.datasourceId === selectedDsId);
    selectedDetail.value = ds || null;
  } else if (node.uuid) {
    const { data, error } = await fetchGetEntityDetail(node.uuid);
    if (!error && data) {
      selectedDetail.value = data;
    } else {
      selectedDetail.value = null;
    }
  }
}

function handleResetTreeData() {
  treePattern.value = undefined;
  getDatasources();
}
</script>

<template>
  <TableSiderLayout sider-title="元数据目录">
    <template #header-extra>
      <NButton size="small" text class="h-18px" @click.stop="handleResetTreeData">
        <template #icon>
          <SvgIcon icon="ic:round-refresh" />
        </template>
      </NButton>
    </template>
    <template #sider>
      <NInput v-model:value="treePattern" clearable placeholder="输入关键字搜索" />
      <NSpin class="dept-tree" :show="treeLoading">
        <NTree
          v-model:expanded-keys="expandedKeys"
          v-model:selected-keys="selectedKeys"
          block-node
          show-line
          :data="treeData as []"
          :show-irrelevant-nodes="false"
          :pattern="treePattern"
          block-line
          class="infinite-scroll h-full min-h-200px py-3"
          key-field="key"
          label-field="label"
          virtual-scroll
          :on-load="handleLoadTree"
          :render-prefix="renderPrefix"
          @update:selected-keys="handleSelectNode"
        >
          <template #empty>
            <NEmpty description="暂无目录信息" class="h-full min-h-200px justify-center" />
          </template>
        </NTree>
      </NSpin>
    </template>
    <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
      <NCard title="元数据详情" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
        <template v-if="selectedDetail">
          <NDescriptions label-placement="left" :column="2" bordered>
            <NDescriptionsItem label="名称">{{ detailName }}</NDescriptionsItem>
            <NDescriptionsItem label="类型">{{ detailType }}</NDescriptionsItem>
            <NDescriptionsItem label="全限定名" :span="2">{{ detailFqn }}</NDescriptionsItem>
            <NDescriptionsItem label="描述" :span="2">{{ detailDesc }}</NDescriptionsItem>
            <NDescriptionsItem label="状态">
              <NTag :type="isActiveStatus ? 'success' : 'error'">{{ statusLabel }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ detailCreateTime }}</NDescriptionsItem>
          </NDescriptions>

          <NCard v-if="parsedProperties" title="属性信息" size="small" class="mt-12px">
            <NDescriptions label-placement="left" :column="2" bordered>
              <NDescriptionsItem v-for="(value, key) in parsedProperties" :key="key" :label="String(key)">
                {{ String(value) }}
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </template>
        <NEmpty v-else description="请选择左侧目录节点查看详情" class="h-full min-h-200px justify-center" />
      </NCard>
    </div>
  </TableSiderLayout>
</template>

<style scoped lang="scss">
.dept-tree {
  .n-button {
    --n-padding: 8px !important;
  }

  :deep(.n-tree__empty) {
    height: 100%;
    justify-content: center;
  }

  :deep(.n-spin-content) {
    height: 100%;
  }

  :deep(.infinite-scroll) {
    height: calc(100vh - 228px - var(--calc-footer-height, 0px)) !important;
    max-height: calc(100vh - 228px - var(--calc-footer-height, 0px)) !important;
  }

  @media screen and (max-width: 1024px) {
    :deep(.infinite-scroll) {
      height: calc(100vh - 227px - var(--calc-footer-height, 0px)) !important;
      max-height: calc(100vh - 227px - var(--calc-footer-height, 0px)) !important;
    }
  }

  :deep(.n-tree-node) {
    height: 30px;
  }

  :deep(.n-tree-node-switcher) {
    height: 30px;
  }

  :deep(.n-tree-node-switcher__icon) {
    font-size: 16px !important;
    height: 16px !important;
    width: 16px !important;
  }
}

:deep(.n-card-header__main) {
  min-width: 69px !important;
}
</style>
