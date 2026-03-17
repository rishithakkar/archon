import type { ArchonAPI } from '../preload/index'

declare global {
  interface Window {
    archon: ArchonAPI
  }
}
