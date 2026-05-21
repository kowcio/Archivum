import browser from 'webextension-polyfill'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'

// Make browser API available globally
if (typeof window !== 'undefined') {
  (window as any).browser = browser
}

// Unique debug token for background (searchable by tests/logs)
console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export default defineBackground({
  main() {
    console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

    // 🧹 Register extension lifecycle listeners for cleanup on disable/uninstall
    ExtensionCleanupService.registerLifecycleListeners()
  },
})
