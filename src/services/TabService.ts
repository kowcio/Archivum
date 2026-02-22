import browser, {type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'

export interface AgeClassification {
    cssClass: string
    color: string
    days: number
    dot: string
}

export interface TabsSnapshot {
    tabs: Tabs.Tab[]
    savedAt: string
}

const TAB_HISTORY_KEY = 'tab_history'

export default class TabService {
    constructor(
        private readonly tabsApi: Tabs.Static = browser.tabs,
        private readonly storage: Storage.StorageArea = browser.storage.local,
    ) {}

    async getAllOpenedTabs(): Promise<Tabs.Tab[]> {
        return this.tabsApi.query({})
    }

    async closeTab(tabId: number): Promise<void> {
        await this.tabsApi.remove(tabId)
    }

    async updateTab(tabId: number, updateProperties: Tabs.UpdateUpdatePropertiesType): Promise<Tabs.Tab> {
        return this.tabsApi.update(tabId, updateProperties)
    }

    async saveAllTabs(): Promise<TabsSnapshot> {
        const tabs = await this.getAllOpenedTabs()
        const savedAt = new Date().toISOString()
        const snapshot: TabsSnapshot = { tabs, savedAt }
        await this.storage.set({ [TAB_HISTORY_KEY]: snapshot })
        return snapshot
    }

    async loadTabsHistory(): Promise<TabsSnapshot | null> {
        const result = await this.storage.get(TAB_HISTORY_KEY)
        const snapshot = result?.[TAB_HISTORY_KEY] as TabsSnapshot | undefined
        return snapshot ?? null
    }

    removeAllAfterLastDash(text: string): string {
        if (!text) return text
        const lastIndex = text.lastIndexOf('-')
        return lastIndex !== -1 ? text.slice(0, lastIndex).trim() : text
    }

    getAgeClassification(row: TabRow): AgeClassification {
        const days = Number.isFinite(row.lastAccessDays) ? row.lastAccessDays ?? 0 : 0

        // if (days <= 7) return { cssClass: 'bg-green-2 text-green-10', color: '#66bb6a', days, dot: '🟢' }
        if (days <= 7) return { cssClass: 'bg-green-2 text-green-10', color: '#66bb6a', days, dot: '' }
        if (days <= 14) return { cssClass: 'bg-amber-2 text-amber-10', color: '#f2c037', days, dot: '🟡' }
        if (days <= 21) return { cssClass: 'bg-orange-2 text-orange-10', color: '#fb8c00', days, dot: '🟠' }
        return { cssClass: 'bg-red-2 text-red-10', color: '#e53935', days, dot: '🔴' }
    }

    getLastAccessMsg(row: TabRow): string {
        const { days } = this.getAgeClassification(row)
        if (!Number.isFinite(days)) return '—'
        return days === 1 ? '1 day ago' : `${days} days ago`
    }

    async markOldTabs(): Promise<void> {
        const openTabs = await this.getAllOpenedTabs()
        const tabRows = TabRow.fromTabs(openTabs)

        await Promise.all(
            tabRows.map(async (row) => {
                if (row.id == null) return
                const { color, dot } = this.getAgeClassification(row)
                await this.markTabWithTitle(row.id, `${dot} `)
                await this.markTabWithBadge(row.id, dot, color)
            }),
        )
    }

    async markOldTabsWithAgeThreshold(thresholdDays: number): Promise<void> {
        const openTabs = await this.getAllOpenedTabs()
        const tabRows = TabRow.fromTabs(openTabs)

        await Promise.all(
            tabRows.map(async (row) => {
                if (row.id == null) return
                const { color, dot } = this.getAgeClassification(row)
                // Only mark tabs that are older than the threshold
                if ((row.lastAccessDays ?? 0) >= thresholdDays) {
                    await this.markTabWithTitle(row.id, `${dot} `)
                    await this.markTabWithBadge(row.id, dot, color)
                } else {
                    // Clear any existing marks for tabs younger than threshold
                    await this.unmarkTabFavicon(row.id)
                    await this.unmarkTabBadge(row.id)
                }
            }),
        )
    }

    async markTabWithColorDot(tabId: number, color: string = '#e53935'): Promise<void> {
        await this.markTabWithTitle(tabId, `${this.getDotFromColor(color)} `)
        await this.markTabWithBadge(tabId, this.getDotFromColor(color), color)
    }

    async markTabWithTitle(tabId: number, prefix: string = '🔴 '): Promise<void> {
        await browser.scripting.executeScript({
            target: { tabId },
            func: (p: string) => {
                const currentTitle = document.title
                if (currentTitle.startsWith(p)) return
                document.title = `${p}${currentTitle}`
            },
            args: [prefix],
        })
    }

    async markTabWithBadge(tabId: number, text: string = '●', color: string = '#e53935'): Promise<void> {
        await browser.action.setBadgeText({ text, tabId })
        await browser.action.setBadgeBackgroundColor({ color, tabId })
    }

    async unmarkTabFavicon(tabId: number): Promise<void> {
        await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                document.querySelector<HTMLLinkElement>('link[data-ext-marker]')?.remove()
            },
            args: [],
        })
    }

    async unmarkTabBadge(tabId: number): Promise<void> {
        await browser.action.setBadgeText({ text: '', tabId })
    }

    private getDotFromColor(color: string): string {
        if (color === '#66bb6a') return '🟢'
        if (color === '#f2c037') return '🟡'
        if (color === '#fb8c00') return '🟠'
        return '🔴'
    }
}
