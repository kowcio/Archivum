import { defineBackground } from 'wxt/utils/define-background'
import { registerService } from '@webext-core/proxy-service'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { BackupService } from '@/services/BackupService'
import { APP_DEFAULTS } from '@/constants'
import { browser } from 'wxt/browser'
import { mockOverrides } from '@/store/appStore'
import { backgroundRPC } from '@/services/BackgroundRPC'

// ⚠️ DEVELOPERS: Type-safe RPC is now the single source of truth for all background ↔ UI communication
// NO MORE manual message routing with if-else chains ✅
// Components use: const bg = createProxyService<BackgroundRPC>('background') for full type safety

export default defineBackground({
  type: 'module',

  main() {
    // ⚠️ CRITICAL: Register ALL background service methods here (one time only)
    // Before: 200+ lines of if-else message handlers ❌
    // After: One registration call ✅
    registerService('background', backgroundRPC)

    // 🧹 Lifecycle
    ExtensionCleanupService.registerLifecycleListeners()

    /**
     * Scheduled alarms using cronns
     */
    // ⏰ Alarms— periodic interval function execution for given schedules / crons
    if (browser.alarms != null) {
      //alarms schedules - crons
      browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, { periodInMinutes: 60 * 24 })
      browser.alarms.create(APP_DEFAULTS.ALARM_BACKUP_TABS, { periodInMinutes: 60 })
      //alarms listeners
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === APP_DEFAULTS.ALARM_UPDATE_TABS) {
          BackgroundTabService.groupTabsByAge()
        }
        if (alarm.name === APP_DEFAULTS.ALARM_BACKUP_TABS) {
          BackupService.backupTabs()
        }
      })
    }

    /**
     * On click when the tab si activated
     */
    // 🖱️ Tab activation — ungroup + move to rightmost
    if (browser.tabs != null) {
      browser.tabs.onActivated.addListener(({ tabId }) => {
        BackgroundTabService.onTabActivated(tabId)
      })
    }


    // ⚠️ DEVELOPERS: Manual message routing removed — see BackgroundRPC.ts for all RPC methods
    // ALL background ↔ UI communication now goes through createProxyService() above ✅
    // Benefits:
    // - No more manual if-else chains
    // - Full type safety in components
    // - Auto error propagation
    // - Refactor-safe (rename-safe across codebase)

    // 🧪 Test helpers: Message handlers that delegate to RPC methods
    // These are called from test/playwright/page-objects/OptionsPage.ts via page.evaluate()
    // page.evaluate() only has access to chrome.runtime API, NOT proxy-service ✅
    // So these handlers use browser.runtime.onMessage to delegate to RPC-registered methods
    //
    // ARCHITECTURE:
    // Playwright Test → page.evaluate(async () => {
    //   chrome.runtime.sendMessage({ action: 'createMockTabs' }, (resp) => { ... })
    // })
    // ↓ serialized message over extension boundary ↓
    // Handler → Calls registered RPC method (same function that UI uses) ✓
    //
    // This ensures test helpers use the SAME implementation as production code,
    // and don't have separate code paths that could diverge.
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof message !== 'object' || !message.action) return
      const { action } = message as { action: string }

      // 🧪 Test helper: Create mock tabs for testing age-based grouping
      // Delegates to: backgroundRPC.createMockTabs
      // Usage: chrome.runtime.sendMessage({ action: 'createMockTabs' }, (r) => { ... })
      // Response: { error: string | null, tabs: Browser.tabs.Tab[] }
      if (action === 'createMockTabs') {
        backgroundRPC.createMockTabs()
          .then((tabs) => sendResponse({ error: null, tabs }))
          .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
        return true
      }

      // 🧪 Test helper: Set mock tab age overrides in storage
      // Delegates to: backgroundRPC.setMockOverrides
      // Usage: chrome.runtime.sendMessage({ action: 'setMockOverrides', overrides: {...} }, (r) => { ... })
      // Reason: Simulates tabs aging (e.g., change lastAccessed to 7 days ago)
      // Response: { error: string | null }
      if (message.action === 'setMockOverrides') {
        const { overrides } = message as { action: string; overrides: Record<number, number> }
        backgroundRPC.setMockOverrides(overrides)
          .then(() => {
            console.log('[background] Mock overrides set:', Object.keys(overrides).length, 'tabs')
            sendResponse({ error: null })
          })
          .catch((err: any) => {
            console.error('[background] Failed to set mock overrides:', err)
            sendResponse({ error: String(err) })
          })
        return true
      }

      // 🧪 Test helper: Get current mock overrides from storage
      // Delegates to: backgroundRPC.getMockOverrides
      // Usage: chrome.runtime.sendMessage({ action: 'getMockOverrides' }, (r) => { ... })
      // Response: { overrides: Record<number, number>, error: string | null }
      if (message.action === 'getMockOverrides') {
        backgroundRPC.getMockOverrides()
          .then((overrides) => {
            console.log('[background] Returning mock overrides:', Object.keys(overrides).length, 'tabs')
            sendResponse({ overrides, error: null })
          })
          .catch((err: any) => {
            console.error('[background] Failed to get mock overrides:', err)
            sendResponse({ overrides: {}, error: String(err) })
          })
        return true
      }
    })

    console.log('[background] ✅ Ready')
  },
})

