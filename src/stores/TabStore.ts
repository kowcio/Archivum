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

/** @deprecated Use APP_DEFAULTS.TAB_HISTORY_KEY */
export const TAB_HISTORY_KEY = APP_DEFAULTS.TAB_HISTORY_KEY

type Nullable<T> = T | null

export interface TabState {
    tabs: ClassifiedTab[]
    lastSaveDate: Nullable<string>
    loading: boolean
    error: Nullable<string>
    isGrouped: boolean
}

export const useTabStore = defineStore('tabStore', {
    state: (): TabState => ({
        tabs: [],
        lastSaveDate: null,
        loading: false,
        error: null,
        isGrouped: false,
    }),
    actions: {
        async getAllOpenedTabs(): Promise<ClassifiedTab[]> {
            this.loading = true
            this.error = null
            try {
                const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })

                // Preserve isMarked from previous load (by tab ID)
                const previouslyMarkedIds = new Set(
                    this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id!)
                )
                this.tabs = ClassifiedTabFactory.fromTabs(fetchedTabs, previouslyMarkedIds)

                await this.waitForFaviconsLoaded(3000)
                await this.markOldTabs()

                console.log('Loaded opened tabs:', this.tabs.length, {
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

        /** Re-queries tabs and merges favicon URLs into ClassifiedTab state. */
        async waitForFaviconsLoaded(timeoutMs = 3000): Promise<void> {
            const startTime = Date.now()
            const pollInterval = 200

            return new Promise<void>((resolve) => {
                const checkFavicons = async () => {
                    const elapsed = Date.now() - startTime

                    if (elapsed > timeoutMs) {
                        console.log(`[waitForFaviconsLoaded] Timeout (${timeoutMs}ms) - proceeding`)
                        resolve()
                        return
                    }

                    try {
                        const updatedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
                        const withFavicons = updatedTabs.filter(t => t.favIconUrl).length
                        const total = updatedTabs.length

                        if (withFavicons >= Math.max(1, total * 0.7)) {
                            console.log(`[waitForFaviconsLoaded] ✅ ${withFavicons}/${total} favicons ready (${elapsed}ms)`)
                            // Merge favicon URLs — preserve isMarked + age fields
                            this.tabs = updatedTabs.map(updatedTab => {
                                const existing = this.tabs.find(t => t.id === updatedTab.id)
                                return existing
                                    ? { ...existing, favIconUrl: updatedTab.favIconUrl }
                                    : ClassifiedTabFactory.fromTab(updatedTab)
                            })
                            resolve()
                            return
                        }

                        setTimeout(checkFavicons, pollInterval)
                    } catch (err) {
                        console.debug('[waitForFaviconsLoaded] Check error:', err)
                        setTimeout(checkFavicons, pollInterval)
                    }
                }
                checkFavicons()
            })
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

        async saveAllTabs(storage: Storage.StorageArea = browser.storage.local): Promise<TabsSnapshot | undefined> {
            this.loading = true
            this.error = null
            try {
                const savedAt = new Date().toISOString()
                const snapshot = new TabsSnapshot(this.tabs, savedAt)
                await storage.set({ [APP_DEFAULTS.TAB_HISTORY_KEY]: snapshot })
                this.lastSaveDate = savedAt
                return snapshot
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while saving tabs'
                return undefined
            } finally {
                this.loading = false
            }
        },

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
                    this.lastSaveDate = snapshot.savedAt
                    console.log('Loaded saved tabs:', this.tabs.length)
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

        /**
         * Marks tabs with L-bracket favicon overlay.
         * Skips Fresh tabs (index 0) and already-marked tabs.
         */
        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const boundaries = useGlobalStore().thresholdsArray
                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                console.log(`[markOldTabs] boundaries=${JSON.stringify(boundaries)} tabs=${tabRows.length}`)

                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return

                        const classification = this.getAgeClassification(row, boundaries)
                        const tabIndex = this.tabs.findIndex(t => t.id === row.id)
                        const classifiedTab = tabIndex !== -1 ? this.tabs[tabIndex] : null

                        // Apply age state to the ClassifiedTab (replace element for reactivity)
                        if (classifiedTab && tabIndex !== -1) {
                            this.tabs[tabIndex] = {
                                ...classifiedTab,
                                ageCssClass: classification.cssClass,
                                ageColor: classification.color,
                                ageIndex: classification.index,
                            }
                        }

                        // Skip Fresh tabs
                        if (classification.isFresh) {
                            console.log(`[markOldTabs] tab#${row.id} is Fresh - skipping`)
                            return
                        }

                        // Skip already-marked tabs
                        const latestTab = tabIndex !== -1 ? this.tabs[tabIndex] : null
                        if (latestTab?.isMarked) {
                            console.log(`[markOldTabs] tab#${row.id} already marked - skipping`)
                            return
                        }

                        console.log(`[markOldTabs] tab#${row.id} index=${classification.index} color=${classification.color} marking...`)
                        await this.markTabWithLBracket(row.id, classification.color)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
            }
        },

        /** Injects the L-bracket age indicator onto the tab favicon. */
        async markTabWithLBracket(tabId: number, color: string): Promise<void> {
            try {
                const tabIndex = this.tabs.findIndex((t) => t.id === tabId)
                if (tabIndex === -1) return

                const tab = this.tabs[tabIndex]
                const faviconDataUrl = tab.favIconUrl
                    ? await TabDots.fetchFaviconDataUrl(tab.favIconUrl)
                    : null

                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.applyLBracketPageScript,
                    args: [color, faviconDataUrl],
                })

                this.tabs = this.tabs.map(t =>
                    t.id === tabId ? { ...t, isMarked: true } : t
                )
                console.log(`[markTabWithLBracket] tab#${tabId} marked`)
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
                console.log(`[removeLBracket] tab#${tabId} mark removed`)
            } catch (err) {
                // Script injection failed (restricted page: chrome://, extension page, strict CSP)
                // Visual L-bracket cannot be removed, but we MUST still reset the store state
                console.debug(`[removeLBracket] tab#${tabId} script failed (restricted page?):`, err instanceof Error ? err.message : err)
            }
            // Always reset store state — even if script injection failed
            this.tabs = this.tabs.map(t =>
                t.id === tabId ? { ...t, isMarked: false } : t
            )
        },

        /**
         * Opens 7 real browser tabs with reliable URLs and spoofs their lastAccessed
         * to cover all age categories (Fresh/Young/Middle/Old) for manual testing.
         *
         * ⚠️ NOTE for Playwright / CI environments:
         * Some pages may be unavailable (network-restricted CI) or block executeScript
         * (strict CSP). Use pages that are lightweight and allow extension script injection.
         *
         * Age distribution (default thresholds: young=7d, middle=14d, old=21d):
         *  idx 0 →  1 day  → Fresh   (not marked)
         *  idx 1 →  5 days → Fresh   (not marked)
         *  idx 2 → 10 days → Young   (marked)
         *  idx 3 → 13 days → Young   (marked)
         *  idx 4 → 16 days → Middle  (marked, groupable)
         *  idx 5 → 19 days → Middle  (marked, groupable)
         *  idx 6 → 25 days → Old     (marked, groupable)
         */
        async loadMockTabs(): Promise<void> {
            this.loading = true
            this.error = null

            // Reliable URLs: always load, have favicons, don't block executeScript via CSP
            // Avoid: banking sites, login-walls, pages blocking non-standard browsers
            const MOCK_TABS: { url: string; daysAgo: number }[] = [
                { url: 'https://en.wikipedia.org/wiki/Main_Page', daysAgo:  1 },  // Fresh
                { url: 'https://codeberg.com',                    daysAgo:  5 },  // Fresh
                { url: 'https://developer.mozilla.org',           daysAgo: 10 },  // Young
                { url: 'https://stackoverflow.com',               daysAgo: 13 },  // Young
                { url: 'https://www.youtube.com',                 daysAgo: 16 },  // Middle
                { url: 'https://www.kowalskipiotr.pl',            daysAgo: 19 },  // Middle
                { url: 'https://news.wykop.pl',                   daysAgo: 22 },  // Old
                { url: 'https://www.reddit.com',                  daysAgo: 25 },  // Old
            ]
            const MOCK_URLS   = MOCK_TABS.map(t => t.url)
            const AGE_SPOOF_DAYS = MOCK_TABS.map(t => t.daysAgo)
            const DAY_MS = 24 * 60 * 60 * 1000
            const now = Date.now()

            try {
                // 1. Open tabs in background (active: false to avoid disrupting the user)
                const tabIds: number[] = []
                for (const url of MOCK_URLS) {
                    const tab = await browser.tabs.create({ url, active: false })
                    if (tab.id != null) tabIds.push(tab.id)
                }

                // 2. Poll until all tabs are complete AND have favicons (max 10s, 500ms intervals)
                //    Some lightweight pages (HN, Wikipedia) load in <2s.
                //    Some heavy pages (Reddit, YouTube) may take longer.
                const startTime = Date.now()
                const MAX_WAIT_MS = 10_000
                let loadedTabs: Tabs.Tab[] = []
                let allReady = false

                while (Date.now() - startTime < MAX_WAIT_MS) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                    const allCurrentTabs = await browser.tabs.query({ currentWindow: true })
                    loadedTabs = allCurrentTabs.filter(t => tabIds.includes(t.id!))

                    const completeCount  = loadedTabs.filter(t => t.status === 'complete').length
                    const faviconCount   = loadedTabs.filter(t => t.favIconUrl).length
                    const elapsed        = Date.now() - startTime

                    console.log(`[loadMockTabs] ${elapsed}ms — status:complete ${completeCount}/${tabIds.length}, favicons ${faviconCount}/${tabIds.length}`)

                    // Accept when ALL tabs are complete and at least 70% have favicons
                    // (some sites like YouTube may use JS-rendered favicons that load slower)
                    if (completeCount === tabIds.length && faviconCount >= Math.ceil(tabIds.length * 0.7)) {
                        allReady = true
                        console.log(`[loadMockTabs] ✅ All tabs ready (${elapsed}ms)`)
                        break
                    }
                }

                if (!allReady) {
                    console.warn(`[loadMockTabs] ⚠️ Timeout — proceeding with ${loadedTabs.filter(t => t.favIconUrl).length}/${tabIds.length} favicons`)
                }

                // 3. Build ClassifiedTab array with spoofed lastAccessed
                const spoofedTabs: ClassifiedTab[] = loadedTabs.map((tab, idx) => {
                    const daysAgo = idx < AGE_SPOOF_DAYS.length
                        ? AGE_SPOOF_DAYS[idx]
                        : AGE_SPOOF_DAYS[AGE_SPOOF_DAYS.length - 1]
                    return {
                        ...ClassifiedTabFactory.fromTab(tab, false),
                        lastAccessed: now - daysAgo * DAY_MS,
                    }
                })

                // 4. Replace store tabs with the 7 mock tabs (reset grouping + marks)
                this.$patch({
                    tabs: spoofedTabs,
                    isGrouped: false,
                    error: null,
                })

                // 5. Apply L-bracket age overlays (marks Young/Middle/Old tabs)
                await this.markOldTabs()

                console.log('[loadMockTabs] ✅ Mock tabs ready:', spoofedTabs.length, {
                    marked: this.tabs.filter(t => t.isMarked).length,
                    withFavicons: this.tabs.filter(t => t.favIconUrl).length,
                })
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading mock tabs'
            } finally {
                this.loading = false
            }
        },

        /** Complete reset: removes overlays from ALL browser tabs, ungroups, refreshes store. */
        async reset(): Promise<void> {
            this.error = null
            this.loading = true
            try {
                // Ungroup first (Chrome-only, silently fails on Firefox)
                if (this.isGrouped) await this.ungroupAllTabs()

                // Always query ALL current browser tabs — not just the ones in store.
                // This ensures L-brackets are removed even if handleGenMockTabs replaced
                // this.tabs with a smaller subset.
                const allTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
                await Promise.all(
                    allTabs.map(async (tab) => {
                        if (tab.id == null) return
                        await this.removeLBracket(tab.id)
                    }),
                )

                // Reload store from the full browser tab list (no stale marks)
                const freshTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
                this.tabs = ClassifiedTabFactory.fromTabs(freshTabs)
                this.isGrouped = false

                console.log('[reset] ✅ Clean slate — tabs:', this.tabs.length)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting tabs'
            } finally {
                this.loading = false
            }
        },

        /** @deprecated Use reset() instead */
        async clearDotsFromOpenTabs(): Promise<void> { await this.reset() },
        /** @deprecated Use reset() instead */
        async resetAllTabMarks(): Promise<void> { await this.reset() },

        /**
         * Groups Middle + Old tabs by age. Fresh and Young tabs are NOT grouped.
         * Old group is leftmost. Returns number of groups created.
         */
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
                const boundariesMiddle = boundaries[1]
                const boundariesOld = boundaries[2]

                const oldTabIds: number[] = []
                const middleTabIds: number[] = []

                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                const sortedRows = [...tabRows].sort((a, b) => (b.lastAccess ?? 0) - (a.lastAccess ?? 0))

                for (const row of sortedRows) {
                    if (row.id == null) continue
                    const classification = this.getAgeClassification(row, boundaries)
                    if (classification.isOld) oldTabIds.push(row.id)
                    else if (classification.isMiddle) middleTabIds.push(row.id)
                }

                if (oldTabIds.length === 0 && middleTabIds.length === 0) {
                    console.log('[groupTabsByAge] No tabs older than YOUNG threshold')
                    this.isGrouped = false
                    return 0
                }

                let oldGroupId: number | null = null
                if (oldTabIds.length > 0) {
                    try {
                        oldGroupId = await chromeApi.tabs.group!({ tabIds: oldTabIds })
                        await chromeApi.tabGroups.update!(oldGroupId, {
                            title: `🔴 Old (${boundariesOld}d+)`,
                            color: 'red',
                            collapsed: false,
                        })
                        groupsCreated++
                        console.log(`[groupTabsByAge] ✅ OLD group#${oldGroupId} (${oldTabIds.length} tabs)`)
                    } catch (err) {
                        console.debug('[groupTabsByAge] Old group error:', err instanceof Error ? err.message : err)
                    }
                }

                if (middleTabIds.length > 0) {
                    try {
                        const middleGroupId = await chromeApi.tabs.group!({ tabIds: middleTabIds })
                        await chromeApi.tabGroups.update!(middleGroupId, {
                            title: `🟠 Middle (${boundariesMiddle}d+)`,
                            color: 'orange',
                            collapsed: false,
                        })
                        groupsCreated++
                        console.log(`[groupTabsByAge] ✅ MIDDLE group#${middleGroupId} (${middleTabIds.length} tabs)`)
                    } catch (err) {
                        console.debug('[groupTabsByAge] Middle group error:', err instanceof Error ? err.message : err)
                    }
                }

                if (oldGroupId !== null && chromeApi.tabGroups?.move) {
                    try {
                        await chromeApi.tabGroups.move(oldGroupId, { index: 0 })
                    } catch (err) {
                        console.debug('[groupTabsByAge] Move error:', err instanceof Error ? err.message : err)
                    }
                }

                this.isGrouped = true
                console.log(`[groupTabsByAge] ✅ ${groupsCreated} groups created`)
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
                type ChromeAPI = {
                    chrome?: { tabs?: { ungroup?: (ids: number | number[]) => Promise<void> } }
                }
                const chromeApi = (globalThis as unknown as ChromeAPI).chrome
                if (!chromeApi?.tabs?.ungroup) {
                    this.error = 'Chrome tab ungrouping API not available (Firefox?)'
                    return
                }
                const allTabIds = this.tabs.map(t => t.id).filter((id): id is number => id != null)
                if (allTabIds.length > 0) {
                    await chromeApi.tabs.ungroup(allTabIds)
                    console.log(`[ungroupAllTabs] ✅ Ungrouped ${allTabIds.length} tabs`)
                }
                this.isGrouped = false
            } catch (err) {
                console.debug('[ungroupAllTabs] Error:', err instanceof Error ? err.message : err)
                this.isGrouped = false
            } finally {
                this.loading = false
            }
        },

        /** Triggers full extension cleanup on disable/uninstall. */
        async performExtensionCleanup(): Promise<void> {
            console.log('[performExtensionCleanup] Delegating to ExtensionCleanupService...')
            await ExtensionCleanupService.performFullCleanup()
            this.tabs = this.tabs.map(t => ({ ...t, isMarked: false }))
            this.isGrouped = false
        },
    },
})
