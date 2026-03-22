<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { NButton, NTooltip } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';

interface Props {
  autoLayout: () => void;
  zoomToFit: () => void;
  removeSelectedCells: () => void;
  container?: HTMLElement | null;
  saving: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{ (e: 'save'): void }>();

const isFullscreen = ref(false);

function updateFullscreenState() {
  isFullscreen.value = document.fullscreenElement !== null;
}

async function toggleFullscreen() {
  if (!props.container) return;
  if (document.fullscreenElement === null) {
    await props.container.requestFullscreen();
    return;
  }
  await document.exitFullscreen();
}

onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreenState);
  updateFullscreenState();
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState);
});
</script>

<template>
  <div class="flex items-center gap-10px">
    <NTooltip trigger="hover">
      <template #trigger>
        <NButton circle secondary type="info" size="small" @click="props.zoomToFit">
          <template #icon><SvgIcon icon="mdi:fit-to-page-outline" class="text-16px" /></template>
        </NButton>
      </template>
      居中适配
    </NTooltip>

    <NTooltip trigger="hover">
      <template #trigger>
        <NButton circle secondary type="info" size="small" @click="props.autoLayout">
          <template #icon><SvgIcon icon="mdi:sitemap-outline" class="text-16px" /></template>
        </NButton>
      </template>
      自动布局
    </NTooltip>

    <NTooltip trigger="hover">
      <template #trigger>
        <NButton circle secondary type="info" size="small" @click="props.removeSelectedCells">
          <template #icon><SvgIcon icon="mdi:delete-outline" class="text-16px" /></template>
        </NButton>
      </template>
      删除选中
    </NTooltip>

    <NTooltip trigger="hover">
      <template #trigger>
        <NButton circle secondary type="info" size="small" @click="toggleFullscreen">
          <template #icon>
            <SvgIcon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" class="text-16px" />
          </template>
        </NButton>
      </template>
      {{ isFullscreen ? '退出全屏' : '全屏' }}
    </NTooltip>

    <NButton
      round
      type="info"
      secondary
      size="small"
      class="ml-10px px-16px"
      :loading="props.saving"
      @click="emit('save')"
    >
      保存
    </NButton>
  </div>
</template>
