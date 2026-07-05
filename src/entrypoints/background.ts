import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { BackupService } from '@/services/BackupService'
import { APP_DEFAULTS, BACKGROUND_MESSAGE_ACTIONS } from '@/constants'
import { browser } from 'wxt/browser'
import { mockOverrides } from '@/store/appStore'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export { BACKGROUND_MESSAGE_ACTIONS }

export default defineBackground({
  type: 'module',

  main() {
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


    /**
     * Messages from  UI to handel browser API directly by the worker.
     */
    // 💬 Messages from UI (popup, options)
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof message !== 'object' || !message.action) return
      const { action } = message as { action: string }

      if (action === BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE) {
        BackgroundTabService.groupTabsByAge()
          .then((count) => sendResponse({ groupsCreated: count, error: null }))
          .catch((err: any) => sendResponse({ groupsCreated: 0, error: String(err) }))
        return true
      }

      if (action === BACKGROUND_MESSAGE_ACTIONS.SORT_TABS_BY_DOMAIN) {
        BackgroundTabService.sortGroupsByDomain()
          .then((count) => sendResponse({ groupsCreated: count, error: null }))
          .catch((err: any) => sendResponse({ groupsCreated: 0, error: String(err) }))
        return true
      }

      if (action === BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS) {
        BackgroundTabService.ungroupAllTabs()
          .then(() => sendResponse({ error: null }))
          .catch((err: any) => sendResponse({ error: String(err) }))
        return true
      }

       if (action === BACKGROUND_MESSAGE_ACTIONS.CREATE_MOCK_TABS) {
         BackgroundTabService.createMockTabs()
           .then((tabs) => sendResponse({ error: null, tabs }))
           .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
         return true
       }

       if (action === BACKGROUND_MESSAGE_ACTIONS.GET_TABS) {
         BackgroundTabService.getTabs()
           .then((tabs) => sendResponse({ error: null, tabs }))
           .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
         return true
       }

        if (action === BACKGROUND_MESSAGE_ACTIONS.ON_TAB_ACTIVATED) {
          const { tabId } = message as { action: string; tabId: number }
          BackgroundTabService.onTabActivated(tabId)
            .then(() => sendResponse({ error: null }))
            .catch((err: any) => sendResponse({ error: String(err) }))
          return true
        }

        if (action === BACKGROUND_MESSAGE_ACTIONS.HAS_PLUGIN_GROUPS) {
          BackgroundTabService.hasPluginGroups()
            .then((has) => sendResponse({ hasPluginGroups: has, error: null }))
            .catch((err: any) => sendResponse({ hasPluginGroups: false, error: String(err) }))
          return true
        }

          if (action === BACKGROUND_MESSAGE_ACTIONS.CLOSE_TAB) {
            const { tabId } = message as { action: string; tabId: number }
            BackgroundTabService.closeTab(tabId)
              .then((error) => sendResponse({ error }))
              .catch((err: any) => sendResponse({ error: String(err) }))
            return true
          }

          if (action === BACKGROUND_MESSAGE_ACTIONS.FOCUS_TAB) {
            const { tabId } = message as { action: string; tabId: number }
            BackgroundTabService.focusTab(tabId)
              .then((error) => sendResponse({ error }))
              .catch((err: any) => sendResponse({ error: String(err) }))
            return true
          }

         if (action === BACKGROUND_MESSAGE_ACTIONS.BACKUP_TABS) {
           BackupService.backupTabs()
             .then((backup) => sendResponse({ success: true, count: backup.count }))
             .catch((err: any) => sendResponse({ success: false, count: 0, error: String(err) }))
           return true
         }

         if (action === BACKGROUND_MESSAGE_ACTIONS.RESTORE_TABS) {
           BackupService.restoreTabs()
             .then(() => sendResponse({ success: true }))
             .catch((err: any) => sendResponse({ success: false, error: String(err) }))
           return true
         }

        // 🧪 Test helper: Set mock overrides for created tabs
        if (action === 'setMockOverrides') {
         const { overrides } = message as { action: string; overrides: Record<number, number> }
         mockOverrides.setValue(overrides)
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

       // 🧪 Test helper: Get mock overrides (for inspection in tests)
       if (action === 'getMockOverrides') {
         mockOverrides.getValue()
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

