import { ref, watch, onUnmounted } from 'vue';
import { getCachedProfilePicture, cacheProfilePicture } from '~/utils/profilePictureCache';

export function useCachedProfilePicture(userId: string | number | undefined, url: string | undefined | null) {
  const cachedImageUrl = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Store the object URL so we can revoke it later
  let currentObjectUrl: string | null = null;

  async function loadProfilePicture() {
    // Reset state
    error.value = null;

    // Clean up previous object URL if it exists
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    // If no userId or url, clear the cached image
    if (!userId || !url) {
      cachedImageUrl.value = null;
      return;
    }

    isLoading.value = true;

    try {
      // Try to get from cache first
      const cached = await getCachedProfilePicture(userId, url);

      if (cached) {
        // Cache hit - use cached image
        cachedImageUrl.value = cached;
        currentObjectUrl = cached;
      } else {
        // Cache miss - fetch and cache the image
        const objectUrl = await cacheProfilePicture(userId, url);

        if (objectUrl) {
          cachedImageUrl.value = objectUrl;
          currentObjectUrl = objectUrl;
        } else {
          // Failed to cache, fall back to original URL
          cachedImageUrl.value = url;
        }
      }
    } catch (err) {
      console.error('[useCachedProfilePicture] Error loading profile picture:', err);
      error.value = 'Failed to load profile picture';
      // Fall back to original URL on error
      cachedImageUrl.value = url;
    } finally {
      isLoading.value = false;
    }
  }

  // Watch for changes in userId or url
  watch([() => userId, () => url], () => {
    loadProfilePicture();
  }, { immediate: true });

  // Clean up object URL when component is unmounted
  onUnmounted(() => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  });

  return {
    cachedImageUrl,
    isLoading,
    error,
    reload: loadProfilePicture
  };
}
