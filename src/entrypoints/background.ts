import {defineBackground} from 'wxt/utils/define-background'
import {registerService} from '@webext-core/proxy-service'
import {ExtensionCleanupService} from '@/services/ExtensionCleanupService'
import {BackgroundTabService} from '@/services/BackgroundTabService'
import {APP_DEFAULTS} from '@/constants'
import {browser} from 'wxt/browser'
import {backgroundRPC} from '@/services/BackgroundRPC'
import {StorageRepository} from '@/store'

const ALARM_PERIOD_24H = { periodInMinutes: 60 * 24 }

export default defineBackground({
  type: 'module',

  main() {
    registerService('background', backgroundRPC)
    ExtensionCleanupService.registerLifecycleListeners()

    if (browser.alarms != null) {
      browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, ALARM_PERIOD_24H)
      browser.alarms.create(APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS, ALARM_PERIOD_24H)

      browser.alarms.onAlarm.addListener((alarm) => {
        void (async () => {
          const startedAt = Date.now()
          const logAlarm = async (
            event: 'alarm.triggered' | 'alarm.completed' | 'alarm.failed' | 'alarm.auto_close_skipped',
            status: 'started' | 'completed' | 'failed' | 'skipped' | 'info',
            data: Record<string, unknown>,
          ): Promise<void> => {
            await StorageRepository.logActivity({
              event,
              source: 'background.alarm',
              status,
              data,
            })
          }

          await logAlarm('alarm.triggered', 'started', { alarmName: alarm.name })
          try {
            switch (alarm.name) {
              case APP_DEFAULTS.ALARM_UPDATE_TABS: {
                const tabsMoved = await BackgroundTabService.updateTabByAge()
                await logAlarm('alarm.completed', 'completed', {
                  alarmName: alarm.name,
                  tabsMoved,
                  durationMs: Date.now() - startedAt,
                })
                break
              }
              case APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS: {
                const state = await StorageRepository.getAppState()
                if (!state?.autoClose) {
                  await logAlarm('alarm.auto_close_skipped', 'skipped', { reason: 'autoClose disabled' })
                  await logAlarm('alarm.completed', 'completed', {
                    alarmName: alarm.name,
                    closedCount: 0,
                    skipped: true,
                    durationMs: Date.now() - startedAt,
                  })
                  break
                }
                const closedCount = await BackgroundTabService.autoCloseOldestGroupTabs()
                await logAlarm('alarm.completed', 'completed', {
                  alarmName: alarm.name,
                  closedCount,
                  skipped: false,
                  durationMs: Date.now() - startedAt,
                })
                break
              }
              default:
                await logAlarm('alarm.completed', 'completed', {
                  alarmName: alarm.name,
                  ignored: true,
                  durationMs: Date.now() - startedAt,
                })
                break
            }
          } catch (err) {
            await logAlarm('alarm.failed', 'failed', {
              alarmName: alarm.name,
              durationMs: Date.now() - startedAt,
              error: err instanceof Error ? err.message : String(err),
            })
            throw err
          }
        })().catch((err) => {
          console.error('[background] ❌ Alarm handler failed:', err)
        })
      })
    }

    if (browser.tabs != null) {
      browser.tabs.onActivated.addListener(({tabId}) => {
        void BackgroundTabService.onTabActivated(tabId).catch((err) => {
          console.error('[background] ❌ onTabActivated failed:', err)
        })
      })
    }

    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action !== 'debug') return
      void BackgroundTabService.autoCloseOldestGroupTabs()
        .then((result) => sendResponse({success: true, closed: result}))
        .catch((err) => sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }))
      return true
    })

    console.log('[background] ✅ Ready')
  },
})
