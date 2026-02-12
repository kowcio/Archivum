import { defineStore } from 'pinia'
import type {Tabs} from 'webextension-polyfill'
import TabService, {type TabsSnapshot } from '@/services/TabService'

const tabService = new TabService()

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
        async getAllOpenedTabs() {
            this.loading = true
            this.error = null
            try {
                this.tabs = await tabService.getAllOpenedTabs()
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while fetching tabs'
            } finally {
                this.loading = false
            }
        },
        async saveAllTabs() {
            this.loading = true
            this.error = null
            try {
                const snapshot: TabsSnapshot = await tabService.saveAllTabs()
                this.tabs = snapshot.tabs
                this.lastSaveDate = snapshot.savedAt
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while saving tabs'
            } finally {
                this.loading = false
            }
        },
        async loadTabsHistory() {
            this.loading = true
            this.error = null
            try {
                const snapshot = await tabService.loadTabsHistory()
                if (snapshot) {
                    this.tabs = snapshot.tabs
                    this.lastSaveDate = snapshot.savedAt
                }
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs history'
            } finally {
                this.loading = false
            }
        },
    },
})

