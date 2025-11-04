import { ref } from 'vue'
import type { Attachment } from '~/models'

// Global state for attachment uploads
const uploadedAttachment = ref<Attachment | null>(null)
const uploadCallbacks = new Set<(attachment: Attachment) => void | Promise<void>>()

export const useAttachmentUpload = () => {
  const notifyUpload = async (attachment: Attachment) => {
    uploadedAttachment.value = attachment
    // Call all registered callbacks
    for (const callback of uploadCallbacks) {
      try {
        await callback(attachment)
      } catch (error) {
        console.error('[useAttachmentUpload] Callback error:', error)
      }
    }
  }

  const onUpload = (callback: (attachment: Attachment) => void | Promise<void>) => {
    uploadCallbacks.add(callback)
    // Return cleanup function
    return () => {
      uploadCallbacks.delete(callback)
    }
  }

  return {
    uploadedAttachment,
    notifyUpload,
    onUpload
  }
}

