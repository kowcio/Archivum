import browser, {type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { APP_DEFAULTS } from '@/constants'

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

const TAB_HISTORY_KEY = APP_DEFAULTS.TAB_HISTORY_KEY

export default class TabService {
    constructor(
        private readonly tabsApi: Tabs.Static = browser.tabs,
        private readonly storage: Storage.StorageArea = browser.storage.local,
    ) {}

    async getAllOpenedTabs(): Promise<Tabs.Tab[]> {
        return this.tabsApi.query({})
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
                if (dot) {
                    await this.markTabWithTitle(row.id, `${dot} `)
                    await this.markTabWithBadge(row.id, dot, color)
                } else {
                    await this.resetTabTitle(row.id)
                    await this.unmarkTabBadge(row.id)
                }
            }),
        )
    }

    async markTabWithTitle(tabId: number, prefix: string = '🔴 '): Promise<void> {
        const trimmedPrefix = prefix.trim()
        if (!trimmedPrefix) {
            await this.unmarkTabTitle(tabId)
            return
        }
        await browser.scripting.executeScript({
            target: { tabId },
            func: (p: string) => {
                const dots = ['🟢', '🟡', '🟠', '🔴', '●']
                const escapedDots = dots.map((dot) => dot.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')
                const dotPattern = new RegExp(`^(${escapedDots})\\s+`)
                const currentTitle = document.title.replace(dotPattern, '').trimStart()
                if (currentTitle.startsWith(p.trim())) {
                    document.title = `${p}${currentTitle.replace(p.trim(), '').trimStart()}`
                    return
                }
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

    async unmarkTabTitle(tabId: number): Promise<void> {
        await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                const dots = ['🟢', '🟡', '🟠', '🔴', '●']
                const escapedDots = dots.map((dot) => dot.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')
                const dotPattern = new RegExp(`^(${escapedDots})\\s+`)
                document.title = document.title.replace(dotPattern, '').trimStart()
            },
            args: [],
        })
    }

    async resetTabTitle(tabId: number): Promise<void> {
        await this.unmarkTabTitle(tabId)
        await this.unmarkTabFavicon(tabId)
    }

    async resetAllTabTitles(): Promise<void> {
        const openTabs = await this.getAllOpenedTabs()
        const tabRows = TabRow.fromTabs(openTabs)

        await Promise.all(
            tabRows.map(async (row) => {
                if (row.id == null) return
                await this.resetTabTitle(row.id)
            }),
        )
    }

}
