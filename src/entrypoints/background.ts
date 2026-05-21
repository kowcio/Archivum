import browser from 'webextension-polyfill'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { TabUpdateService } from '@/services/TabUpdateService'

// Make browser API available globally
if (typeof window !== 'undefined') {
  (window as any).browser = browser
}

// Unique debug token for background (searchable by tests/logs)
console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export default defineBackground(() => {
  console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

  // 🧹 Register extension lifecycle listeners for cleanup on disable/uninstall
  ExtensionCleanupService.registerLifecycleListeners()

  // 🔄 Start daily tab update service (every 24 hours)
  // Automatically loads tabs + marks old ones via TabStore methods
  TabUpdateService.startDailyUpdate(24 * 60 * 60 * 1000)
})
