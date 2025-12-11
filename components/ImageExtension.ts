import Image from '@tiptap/extension-image'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageResizeComponent from './ImageResizeComponent.vue'

export default Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px`
          }
        },
        parseHTML: element => {
            const width = element.getAttribute('width') || element.style.width
            if (!width) return null
            return parseInt(width, 10)
        }
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageResizeComponent)
  },
})
