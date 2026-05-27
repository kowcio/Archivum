import { defineStore } from 'pinia'
import browser, { type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { TabDots } from '@/services/TabDots.ts'
import { useGlobalStore, DEFAULT_THRESHOLDS } from '@/stores/globalStore'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { APP_DEFAULTS } from '@/constants'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import { ClassifiedTabFactory } from '@/models/tabs/ClassifiedTab'
import { TabsSnapshot } from '@/models/tabs/TabsSnapshot'

// Re-export models consumed by external code (App.vue, tests)
export type { ClassifiedTab }
export { AgeClassification, TabsSnapshot }

/**
 * TabRow enriched with display-only fields computed at render time.
 * Returned by the tabRows getter — use this type in components.
 */
export type EnrichedTabRow = TabRow & {
    /** 1-based position in the sorted list */
    ordinal: number
    /** Human-readable age string e.g. "10d" or "—" */
    lastAccessAge: string
}

type Nullable<T> = T | null

export type TabState = {
    tabs: ClassifiedTab[]
    loading: boolean
    error: Nullable<string>
    isGrouped: boolean
}

export const useTabStore = defineStore('tabStore', {
    state: (): TabState => ({
        tabs: [],
        loading: false,
        error: null,
        isGrouped: false,
    }),

    getters: {
        /**
         * Sorted, enriched tab rows ready for display in the table.
         * Sort order: youngest first → oldest last. Tabs without timestamp go to end.
         */
        tabRows(): EnrichedTabRow[] {
            const globalStore = useGlobalStore()
            const boundaries = globalStore.thresholdsArray

            const sorted = [...this.tabs].sort(
                (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
            )

            return TabRow.fromTabs(sorted, boundaries).map((row, index) => {
                const days = Number.isFinite(row.lastAccessDays) ? (row.lastAccessDays ?? 0) : 0
                const classification = AgeClassification.fromDays(days, boundaries)
                return {
                    ...row,
                    ordinal: index + 1,
                    lastAccessAge: Number.isFinite(row.lastAccessDays) ? `${row.lastAccessDays}d` : '—',
                    lastAccessClass: classification.cssClass,
                } as EnrichedTabRow
            })
        },
    },

    actions: {
        /**
         * Fetches current window tabs, merges with store state, marks old tabs.
         * Favicons are already loaded by the browser at query time — no polling needed.
         */
        async getAllOpenedTabs(): Promise<ClassifiedTab[]> {
            this.loading = true
            this.error = null
            try {
                const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })

                // Merge: preserve lastAccessed from store for tabs already known
                const existingById = new Map(this.tabs.map(t => [t.id, t]))
                this.tabs = fetchedTabs.map(fetchedTab => {
                    const existing = fetchedTab.id != null ? existingById.get(fetchedTab.id) : undefined
                    const base = ClassifiedTabFactory.fromTab(fetchedTab, false)
                    return existing != null
                        ? { ...base, lastAccessed: existing.lastAccessed ?? fetchedTab.lastAccessed }
                        : base
                })

                await this.markOldTabs()

                console.log('[getAllOpenedTabs] Loaded:', this.tabs.length, {
                    withFavicons: this.tabs.filter(t => t.favIconUrl).length,
                    marked: this.tabs.filter(t => t.isMarked).length,
                })
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs'
                return []
            } finally {
                this.loading = false
            }
        },

        async closeTab(tabId: number, tabsApi: Tabs.Static = browser.tabs): Promise<ClassifiedTab[]> {
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

        /**
         * Hydrates store from the last background-written snapshot in storage.
         * Called on UI mount for crash recovery — background writes this automatically.
         */
        async loadTabsHistory(storage: Storage.StorageArea = browser.storage.local): Promise<ClassifiedTab[]> {
            this.loading = true
            this.error = null
            try {
                const result = await storage.get(APP_DEFAULTS.TAB_HISTORY_KEY)
                const snapshot = result?.[APP_DEFAULTS.TAB_HISTORY_KEY] as TabsSnapshot | undefined
                if (snapshot) {
                    const rawTabs: Tabs.Tab[] = Array.isArray(snapshot.tabs)
                        ? snapshot.tabs
                        : Object.values(snapshot.tabs as Record<string, Tabs.Tab>)
                    this.tabs = ClassifiedTabFactory.fromTabs(rawTabs)
                    console.log('[loadTabsHistory] Restored', this.tabs.length, 'tabs from storage')
                }
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs history'
                return []
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
            return AgeClassification.fromDays(days, boundaries)
        },

        getLastAccessMsg(row: TabRow): string {
            const days = Number.isFinite(row.lastAccessDays) ? row.lastAccessDays ?? 0 : NaN
            if (!Number.isFinite(days)) return '—'
            return days === 1 ? '1 day ago' : `${days} days ago`
        },

        /** Marks tabs with L-bracket favicon overlay. Skips Fresh and already-marked tabs. */
        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const boundaries = useGlobalStore().thresholdsArray
                const tabRows = TabRow.fromTabs(this.tabs, boundaries)

                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return

                        const classification = this.getAgeClassification(row, boundaries)
                        const tabIndex = this.tabs.findIndex(t => t.id === row.id)
                        const classifiedTab = tabIndex !== -1 ? this.tabs[tabIndex] : null

                        if (classifiedTab && tabIndex !== -1) {
                            this.tabs[tabIndex] = {
                                ...classifiedTab,
                                ageCssClass: classification.cssClass,
                                ageColor: classification.color,
                                ageIndex: classification.index,
                            }
                        }

                        if (classification.isFresh) return

                        const latestTab = tabIndex !== -1 ? this.tabs[tabIndex] : null
                        if (latestTab?.isMarked) return

                        await this.markTabWithLBracket(row.id, classification.color)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
            }
        },

        /**
         * Marks a tab with the L-bracket age indicator.
         * Flow: fetch favicon → render L-bracket (OffscreenCanvas) → store URL → inject into page
         */
        async markTabWithLBracket(tabId: number, color: string): Promise<void> {
            this.tabs = this.tabs.map(t =>
                t.id === tabId ? { ...t, isMarked: true } : t
            )

            try {
                const tab = this.tabs.find(t => t.id === tabId)
                if (!tab) return

                // Skip stale data: URLs to prevent double-bracket
                const rawFaviconUrl = tab.favIconUrl?.startsWith('data:') ? undefined : tab.favIconUrl

                // Wait for tab to finish loading before injecting (max 2s)
                if (tab.status !== 'complete') {
                    await new Promise<void>(resolve => {
                        const POLL = 300, MAX = 2000
                        let elapsed = 0
                        const check = async () => {
                            const [updated] = await browser.tabs.query({ currentWindow: true })
                                .then(ts => ts.filter(t => t.id === tabId))
                            if (updated?.status === 'complete') { resolve(); return }
                            elapsed += POLL
                            if (elapsed >= MAX) { resolve(); return }
                            setTimeout(check, POLL)
                        }
                        check()
                    })
                }

                const faviconDataUrl = rawFaviconUrl
                    ? await TabDots.fetchFaviconDataUrl(rawFaviconUrl)
                    : null

                const renderedDataUrl = await TabDots.renderLBracketDataUrl(faviconDataUrl, color)

                this.tabs = this.tabs.map(t =>
                    t.id === tabId ? { ...t, markedFaviconDataUrl: renderedDataUrl } : t
                )

                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.applyLBracketPageScript,
                    args: [renderedDataUrl],
                })
            } catch (err) {
                console.debug(`[markTabWithLBracket] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /** Removes the L-bracket favicon overlay and restores the original favicon. */
        async removeLBracket(tabId: number): Promise<void> {
            try {
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.removeLBracketPageScript,
                    args: [],
                })
            } catch (err) {
                console.debug(`[removeLBracket] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
            this.tabs = this.tabs.map(t =>
                t.id === tabId ? { ...t, isMarked: false, markedFaviconDataUrl: undefined } : t
            )
        },

        /**
         * Opens mock tabs with spoofed ages covering all age categories.
         * Dev tool only — used for manual testing of L-bracket marking.
         */
        async loadMockTabs(): Promise<void> {
            this.loading = true
            this.error = null

            const MOCK_TABS: { url: string; daysAgo: number }[] = [
                { url: 'https://en.wikipedia.org/wiki/Main_Page', daysAgo:  1 },
                { url: 'https://codeberg.com',                    daysAgo:  5 },
                { url: 'https://developer.mozilla.org',           daysAgo: 10 },
                { url: 'https://stackoverflow.com',               daysAgo: 13 },
                { url: 'https://www.youtube.com',                 daysAgo: 16 },
                { url: 'https://www.kowalskipiotr.pl',            daysAgo: 19 },
                { url: 'https://news.wykop.pl',                   daysAgo: 22 },
                { url: 'https://www.reddit.com',                  daysAgo: 25 },
            ]
            const DAY_MS = 24 * 60 * 60 * 1000
            const now = Date.now()

            try {
                const tabIds: number[] = []
                for (const { url } of MOCK_TABS) {
                    const tab = await browser.tabs.create({ url, active: false })
                    if (tab.id != null) tabIds.push(tab.id)
                }

                const startTime = Date.now()
                let loadedTabs: Tabs.Tab[] = []

                while (Date.now() - startTime < 10_000) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                    const allCurrentTabs = await browser.tabs.query({ currentWindow: true })
                    loadedTabs = allCurrentTabs.filter(t => tabIds.includes(t.id!))
                    const complete = loadedTabs.filter(t => t.status === 'complete').length
                    const favicons = loadedTabs.filter(t => t.favIconUrl).length
                    if (complete === tabIds.length && favicons >= Math.ceil(tabIds.length * 0.7)) break
                }

                this.$patch({
                    tabs: loadedTabs.map((tab, idx) => ({
                        ...ClassifiedTabFactory.fromTab(tab, false),
                        lastAccessed: now - (MOCK_TABS[idx]?.daysAgo ?? 0) * DAY_MS,
                    })),
                    isGrouped: false,
                    error: null,
                })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading mock tabs'
            } finally {
                this.loading = false
            }
        },

        /** Resets marking only: removes L-bracket overlays but preserves lastAccessed timestamps. */
        async reset(): Promise<void> {
            this.error = null
            this.loading = true
            try {
                const markedIds = new Set(
                    this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id as number),
                )

                if (this.isGrouped) await this.ungroupAllTabs()

                // Remove visual overlays from browser
                await Promise.all(Array.from(markedIds).map(tabId => this.removeLBracket(tabId)))

                // Fetch fresh tab data to get updated favicons
                const freshTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
                const freshById = new Map(freshTabs.map(t => [t.id, t]))

                // Merge: preserve lastAccessed, update favicons (but remove stale data: URLs)
                this.tabs = this.tabs.map(tab => {
                    const fresh = tab.id != null ? freshById.get(tab.id) : undefined
                    // If fresh favicon is a data: URL, remove it; otherwise use it
                    const favIconUrl = fresh?.favIconUrl?.startsWith('data:')
                        ? undefined
                        : (fresh?.favIconUrl ?? tab.favIconUrl)
                    return {
                        ...tab,
                        favIconUrl,
                        isMarked: false,
                        markedFaviconDataUrl: undefined,
                        ageCssClass: '',
                        ageColor: 'transparent',
                        ageIndex: 0,
                    }
                })
                this.isGrouped = false
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting tabs'
            } finally {
                this.loading = false
            }
        },

        /** Groups Middle + Old + Young tabs by age using Chrome tab groups API. */
        async groupTabsByAge(): Promise<number> {
            this.error = null
            this.loading = true
            let groupsCreated = 0

            try {
                type ChromeAPI = {
                    chrome?: {
                        tabs?: { group?: (o: { tabIds: number[] }) => Promise<number> }
                        tabGroups?: {
                            update?: (id: number, o: { title?: string; color?: string; collapsed?: boolean }) => Promise<void>
                            move?: (id: number, o: { index: number }) => Promise<void>
                        }
                    }
                }
                const chromeApi = (globalThis as unknown as ChromeAPI).chrome
                if (!chromeApi?.tabs?.group || !chromeApi?.tabGroups?.update) {
                    this.error = 'Chrome tab grouping API not available (Firefox?)'
                    return 0
                }

                const boundaries = useGlobalStore().thresholdsArray
                const [boundariesYoung, boundariesMiddle, boundariesOld] = boundaries

                const oldTabIds: number[] = []
                const middleTabIds: number[] = []
                const youngTabIds: number[] = []

                const sortedRows = [...TabRow.fromTabs(this.tabs, boundaries)]
                    .sort((a, b) => (b.lastAccess ?? 0) - (a.lastAccess ?? 0))

                for (const row of sortedRows) {
                    if (row.id == null) continue
                    const c = this.getAgeClassification(row, boundaries)
                    if (c.isOld) oldTabIds.push(row.id)
                    else if (c.isMiddle) middleTabIds.push(row.id)
                    else if (c.isYoung) youngTabIds.push(row.id)
                }

                if (!oldTabIds.length && !middleTabIds.length && !youngTabIds.length) {
                    this.isGrouped = false
                    return 0
                }

                const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
                    if (!ids.length) return null
                    try {
                        const id = await chromeApi.tabs!.group!({ tabIds: ids })
                        await chromeApi.tabGroups!.update!(id, { title, color, collapsed: false })
                        groupsCreated++
                        return id
                    } catch { return null }
                }

                const oldGroupId    = await createGroup(oldTabIds,    `🔴 Old (${boundariesOld}d+)`,      'red')
                const middleGroupId = await createGroup(middleTabIds, `🟠 Middle (${boundariesMiddle}d+)`, 'orange')
                const youngGroupId  = await createGroup(youngTabIds,  `🟡 Young (${boundariesYoung}d+)`,  'yellow')

                if (chromeApi.tabGroups?.move) {
                    for (const id of [youngGroupId, middleGroupId, oldGroupId]) {
                        if (id !== null) {
                            try { await chromeApi.tabGroups.move(id, { index: 0 }) } catch { /* silent */ }
                        }
                    }
                }

                this.isGrouped = true
                return groupsCreated
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while grouping tabs by age'
                return 0
            } finally {
                this.loading = false
            }
        },

        /** Removes all tab groups in the current window. */
        async ungroupAllTabs(): Promise<void> {
            this.error = null
            this.loading = true
            try {
                type ChromeAPI = { chrome?: { tabs?: { ungroup?: (ids: number | number[]) => Promise<void> } } }
                const chromeApi = (globalThis as unknown as ChromeAPI).chrome
                if (!chromeApi?.tabs?.ungroup) {
                    this.error = 'Chrome tab ungrouping API not available (Firefox?)'
                    return
                }
                const allTabIds = this.tabs.map(t => t.id).filter((id): id is number => id != null)
                if (allTabIds.length > 0) await chromeApi.tabs.ungroup(allTabIds)
                this.isGrouped = false
            } catch {
                this.isGrouped = false
            } finally {
                this.loading = false
            }
        },

        /** Triggers full extension cleanup on disable/uninstall. */
        async performExtensionCleanup(): Promise<void> {
            await ExtensionCleanupService.performFullCleanup()
            this.tabs = this.tabs.map(t => ({ ...t, isMarked: false }))
            this.isGrouped = false
        },

        /**
         * Listens for background-written storage changes and syncs this store.
         * Call from UI context onMounted. Returns unsubscribe — call in onUnmounted.
         *
         * Flow: background → browser.storage.local → initStorageSync() → Pinia → Vue UI
         */
        initStorageSync(): () => void {
            if (typeof browser === 'undefined' || !browser?.storage?.onChanged?.addListener) {
                return () => {}
            }

            const handler = (changes: Record<string, Storage.StorageChange>, areaName: string) => {
                if (areaName !== 'local') return
                const snap = changes[APP_DEFAULTS.TAB_HISTORY_KEY]?.newValue as TabsSnapshot | undefined
                if (!snap?.tabs) return

                const rawTabs = Array.isArray(snap.tabs)
                    ? snap.tabs
                    : Object.values(snap.tabs as Record<string, Tabs.Tab>)

                this.tabs = ClassifiedTabFactory.fromTabs(rawTabs)
                console.debug('[TabStore] Received background snapshot:', rawTabs.length, 'tabs')
            }

            browser.storage.onChanged.addListener(handler)
            return () => browser.storage.onChanged.removeListener(handler)
        },
    },
})
