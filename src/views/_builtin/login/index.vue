<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { loginModuleRecord } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { $t } from '@/locales';
import PwdLogin from './modules/pwd-login.vue';
import CodeLogin from './modules/code-login.vue';
import Register from './modules/register.vue';
import ResetPwd from './modules/reset-pwd.vue';
import BindWechat from './modules/bind-wechat.vue';

interface Props {
  /** The login module */
  module?: UnionKey.LoginModule;
}

const props = defineProps<Props>();

const appStore = useAppStore();
const themeStore = useThemeStore();

interface LoginModule {
  label: App.I18n.I18nKey;
  component: Component;
}

const moduleMap: Record<UnionKey.LoginModule, LoginModule> = {
  'pwd-login': { label: loginModuleRecord['pwd-login'], component: PwdLogin },
  'code-login': { label: loginModuleRecord['code-login'], component: CodeLogin },
  register: { label: loginModuleRecord.register, component: Register },
  'reset-pwd': { label: loginModuleRecord['reset-pwd'], component: ResetPwd },
  'bind-wechat': { label: loginModuleRecord['bind-wechat'], component: BindWechat }
};

const activeModule = computed(() => moduleMap[props.module || 'pwd-login']);
</script>

<template>
  <div class="scroll relative box-border size-full">
    <div class="absolute inset-0 overflow-hidden bg-primary-50 dark:bg-primary-900">
      <WaveBg />
    </div>
    <header class="absolute inset-x-0 top-0 z-20 flex-y-center justify-start px-30px pt-30px">
      <div class="flex items-center justify-start">
        <ThemeSchemaSwitch
          :theme-schema="themeStore.themeScheme"
          :show-tooltip="false"
          class="text-20px lt-sm:text-18px"
          @switch="themeStore.toggleThemeScheme"
        />
        <LangSwitch
          v-if="themeStore.header.multilingual.visible"
          :lang="appStore.locale"
          :lang-options="appStore.localeOptions"
          :show-tooltip="false"
          class="text-20px lt-sm:text-18px"
          @change-lang="appStore.changeLocale"
        />
      </div>
    </header>
    <main class="flex min-h-full items-center justify-center px-24px py-24px">
      <Transition :name="themeStore.page.animateMode" mode="out-in" appear>
        <div :class="['login-panel w-full max-w-450px', { 'login-panel-dark': themeStore.darkMode }]">
          <div class="mb-28px flex items-center justify-center">
            <SystemLogo class="fill-primary text-48px" />
            <h3 class="ml-12px text-28px font-600 text-black dark:text-white">{{ $t('system.title') }}</h3>
          </div>
          <component :is="activeModule.component" />
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.scroll {
  overflow: auto;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.scroll {
  -ms-overflow-style: none;
}

.scroll {
  scrollbar-width: none;
}

.login-panel {
  padding: 32px 28px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 20px;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 24px 70px rgb(15 23 42 / 14%);
  backdrop-filter: blur(14px);
}

.login-panel-dark {
  border-color: rgb(96 165 250 / 14%);
  background: rgb(15 23 42 / 88%);
  box-shadow:
    0 24px 70px rgb(2 6 23 / 36%),
    inset 0 1px 0 rgb(255 255 255 / 6%);
  backdrop-filter: blur(14px);
}
</style>
