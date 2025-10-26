export function useNetworkStatus() {
  const isOnline = ref(true);
  const wasOffline = ref(false);

  let onlineHandler: (() => void) | null = null;
  let offlineHandler: (() => void) | null = null;

  // Only set up event listeners on client side
  onMounted(() => {
    if (typeof window !== 'undefined' && 'navigator' in window) {
      isOnline.value = navigator.onLine;

      onlineHandler = () => {
        const wasOfflineBefore = !isOnline.value;
        isOnline.value = true;
        if (wasOfflineBefore) {
          wasOffline.value = true;
          // Reset after a delay to allow sync to happen
          setTimeout(() => {
            wasOffline.value = false;
          }, 1000);
        }
      };

      offlineHandler = () => {
        isOnline.value = false;
      };

      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      if (onlineHandler) window.removeEventListener('online', onlineHandler);
      if (offlineHandler) window.removeEventListener('offline', offlineHandler);
    }
  });

  return {
    isOnline,
    wasOffline
  };
}
