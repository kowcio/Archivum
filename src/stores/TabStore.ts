import { defineStore } from 'pinia'
import browser, { type Storage, type Tabs } from 'webextension-polyfill'

const TAB_HISTORY_KEY = 'tab_history'

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
        async getAllOpenedTabs(
            tabsApi: Tabs.Static = browser.tabs,
        ): Promise<Tabs.Tab[]> {
            this.loading = true
            this.error = null
            try {
                this.tabs = await tabsApi.query({})
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while fetching tabs'
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
    },
})
