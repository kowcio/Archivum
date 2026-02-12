import browser, {type Storage, type Tabs } from 'webextension-polyfill'

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
}
