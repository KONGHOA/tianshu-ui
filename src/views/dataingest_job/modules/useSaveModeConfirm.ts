import { ref } from 'vue';

/**
 * Composable for destructive save-mode selection with NPopconfirm rollback.
 *
 * @param getter - reads the current value from the model
 * @param setter - writes a new value to the model
 * @param dangerousValue - the value that triggers confirmation
 * @param defaultValue - fallback when current value is nullish
 */
export function useSaveModeConfirm(
  getter: () => string | undefined,
  setter: (v: string) => void,
  dangerousValue: string,
  defaultValue: string
) {
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
