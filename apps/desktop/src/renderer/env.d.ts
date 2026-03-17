import type { FlowforgeAPI } from '../preload/index'

declare global {
  interface Window {
    flowforge: FlowforgeAPI
  }
}
