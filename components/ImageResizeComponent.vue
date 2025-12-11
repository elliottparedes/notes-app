<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps(nodeViewProps)

const startX = ref(0)
const startWidth = ref(0)
const isResizing = ref(false)
const isFocused = ref(false)

const src = computed(() => props.node.attrs.src)
const width = computed(() => props.node.attrs.width)

const updateFocus = () => {
  isFocused.value = props.editor.isFocused
}

onMounted(() => {
  isFocused.value = props.editor.isFocused
  props.editor.on('focus', updateFocus)
  props.editor.on('blur', updateFocus)
})

const onMouseDown = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  
  // Find the image element
  const wrapper = (event.target as HTMLElement).closest('.image-resizer')
  const img = wrapper?.querySelector('img')
  
  if (!img) return

  isResizing.value = true
  startX.value = event.pageX
  // Use current rendered width as starting point
  startWidth.value = img.getBoundingClientRect().width
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return
  
  const currentX = event.pageX
  const diffX = currentX - startX.value
  const newWidth = Math.max(100, Math.round(startWidth.value + diffX)) // Min width 100px
  
  props.updateAttributes({
    width: newWidth,
  })
}

const onMouseUp = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// Cleanup just in case
onUnmounted(() => {
  props.editor.off('focus', updateFocus)
  props.editor.off('blur', updateFocus)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <node-view-wrapper class="image-resizer relative inline-block leading-none max-w-full" :class="{ 'is-selected': props.selected }">
    <img
      :src="src"
      :alt="node.attrs.alt"
      :title="node.attrs.title"
      :style="{ width: typeof width === 'number' ? width + 'px' : width }"
      class="rounded-lg h-auto block transition-shadow duration-200"
      :class="{ 'ring-4 ring-primary-500': props.selected && (isFocused || isResizing) }"
    />
    <div
      class="resize-handle absolute bottom-2 right-2 w-3 h-3 bg-white border border-gray-400 rounded-sm cursor-nwse-resize z-10 shadow-sm hover:bg-primary-500 hover:border-primary-500 transition-colors"
      @mousedown="onMouseDown"
      v-if="props.editor.isEditable"
    ></div>
  </node-view-wrapper>
</template>

<style scoped>
.image-resizer {
  /* Allow the wrapper to be selected (blue border usually) */
  transition: all 0.2s ease;
  line-height: 0;
}

.image-resizer.is-selected img {
  /* box-shadow handled by ring utility class */
}

.resize-handle {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Show handle on hover or selection */
.image-resizer:hover .resize-handle,
.image-resizer.is-selected .resize-handle {
  visibility: visible;
  opacity: 1;
}
</style>
