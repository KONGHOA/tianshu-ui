<script setup lang="tsx">
import { computed, h, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDropdown,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NPagination,
  NSpace,
  NTag,
  NTree
} from 'naive-ui';
import type { TreeOption } from 'naive-ui';
import {
  fetchBatchDeleteDatasource,
  fetchGetDatasourceList,
  fetchGetDatasourceStats,
  fetchRefreshDatasource,
  fetchTestConnectionById
} from '@/service/api/metadata/datasource';
import { fetchDeleteCategory, fetchGetCategoryTree } from '@/service/api/metadata/datasourceCategory';
import { useAuth } from '@/hooks/business/auth';
import { defaultTransform, useNaivePaginatedTable, useTableOperate } from '@/hooks/common/table';
import { useDict } from '@/hooks/business/dict';
import { getDatasourceIcon } from '@/utils/datasourceIcon';
import statTotalIcon from '@/assets/imgs/stats/stat-total.svg';
import statTypesIcon from '@/assets/imgs/stats/stat-types.svg';
import statActiveIcon from '@/assets/imgs/stats/stat-active.svg';
import statInactiveIcon from '@/assets/imgs/stats/stat-inactive.svg';
import SvgIcon from '@/components/custom/svg-icon.vue';
import DatasourceOperateDrawer from './modules/DatasourceOperateDrawer.vue';
import CategoryOperateDrawer from './modules/CategoryOperateDrawer.vue';
import DatasourceSyncDrawer from './modules/DatasourceSyncDrawer.vue';

defineOptions({
  name: 'MetadataDatasourceList'
});

useDict('sys_normal_disable');
const { hasAuth } = useAuth();

const searchParams = ref<Api.Metadata.DatasourceSearchParams>({
  pageNum: 1,
  pageSize: 20,
  datasourceName: null,
  datasourceType: null,
  status: null,
  categoryId: null,
  params: {}
});

const { data, getData, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchGetDatasourceList(searchParams.value),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.value.pageNum = params.page;
    searchParams.value.pageSize = params.pageSize;
  },
  columns: () => [] // 卡片视图不再需要 columns
});

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, onDeleted } = useTableOperate(
  data,
  'datasourceId',
  getData
);

// ==== 分类管理逻辑 ====
const catDrawerVisible = ref(false);
const catOperateType = ref<NaiveUI.TableOperateType>('add');
const catEditingData = ref<any>(null);

function handleCategoryAdd() {
  catOperateType.value = 'add';
  catEditingData.value = { parentId: 0 };
  catDrawerVisible.value = true;
}

function handleCategoryAddChild(option: TreeOption) {
  catOperateType.value = 'add';
  catEditingData.value = { parentId: option.id };
  catDrawerVisible.value = true;
}

function handleCategoryEdit(option: TreeOption) {
  catOperateType.value = 'edit';
  catEditingData.value = {
    categoryId: option.id,
    parentId: option.parentId,
    categoryName: option.name,
    orderNum: option.weight || 0
  };
  catDrawerVisible.value = true;
}

async function handleCategoryDelete(option: TreeOption) {
  window.$dialog?.warning({
    title: '确认删除',
    content: `是否确认删除分类 "${option.name}"？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteCategory(option.id as number);
      if (!error) {
        window.$message?.success('删除成功');
        getCategoryTree();
      }
    }
  });
}

const getCategoryDropdownOptions = () => {
  const options = [] as any[];
  if (hasAuth('metadata:datasourceCategory:add')) {
    options.push({ label: '添加子分类', key: 'addChild' });
  }
  if (hasAuth('metadata:datasourceCategory:edit')) {
    options.push({ label: '编辑', key: 'edit' });
  }
  if (hasAuth('metadata:datasourceCategory:remove')) {
    options.push({ label: '删除', key: 'delete' });
  }
  return options;
};

function handleCategoryDropdownSelect(key: string, option: TreeOption) {
  if (key === 'addChild') handleCategoryAddChild(option);
  else if (key === 'edit') handleCategoryEdit(option);
  else if (key === 'delete') handleCategoryDelete(option);
}

const renderCategoryPrefix = () => {
  return h(SvgIcon, { icon: 'mdi:folder-outline', class: 'text-16px text-amber-500' });
};

const renderCategorySuffix = ({ option }: { option: TreeOption }) => {
  const options = getCategoryDropdownOptions();
  if (options.length === 0 || option.id === 0) return null;

  return h(
    NDropdown,
    {
      options,
      trigger: 'click',
      onSelect: (key: string) => handleCategoryDropdownSelect(key, option)
    },
    {
      default: () =>
        h(
          NButton,
          {
            text: true,
            size: 'tiny',
            class: 'ml-2 text-gray-400 hover:text-blue-500',
            onClick: (e: Event) => e.stopPropagation()
          },
          { default: () => h(NIcon, { size: 16 }, { default: () => h('span', { class: 'i-mdi-dots-vertical' }) }) }
        )
    }
  );
};
// ====================

const categoryTreeData = ref<any[]>([{ id: 0, name: '全部数据源', children: [] }]);
const categoryKeyword = ref('');
const selectedCategoryKeys = ref<Array<number>>([0]);

function filterTree(list: any[], keyword: string): any[] {
  if (!keyword.trim()) return list;
  const pattern = keyword.trim().toLowerCase();
  return list
    .map(node => {
      const children = node.children ? filterTree(node.children, keyword) : [];
      const matched = String(node.name || '')
        .toLowerCase()
        .includes(pattern);
      if (matched || children.length) {
        return { ...node, children };
      }
      return null;
    })
    .filter(Boolean) as any[];
}

const filteredCategoryTreeData = computed(() => filterTree(categoryTreeData.value, categoryKeyword.value));
const selectedCategoryName = computed(() => {
  const selectedId = selectedCategoryKeys.value[0];
  if (selectedId === undefined || selectedId === 0) return '全部数据源';
  const findNode = (nodes: any[]): string => {
    for (const node of nodes) {
      if (node.id === selectedId) return node.name;
      if (node.children?.length) {
        const result = findNode(node.children);
        if (result) return result;
      }
    }
    return '';
  };
  return findNode(categoryTreeData.value) || '全部数据源';
});

async function getCategoryTree() {
  const { data: treeData, error } = await fetchGetCategoryTree();
  if (error) {
    categoryTreeData.value = [{ id: 0, name: '全部数据源', children: [] }];
    window.$message?.error('获取分类失败，请检查分类权限或接口状态');
    return;
  }
  categoryTreeData.value = [{ id: 0, name: '全部数据源', children: treeData || [] }];
}

function handleCategorySelect(keys: Array<number>) {
  const selected = keys[0] ?? 0;
  selectedCategoryKeys.value = [selected];
  searchParams.value.categoryId = selected === 0 ? null : selected;
  searchParams.value.pageNum = 1;
  getData();
}

function handleSearch() {
  searchParams.value.pageNum = 1;
  getData();
}

function handleResetFilters() {
  searchParams.value.datasourceName = null;
  searchParams.value.categoryId = null;
  searchParams.value.pageNum = 1;
  selectedCategoryKeys.value = [0];
  getData();
}

function handleReloadAll() {
  getCategoryTree();
  loadStats();
  getData();
}

async function handleDelete(datasourceId: CommonType.IdType) {
  window.$dialog?.warning({
    title: '确认删除',
    content: '是否确认删除该数据源？删除后不可恢复。',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchBatchDeleteDatasource([datasourceId]);
      if (error) return;
      onDeleted();
      loadStats();
    }
  });
}

async function handleTestConnection(datasourceId: CommonType.IdType) {
  const { error, data: testData } = await fetchTestConnectionById(datasourceId);
  if (!error && testData === true) {
    window.$message?.success('连接成功');
  } else {
    window.$message?.error('连接失败，请检查配置');
  }
  // 刷新列表和统计以反映最新连接状态
  getData();
  loadStats();
}

async function handleRefresh(datasourceId: CommonType.IdType) {
  const { error } = await fetchRefreshDatasource(datasourceId);
  if (!error) {
    window.$message?.success('已提交同步任务');
    getData();
    loadStats();
  }
}

function handleDatasourceSubmitted() {
  getData();
  loadStats();
}

// ---- 同步调度管理逻辑 ----
const syncDrawerVisible = ref(false);
const activeSyncDatasourceId = ref<CommonType.IdType>();

function handleOpenSyncConfig(datasourceId: CommonType.IdType) {
  activeSyncDatasourceId.value = datasourceId;
  syncDrawerVisible.value = true;
}

async function edit(datasourceId: CommonType.IdType) {
  handleEdit(datasourceId);
}

const router = useRouter();

function handleCardClick(datasourceId: CommonType.IdType) {
  router.push({ name: 'metadata_datasource-explorer', query: { datasourceId: String(datasourceId) } });
}

// 顶部数据统计
const statsData = ref<Api.Metadata.DatasourceStats>({
  totalCount: 0,
  typeCount: 0,
  activeCount: 0,
  inactiveCount: 0
});

async function loadStats() {
  const { data: stats, error } = await fetchGetDatasourceStats();
  if (!error && stats) {
    statsData.value = stats;
  }
}

// ---- 数字计数动画 ----
function useAnimatedCount(source: () => number, duration = 600) {
  const display = ref(0);
  let raf = 0;
  watch(
    source,
    newVal => {
      cancelAnimationFrame(raf);
      const start = display.value;
      const diff = newVal - start;
      if (diff === 0) return;
      const startTime = performance.now();
      function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const ease = 1 - (1 - progress) ** 3;
        display.value = Math.round(start + diff * ease);
        if (progress < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    },
    { immediate: true }
  );
  return display;
}

const animTotal = useAnimatedCount(() => statsData.value.totalCount);
const animTypes = useAnimatedCount(() => statsData.value.typeCount);
const animActive = useAnimatedCount(() => statsData.value.activeCount);
const animInactive = useAnimatedCount(() => statsData.value.inactiveCount);

const statCards = computed(() => [
  {
    label: '数据源总数',
    value: statsData.value.totalCount,
    animValue: animTotal.value,
    iconSrc: statTotalIcon,
    gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(30,58,138,0.25) 0%, rgba(30,64,175,0.15) 100%)',
    border: 'border-t-blue-500',
    unit: '个'
  },
  {
    label: '数据源类型',
    value: statsData.value.typeCount,
    animValue: animTypes.value,
    iconSrc: statTypesIcon,
    gradient: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(154,52,18,0.25) 0%, rgba(194,65,12,0.15) 100%)',
    border: 'border-t-orange-500',
    unit: '种'
  },
  {
    label: '在线数量',
    value: statsData.value.activeCount,
    animValue: animActive.value,
    iconSrc: statActiveIcon,
    gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(6,78,59,0.25) 0%, rgba(4,120,87,0.15) 100%)',
    border: 'border-t-green-500',
    unit: '个'
  },
  {
    label: '离线数量',
    value: statsData.value.inactiveCount,
    animValue: animInactive.value,
    iconSrc: statInactiveIcon,
    gradient: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(127,29,29,0.25) 0%, rgba(153,27,27,0.15) 100%)',
    border: 'border-t-red-500',
    unit: '个'
  }
]);

function getTagType(type: string) {
  if (type === 'hive') return 'info';
  if (type === 'vertica') return 'success';
  if (type === 'mysql') return 'warning';
  return 'default';
}

/** 品牌色图标背景 */
function getIconBg(type?: string): string {
  const map: Record<string, string> = {
    mysql: 'bg-orange-50 dark:bg-orange-900/20',
    postgresql: 'bg-blue-50 dark:bg-blue-900/20',
    oracle: 'bg-red-50 dark:bg-red-900/20',
    clickhouse: 'bg-yellow-50 dark:bg-yellow-900/20',
    hive: 'bg-amber-50 dark:bg-amber-900/20',
    doris: 'bg-indigo-50 dark:bg-indigo-900/20',
    greenplum: 'bg-green-50 dark:bg-green-900/20',
    mariadb: 'bg-sky-50 dark:bg-sky-900/20',
    sqlite: 'bg-cyan-50 dark:bg-cyan-900/20',
    starrocks: 'bg-violet-50 dark:bg-violet-900/20',
    vertica: 'bg-teal-50 dark:bg-teal-900/20'
  };
  return map[type ?? ''] ?? 'bg-gray-50 dark:bg-gray-800';
}

function getStatusMeta(status?: string) {
  if (status === '1') {
    return {
      text: '在线',
      dot: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400'
    };
  }
  if (status === '2') {
    return {
      text: '离线',
      dot: 'bg-red-500',
      textColor: 'text-red-600 dark:text-red-400'
    };
  }
  return {
    text: '未检测',
    dot: 'bg-gray-400',
    textColor: 'text-gray-500 dark:text-gray-400'
  };
}

onMounted(() => {
  getCategoryTree();
  loadStats();
  getData();
});
</script>

<template>
  <div class="h-full flex-col-stretch gap-20px bg-[#f2f3f5] p-20px dark:bg-transparent">
    <!-- Top Stats -->
    <NGrid :x-gap="16" :y-gap="16" :cols="4" responsive="screen">
      <NGridItem v-for="stat in statCards" :key="stat.label">
        <div
          class="stat-card group relative flex items-center gap-16px overflow-hidden border border-t-2 border-gray-200 rounded-12px bg-white px-18px py-20px shadow-sm dark:border-gray-800 dark:bg-[#18181c]"
          :class="stat.border"
        >
          <!-- 背景水印图标 -->
          <img
            :src="stat.iconSrc"
            :alt="stat.label"
            class="stat-card-watermark absolute h-72px w-72px -right-8px -top-8px"
          />
          <!-- 渐变图标容器 -->
          <div
            class="stat-card-icon relative z-10 h-44px w-44px flex-center flex-shrink-0 rounded-12px shadow-sm"
            :style="{ background: stat.gradient }"
          >
            <img :src="stat.iconSrc" :alt="stat.label" class="h-28px w-28px object-contain" />
          </div>
          <!-- 数据区域 -->
          <div class="relative z-10 flex flex-col gap-2px">
            <span class="text-12px text-gray-400 font-medium leading-tight dark:text-gray-500">{{ stat.label }}</span>
            <div class="flex items-baseline gap-4px">
              <span
                class="stat-card-number text-24px text-gray-800 font-bold leading-none tracking-tight dark:text-gray-100"
              >
                {{ stat.animValue }}
              </span>
              <span class="text-11px text-gray-400">{{ stat.unit }}</span>
            </div>
          </div>
        </div>
      </NGridItem>
    </NGrid>

    <TableSiderLayout sider-title="数据源分类">
      <template #header-extra>
        <NButton
          v-if="hasAuth('metadata:datasourceCategory:add')"
          size="small"
          text
          class="h-18px"
          @click.stop="handleCategoryAdd"
        >
          <template #icon>
            <icon-mdi-plus />
          </template>
        </NButton>
      </template>
      <template #sider>
        <NInput v-model:value="categoryKeyword" clearable size="small" placeholder="搜索分类" class="mb-10px">
          <template #prefix>
            <icon-mdi-magnify class="text-gray-400" />
          </template>
        </NInput>
        <NTree
          v-model:selected-keys="selectedCategoryKeys"
          block-line
          expand-on-click
          default-expand-all
          :data="filteredCategoryTreeData"
          key-field="id"
          label-field="name"
          children-field="children"
          :render-suffix="renderCategorySuffix"
          :render-prefix="renderCategoryPrefix"
          class="datasource-tree h-[calc(100%-44px)] min-h-200px"
          @update:selected-keys="handleCategorySelect"
        >
          <template #empty>
            <NEmpty description="暂无分类" size="small" class="h-full min-h-200px justify-center" />
          </template>
        </NTree>
      </template>
      <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
        <NCard
          :bordered="false"
          size="small"
          class="card-wrapper sm:flex-1-hidden"
          content-class="p-20px flex-col h-full"
        >
          <div class="mb-20px flex-y-center justify-between">
            <div class="flex items-center gap-16px">
              <NInput
                v-model:value="searchParams.datasourceName"
                placeholder="搜索数据源名称..."
                class="w-280px"
                round
                clearable
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <icon-mdi-magnify class="text-gray-400" />
                </template>
              </NInput>
              <NButton type="primary" ghost @click="handleSearch">
                <template #icon><icon-mdi-magnify /></template>
                搜索
              </NButton>
              <NButton ghost @click="handleResetFilters">
                <template #icon><icon-mdi-filter-off-outline /></template>
                重置
              </NButton>
            </div>
            <div class="flex items-center gap-12px">
              <NButton quaternary circle @click="handleReloadAll">
                <template #icon><icon-mdi-refresh /></template>
              </NButton>
              <NButton v-if="hasAuth('metadata:datasource:add')" type="primary" class="px-16px" @click="handleAdd">
                <template #icon><icon-mdi-plus /></template>
                新建数据源
              </NButton>
              <div class="h-24px w-1px bg-gray-200 dark:bg-gray-700"></div>
              <NSpace :size="0" class="overflow-hidden border border-gray-200 rounded-md dark:border-gray-700">
                <NButton ghost class="border-0 bg-gray-50 text-primary dark:bg-gray-800 px-10px!" :focusable="false">
                  <icon-mdi-view-grid class="text-18px" />
                </NButton>
                <NButton
                  ghost
                  class="border-0 border-l border-gray-200 text-gray-400 dark:border-gray-700 px-10px! hover:text-primary"
                  :focusable="false"
                >
                  <icon-mdi-format-list-bulleted class="text-18px" />
                </NButton>
              </NSpace>
            </div>
          </div>

          <div class="mb-14px flex-y-center justify-between rounded-8px bg-gray-50 px-12px py-8px dark:bg-[#202024]">
            <div class="flex items-center gap-8px text-12px text-gray-600 dark:text-gray-300">
              <span class="i-mdi-folder-outline text-14px" />
              当前分类：
              <span class="text-gray-900 font-medium dark:text-gray-100">{{ selectedCategoryName }}</span>
            </div>
            <div class="text-12px text-gray-500">共 {{ mobilePagination.itemCount || 0 }} 条</div>
          </div>

          <div class="flex-1 pr-12px">
            <NGrid v-if="data.length" :x-gap="16" :y-gap="16" :cols="12" responsive="screen" item-responsive>
              <NGridItem v-for="item in data" :key="item.datasourceId" span="12 m:6 l:4 xl:4 2xl:3">
                <div
                  class="group h-full flex flex-col cursor-pointer overflow-hidden border border-gray-200 rounded-12px bg-white transition-all dark:border-gray-800 hover:border-primary/50 dark:bg-[#18181c] hover:shadow-lg hover:-translate-y-1"
                  @click="handleCardClick(item.datasourceId)"
                >
                  <!-- Card Header -->
                  <div
                    class="flex items-center justify-between border-b border-gray-100 px-14px py-12px dark:border-gray-800/60"
                  >
                    <div class="max-w-[calc(100%-70px)] flex items-center gap-10px">
                      <div
                        class="h-34px w-34px flex-center flex-shrink-0 rounded-8px"
                        :class="getIconBg(item.datasourceType)"
                      >
                        <img
                          :src="getDatasourceIcon(item.datasourceType)"
                          :alt="item.datasourceType"
                          class="h-22px w-22px object-contain"
                        />
                      </div>
                      <div class="flex flex-col overflow-hidden">
                        <span
                          class="truncate text-14px text-gray-800 font-semibold dark:text-gray-100"
                          :title="item.datasourceName"
                        >
                          {{ item.datasourceName }}
                        </span>
                        <span class="truncate text-11px text-gray-400">ID: {{ item.datasourceId }}</span>
                      </div>
                    </div>
                    <NTag
                      :type="getTagType(item.datasourceType)"
                      size="small"
                      :bordered="false"
                      round
                      class="text-11px font-medium"
                    >
                      {{ item.datasourceType?.toUpperCase() }}
                    </NTag>
                  </div>

                  <!-- Card Body -->
                  <div class="flex flex-col flex-1 p-12px text-12px">
                    <div class="grid grid-cols-2 gap-x-12px">
                      <div class="flex flex-col gap-4px">
                        <span class="text-gray-400">连接状态</span>
                        <span class="flex items-center gap-6px" :class="getStatusMeta(item.status).textColor">
                          <span class="h-6px w-6px rounded-full" :class="getStatusMeta(item.status).dot"></span>
                          {{ getStatusMeta(item.status).text }}
                        </span>
                      </div>
                      <div class="flex flex-col gap-4px">
                        <span class="text-gray-400">更新时间</span>
                        <span class="text-gray-700 dark:text-gray-300">
                          {{ item.updateTime || item.createTime || '-' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Card Actions -->
                  <div
                    class="grid grid-cols-5 border-t border-gray-100 bg-gray-50/50 dark:border-gray-800/60 dark:bg-[#202024]/50"
                    @click.stop
                  >
                    <NButton
                      v-if="hasAuth('metadata:datasource:remove')"
                      size="small"
                      quaternary
                      type="error"
                      class="rounded-none!"
                      @click="handleDelete(item.datasourceId)"
                    >
                      <template #icon><icon-material-symbols-delete-outline /></template>
                      删除
                    </NButton>
                    <NButton
                      v-if="hasAuth('metadata:datasource:edit')"
                      size="small"
                      quaternary
                      class="rounded-none!"
                      @click="edit(item.datasourceId)"
                    >
                      <template #icon><icon-material-symbols-drive-file-rename-outline-outline /></template>
                      编辑
                    </NButton>
                    <NButton
                      v-if="hasAuth('metadata:datasource:edit')"
                      size="small"
                      quaternary
                      class="rounded-none!"
                      @click="handleOpenSyncConfig(item.datasourceId)"
                    >
                      <template #icon><icon-mdi-calendar-clock /></template>
                      调度
                    </NButton>
                    <NButton
                      v-if="hasAuth('metadata:datasource:edit')"
                      size="small"
                      quaternary
                      class="rounded-none!"
                      @click="handleRefresh(item.datasourceId)"
                    >
                      <template #icon><icon-mdi-refresh /></template>
                      刷新
                    </NButton>
                    <NButton
                      v-if="hasAuth('metadata:datasource:query')"
                      size="small"
                      quaternary
                      type="primary"
                      class="rounded-none!"
                      @click="handleTestConnection(item.datasourceId)"
                    >
                      <template #icon><icon-mdi-connection /></template>
                      测试
                    </NButton>
                  </div>
                </div>
              </NGridItem>
            </NGrid>
            <NEmpty v-else description="暂无数据源，请先新增或切换分类" class="h-full min-h-260px justify-center" />
          </div>

          <div class="mt-16px flex justify-end border-t border-gray-100 pt-14px dark:border-gray-800/50">
            <NPagination
              v-model:page="searchParams.pageNum!"
              v-model:page-size="searchParams.pageSize!"
              :item-count="mobilePagination.itemCount || 0"
              show-size-picker
              :page-sizes="[10, 20, 50]"
              @update:page="getData"
              @update:page-size="getData"
            />
          </div>
        </NCard>
      </div>
    </TableSiderLayout>

    <!-- 数据源新增/编辑弹窗 -->
    <DatasourceOperateDrawer
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :row-data="editingData"
      :category-tree="categoryTreeData"
      @submitted="handleDatasourceSubmitted"
    />

    <!-- 分类新增/编辑弹窗 -->
    <CategoryOperateDrawer
      v-model:visible="catDrawerVisible"
      :operate-type="catOperateType"
      :row-data="catEditingData"
      :tree-data="categoryTreeData"
      @submitted="getCategoryTree"
    />

    <!-- 数据源同步弹窗 -->
    <DatasourceSyncDrawer v-model:visible="syncDrawerVisible" :datasource-id="activeSyncDatasourceId" />
  </div>
</template>

<style scoped>
/* ---- 统计卡片微交互 ---- */
.stat-card {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 8px 24px -4px rgba(0, 0, 0, 0.08),
    0 2px 6px -1px rgba(0, 0, 0, 0.04);
}

.stat-card-watermark {
  opacity: 0.06;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover .stat-card-watermark {
  opacity: 0.12;
  transform: scale(1.15) rotate(6deg);
}

.stat-card-icon {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover .stat-card-icon {
  transform: scale(1.08);
  box-shadow:
    0 4px 12px -2px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.06);
}

.stat-card-number {
  font-variant-numeric: tabular-nums;
}

/* 暗色模式渐变覆盖 */
:root.dark .stat-card-icon {
  filter: brightness(0.85) saturate(1.2);
}

/* ---- 原有样式 ---- */
:deep(.sider-layout-card-content) {
  overflow: hidden !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

:deep(.sider-layout-card-content::-webkit-scrollbar) {
  width: 0;
  height: 0;
  display: none;
}

:deep(.datasource-tree) {
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

:deep(.datasource-tree::-webkit-scrollbar) {
  width: 0;
  height: 0;
  display: none;
}

:deep(.n-tree-node-content) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
:deep(.n-tree-node-content__suffix) {
  opacity: 1 !important;
  transition: opacity 0.2s;
}
:deep(.n-tree-node-wrapper:hover .n-tree-node-content__suffix) {
  opacity: 1;
}
</style>
