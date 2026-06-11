import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { mockOverrides } from '@/utils/mockStorage'
import { APP_DEFAULTS } from '@/constants'
import { browser } from 'wxt/browser'
import { MOCK_TABS, MOCK_DAYS } from '@/utils/mockTabData'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export default defineBackground({
  type: 'module',

  main() {
    // 🧹 Lifecycle
    ExtensionCleanupService.registerLifecycleListeners()

    // ⏰ Daily alarm — group tabs by age
    if (browser.alarms != null) {
      browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, { periodInMinutes: 24 * 60 })
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return
        BackgroundTabService.groupTabsByAge()
      })
    }

    // 🖱️ Tab activation — ungroup + move to rightmost
    if (browser.tabs != null) {
      browser.tabs.onActivated.addListener(({ tabId }) => {
        BackgroundTabService.onTabActivated(tabId)
      })
    }

    // 💬 Messages from UI (popup, options)
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof message !== 'object' || !message.action) return
      const { action } = message as { action: string }

      if (action === 'groupTabsByAge') {
        BackgroundTabService.groupTabsByAge()
          .then((count) => sendResponse({ groupsCreated: count, error: null }))
          .catch((err: any) => sendResponse({ groupsCreated: 0, error: String(err) }))
        return true
      }

      if (action === 'ungroupAllTabs') {
        BackgroundTabService.ungroupAllTabs()
          .then(() => sendResponse({ error: null }))
          .catch((err: any) => sendResponse({ error: String(err) }))
        return true
      }

      if (action === 'createMockTabs') {
        createMockTabs()
          .then((tabs) => sendResponse({ error: null, tabs: JSON.parse(JSON.stringify(tabs)) }))
          .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
        return true
      }

      if (action === 'getTabs') {
        BackgroundTabService.getTabs()
          .then((tabs) => sendResponse({ error: null, tabs: JSON.parse(JSON.stringify(tabs)) }))
          .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
        return true
      }

      if (action === 'getBrowserCaps') {
        sendResponse({
          hasTabGroups: browser.tabGroups != null,
          hasAlarms: browser.alarms != null,
        })
        return true
      }
    })

    console.log('[background] ✅ Ready')
  },
})

/**
 * Creates mock tabs using realistic data from tabs_example.json.
 * Each tab gets a backdated lastAccessed for testing grouping.
 * Returns the created tabs with overrides already applied so the UI sees correct data.
 */
async function createMockTabs(): Promise<Browser.tabs.Tab[]> {
  const now = Date.now()
  const DAY_MS = 86400000
  const tabIds: number[] = []

  // Create tabs using realistic mock data
  for (let i = 0; i < MOCK_TABS.length; i++) {
    const mock = MOCK_TABS[i]
    try {
      const tab = await browser.tabs.create({
        url: mock.url,
        active: false,
      })
      if (tab.id != null) tabIds.push(tab.id)
    } catch {
      // Some URLs may fail — create simpler tabs as fallback
      const tab = await browser.tabs.create({ url: `https://example.com/mock-${i}`, active: false })
      if (tab.id != null) tabIds.push(tab.id)
    }
  }

  // Store mock overrides — applied on next groupTabsByAge
  const overrides: Record<number, number> = {}
  for (let i = 0; i < tabIds.length; i++) {
    overrides[tabIds[i]] = now - MOCK_DAYS[i] * DAY_MS
  }
  await mockOverrides.setValue(overrides)

  // Re-query and apply overrides so returned tabs have correct lastAccessed
  const allTabs = await browser.tabs.query({ currentWindow: true })
  const applied: Browser.tabs.Tab[] = []
  for (const tab of allTabs) {
    if (tab.id != null && overrides[tab.id] != null) {
      applied.push({ ...(tab as any), lastAccessed: overrides[tab.id] })
    } else {
      applied.push(tab)
    }
  }
  console.log(`[background] Created ${tabIds.length} mock tabs with backdated lastAccessed`)
  return applied
}
