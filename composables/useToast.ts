import { push } from 'notivue'

interface ToastOptions {
  title: string
  description?: string
  color?: 'success' | 'error' | 'warning' | 'info' | 'neutral'
  duration?: number
}

/**
 * Custom composable to replace @nuxt/ui's useToast with Notivue
 * This provides backward compatibility while using Notivue under the hood
 */
export const useToast = () => {
  const add = (options: ToastOptions) => {
    const { title, description, color = 'info', duration } = options
    
    // Map color to Notivue's type
    let type: 'success' | 'error' | 'warning' | 'info' = 'info'
    
    switch (color) {
      case 'success':
        type = 'success'
        break
      case 'error':
        type = 'error'
        break
      case 'warning':
        type = 'warning'
        break
      case 'info':
      case 'neutral':
      default:
        type = 'info'
        break
    }
    
    // Create the message - combine title and description
    const message = description ? `${title}: ${description}` : title
    
    // Push notification using Notivue
    // Pass duration to override global config if needed
    push[type]({
      message,
      duration: duration || 1500 // Default to 1.5 seconds for faster dismissal
    })
  }
  
  return {
    add
  }
}

