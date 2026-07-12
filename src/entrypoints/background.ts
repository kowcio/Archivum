import { defineBackground } from 'wxt/utils/define-background'
import { registerService } from '@webext-core/proxy-service'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { BackupService } from '@/services/BackupService'
import { APP_DEFAULTS } from '@/constants'
import { browser } from 'wxt/browser'
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



    console.log('[background] ✅ Ready')
  },
})

