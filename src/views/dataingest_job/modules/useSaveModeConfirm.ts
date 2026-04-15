import { ref } from 'vue';

interface SaveModeConfirmOptions {
  getter: () => string | undefined;
  setter: (v: string) => void;
  dangerousValue: string;
  defaultValue: string;
}

/**
 * Composable for destructive save-mode selection with NPopconfirm rollback.
 */
export function useSaveModeConfirm(options: SaveModeConfirmOptions) {
  const { getter, setter, dangerousValue, defaultValue } = options;
  const show = ref(false);
  const prev = ref('');

  function handleChange(value: string) {
    if (value === dangerousValue) {
      prev.value = getter() ?? defaultValue;
      setter(value);
      show.value = true;
    } else {
      setter(value);
    }
  }

  function confirm() {
    show.value = false;
  }

  function cancel() {
    setter(prev.value);
    show.value = false;
  }

  return { show, handleChange, confirm, cancel };
}
