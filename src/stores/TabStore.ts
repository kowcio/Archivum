import { defineStore } from 'pinia'
import browser, { type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { TabDot, TabDots, DOT_COLOR_MAP } from '@/services/TabDots.ts'
import { useGlobalStore, DEFAULT_THRESHOLDS } from '@/stores/globalStore'

const TAB_HISTORY_KEY = 'tab_history'

export interface AgeClassification {
    cssClass: string
    color: string
    days: number
    dot: TabDot
}

export interface TabsSnapshot {
    tabs: Tabs.Tab[]
    savedAt: string
}

type Nullable<T> = T | null

export interface TabState {
    tabs: Tabs.Tab[]
    lastSaveDate: Nullable<string>
    loading: boolean
    error: Nullable<string>
}

export const useTabStore = defineStore('tabStore', {
    state: (): TabState => ({
        tabs: [],
        lastSaveDate: null,
        loading: false,
        error: null,
    }),
    actions: {
        async getAllOpenedTabs(): Promise<Tabs.Tab[]> {
            this.loading = true
            this.error = null
            try {
                const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
                this.tabs = fetchedTabs
                console.log('Loaded tabs:', fetchedTabs)
                return fetchedTabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs'
                return []
            } finally {
                this.loading = false
            }
        },
        async closeTab(
            tabId: number,
            tabsApi: Tabs.Static = browser.tabs,
        ): Promise<Tabs.Tab[]> {
            this.error = null
            try {
                await tabsApi.remove(tabId)
                this.tabs = this.tabs.filter((t) => t.id !== tabId)
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while closing tab'
                return this.tabs
            }
        },
        async updateTab(
            tabId: number,
            updateProperties: Tabs.UpdateUpdatePropertiesType,
            tabsApi: Tabs.Static = browser.tabs,
        ): Promise<Tabs.Tab | undefined> {
            this.error = null
            try {
                return await tabsApi.update(tabId, updateProperties)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while updating tab'
                return undefined
            }
        },
        async saveAllTabs(
            storage: Storage.StorageArea = browser.storage.local,
        ): Promise<TabsSnapshot | undefined> {
            this.loading = true
            this.error = null
            try {
                const savedAt = new Date().toISOString()
                const snapshot: TabsSnapshot = { tabs: this.tabs, savedAt }
                await storage.set({ [TAB_HISTORY_KEY]: snapshot })
                this.lastSaveDate = savedAt
                return snapshot
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while saving tabs'
                return undefined
            } finally {
                this.loading = false
            }
        },
        async loadTabsHistory(
            storage: Storage.StorageArea = browser.storage.local,
        ): Promise<TabsSnapshot | undefined> {
            this.loading = true
            this.error = null
            try {
                const result = await storage.get(TAB_HISTORY_KEY)
                const snapshot = result?.[TAB_HISTORY_KEY] as TabsSnapshot | undefined
                if (snapshot) {
                    this.tabs = snapshot.tabs
                    this.lastSaveDate = snapshot.savedAt
                }
                return snapshot
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs history'
                return undefined
            } finally {
                this.loading = false
            }
        },

        getAgeClassification(
            row: TabRow,
            boundaries: readonly [number, number, number] = [
                DEFAULT_THRESHOLDS.young,
                DEFAULT_THRESHOLDS.middle,
                DEFAULT_THRESHOLDS.old,
            ],
        ): AgeClassification {
            const days = Number.isFinite(row.lastAccessDays) ? row.lastAccessDays ?? 0 : 0
            const index = boundaries.findIndex((t) => days <= t)
            const resolved = index !== -1 ? DOT_COLOR_MAP[index] : DOT_COLOR_MAP[DOT_COLOR_MAP.length - 1]
            return { ...resolved, days }
        },

        getLastAccessMsg(row: TabRow): string {
            const { days } = this.getAgeClassification(row)
            if (!Number.isFinite(days)) return '—'
            return days === 1 ? '1 day ago' : `${days} days ago`
        },

        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const boundaries = useGlobalStore().thresholdsArray
                const tabRows = TabRow.fromTabs(this.tabs)
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        const { color, dot } = this.getAgeClassification(row, boundaries)
                        if (dot) {
                            await this.markTabWithTitle(row.id, `${dot} `)
                            await this.markTabWithBadge(row.id, dot, color)
                        } else {
                            await this.resetTabTitle(row.id)
                            await this.unmarkTabBadge(row.id)
                        }
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
            }
        },


        async markTabWithColorDot(tabId: number, color: string = '#e53935'): Promise<void> {
            this.error = null
            try {
                const dot = this.getDotFromColor(color)
                const prefix = dot ? `${dot} ` : ''
                if (!prefix) return
                await this.markTabWithTitle(tabId, prefix)
                await this.markTabWithBadge(tabId, dot, color)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking tab with color dot'
            }
        },

        async markTabWithTitle(tabId: number, prefix: string = '🔴 '): Promise<void> {
            this.error = null
            try {
                const trimmedPrefix = prefix.trim()
                if (!trimmedPrefix) {
                    await this.unmarkTabTitle(tabId)
                    return
                }
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.applyPrefixPageScript,
                    args: [prefix, TabDots.dotValues],
                })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking tab title'
            }
        },

        async markTabWithBadge(tabId: number, text: string = '●', color: string = '#e53935'): Promise<void> {
            this.error = null
            try {
                await browser.action.setBadgeText({ text, tabId })
                await browser.action.setBadgeBackgroundColor({ color, tabId })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking tab badge'
            }
        },

        async unmarkTabFavicon(tabId: number): Promise<void> {
            this.error = null
            try {
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        document.querySelector<HTMLLinkElement>('link[data-ext-marker]')?.remove()
                    },
                    args: [],
                })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while unmarking tab favicon'
            }
        },

        async unmarkTabBadge(tabId: number): Promise<void> {
            this.error = null
            try {
                await browser.action.setBadgeText({ text: '', tabId })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while unmarking tab badge'
            }
        },

        async unmarkTabTitle(tabId: number): Promise<void> {
            this.error = null
            try {
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.removePrefixPageScript,
                    args: [TabDots.dotValues],
                })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while unmarking tab title'
            }
        },

        async resetTabTitle(tabId: number): Promise<void> {
            this.error = null
            try {
                await this.unmarkTabTitle(tabId)
                await this.unmarkTabFavicon(tabId)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting tab title'
            }
        },

        async resetAllTabTitles(): Promise<void> {
            this.error = null
            try {
                const tabRows = TabRow.fromTabs(this.tabs)
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        await this.resetTabTitle(row.id)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting all tab titles'
            }
        },

        async resetAllTabMarks(): Promise<void> {
            this.error = null
            try {
                const tabRows = TabRow.fromTabs(this.tabs)
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        await this.resetTabTitle(row.id)
                        await this.unmarkTabBadge(row.id)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting all tab marks'
            }
        },

        async clearDotsFromOpenTabs(): Promise<void> {
            this.error = null
            try {
                const tabRows = TabRow.fromTabs(this.tabs)
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        await this.resetTabTitle(row.id)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while clearing dots from open tabs'
            }
        },

        getDotFromColor(color: string): string {
            return TabDots.dotFromColor(color)
        },
    },
})
