import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

/**
 * Global Y.Doc manager to ensure single instance per note
 * Prevents "Type already defined" errors from multiple Y.Doc instances
 */

interface YDocInstance {
  doc: Y.Doc
  provider: WebsocketProvider | null
  refCount: number
  createdAt: number
}

class YDocManager {
  private instances: Map<string, YDocInstance> = new Map()

  /**
   * Get or create a Y.Doc for a specific note
   */
  getDoc(noteId: string): Y.Doc {
    const shortId = noteId.substring(0, 20)
    console.log(`[YDocManager] 📥 Getting Y.Doc for note: ${shortId}...`)
    
    // Log all existing instances for debugging
    if (this.instances.size > 0) {
      console.log(`[YDocManager] 📊 Existing instances:`, Array.from(this.instances.keys()).map(k => k.substring(0, 20)))
    }
    
    if (this.instances.has(noteId)) {
      const instance = this.instances.get(noteId)!
      const connectedUsers = instance.provider?.awareness?.getStates().size || 0
      
      instance.refCount++
      console.log(`[YDocManager] ♻️ REUSING existing Y.Doc (refCount: ${instance.refCount}, wsUsers: ${connectedUsers})`)
      return instance.doc
    }

    console.log(`[YDocManager] 🆕 CREATING NEW Y.Doc (first time for this note)`)
    const doc = new Y.Doc()
    this.instances.set(noteId, {
      doc,
      provider: null,
      refCount: 1,
      createdAt: Date.now()
    })

    return doc
  }

  /**
   * Set the provider for a Y.Doc
   */
  setProvider(noteId: string, provider: WebsocketProvider) {
    const instance = this.instances.get(noteId)
    if (instance) {
      console.log(`[YDocManager] 📡 Setting provider for note: ${noteId}`)
      instance.provider = provider
    }
  }

  /**
   * Release a Y.Doc reference (decrement ref count)
   */
  releaseDoc(noteId: string) {
    const instance = this.instances.get(noteId)
    if (!instance) {
      console.warn(`[YDocManager] ⚠️ Attempted to release non-existent Y.Doc: ${noteId}`)
      return
    }

    instance.refCount--
    console.log(`[YDocManager] 📉 Released Y.Doc reference (refCount: ${instance.refCount})`)

    // Check if other users are still connected via WebSocket
    const connectedUsers = instance.provider?.awareness?.getStates().size || 0
    console.log(`[YDocManager] 👥 WebSocket connected users: ${connectedUsers}`)

    // Only destroy if:
    // 1. No more component references AND
    // 2. No other users connected via WebSocket (or disconnected)
    if (instance.refCount <= 0) {
      if (connectedUsers <= 1) {
        console.log(`[YDocManager] 🗑️ No more references and no other users, destroying Y.Doc for: ${noteId}`)
        
        try {
          // Destroy provider first
          if (instance.provider) {
            instance.provider.destroy()
          }
          
          // Destroy doc
          instance.doc.destroy()
          
          // Remove from registry
          this.instances.delete(noteId)
          
          console.log(`[YDocManager] ✅ Successfully destroyed Y.Doc`)
        } catch (error) {
          console.error(`[YDocManager] ❌ Error destroying Y.Doc:`, error)
        }
      } else {
        console.log(`[YDocManager] ⏸️ Other users still connected, keeping Y.Doc alive (will retry on next release)`)
        // Keep refCount at 0 so it will be cleaned up when last user disconnects
        instance.refCount = 0
      }
    }
  }

  /**
   * Force cleanup of stale Y.Docs (older than 5 minutes with refCount 0)
   */
  cleanupStale() {
    const now = Date.now()
    const STALE_THRESHOLD = 5 * 60 * 1000 // 5 minutes

    for (const [noteId, instance] of this.instances.entries()) {
      if (instance.refCount <= 0 && now - instance.createdAt > STALE_THRESHOLD) {
        console.log(`[YDocManager] 🧹 Cleaning up stale Y.Doc: ${noteId}`)
        this.releaseDoc(noteId)
      }
    }
  }

  /**
   * Get debug info about all Y.Docs
   */
  getDebugInfo() {
    const info: Record<string, any> = {}
    for (const [noteId, instance] of this.instances.entries()) {
      info[noteId] = {
        refCount: instance.refCount,
        hasProvider: !!instance.provider,
        age: Math.floor((Date.now() - instance.createdAt) / 1000) + 's'
      }
    }
    return info
  }

  /**
   * Force destroy a Y.Doc (for schema migration)
   * This will force a fresh Y.Doc on next access
   */
  forceDestroy(noteId: string) {
    console.log(`[YDocManager] 🔄 Force destroying Y.Doc for: ${noteId}`)
    const instance = this.instances.get(noteId)
    if (instance) {
      try {
        // Disconnect and destroy provider
        if (instance.provider) {
          instance.provider.disconnect()
          instance.provider.destroy()
        }
        // Destroy the doc
        instance.doc.destroy()
        // Remove from registry
        this.instances.delete(noteId)
        console.log(`[YDocManager] ✅ Y.Doc force destroyed`)
        return true
      } catch (error) {
        console.error(`[YDocManager] ❌ Error force destroying Y.Doc:`, error)
        return false
      }
    }
    console.log(`[YDocManager] ⚠️ Y.Doc not found for: ${noteId}`)
    return false
  }
}

// Create singleton instance
const ydocManager = new YDocManager()

// Cleanup stale docs every 2 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    ydocManager.cleanupStale()
  }, 2 * 60 * 1000)
  
  // Expose to window for debugging
  ;(window as any).__ydocManager = ydocManager
  console.log('[YDocManager] 🌍 Exposed to window.__ydocManager for debugging')
}

export default ydocManager

