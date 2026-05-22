import { defineStore } from 'pinia'
import browser, { type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { TabDots, DOT_COLOR_MAP } from '@/services/TabDots.ts'
import { useGlobalStore, DEFAULT_THRESHOLDS } from '@/stores/globalStore'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { APP_DEFAULTS } from '@/constants'

/** @deprecated Use APP_DEFAULTS.TAB_HISTORY_KEY */
export const TAB_HISTORY_KEY = APP_DEFAULTS.TAB_HISTORY_KEY

export interface AgeClassification {
    cssClass: string
    color: string
    days: number
    classificationIndex: number
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
    markedTabIds: Set<number>  // 🎯 Track which tabs have L-bracket overlay
    isGrouped: boolean  // 🎯 Track if tabs are currently grouped
}

export const useTabStore = defineStore('tabStore', {
    state: (): TabState => ({
        tabs: [],
        lastSaveDate: null,
        loading: false,
        error: null,
        markedTabIds: new Set<number>(),  // 🎯 Track tab IDs that have L-bracket overlay
        isGrouped: false,  // 🎯 Track if tabs are grouped
    }),
    actions: {
        async getAllOpenedTabs(): Promise<Tabs.Tab[]> {
            this.loading = true
            this.error = null
            try {
                const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })

                // 🎯 Preserve markedTabIds from previous load
                const previousMarkedIds = new Set(this.markedTabIds)
                this.markedTabIds.clear()

                // 🎯 Mark tabs that were previously marked (by ID)
                fetchedTabs.forEach((tab) => {
                    if (tab.id && previousMarkedIds.has(tab.id)) {
                        this.markedTabIds.add(tab.id)
                    }
                })

                this.tabs = fetchedTabs

                // 🎯 Wait for favicons to load before finishing
                await this.waitForFaviconsLoaded(fetchedTabs, 3000)

                // 🎯 Auto-mark old tabs (skip if already marked)
                await this.markOldTabs()

                console.log('Loaded opened tabs:', fetchedTabs.length, {
                    withFavicons: fetchedTabs.filter(t => t.favIconUrl).length,
                    total: fetchedTabs.length,
                    marked: this.markedTabIds.size,
                })
                return fetchedTabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs'
                return []
            } finally {
                this.loading = false
            }
        },

        /**
         * ⏳ Wait for tabs to have their favicons loaded
         * Re-queries tabs to get updated favicon data.
         */
        async waitForFaviconsLoaded(tabs: Tabs.Tab[], timeoutMs = 3000): Promise<void> {
            const startTime = Date.now()
            const pollInterval = 200

            return new Promise<void>((resolve) => {
                const checkFavicons = async () => {
                    const elapsed = Date.now() - startTime

                    // Timeout - proceed anyway
                    if (elapsed > timeoutMs) {
                        console.log(`[waitForFaviconsLoaded] Timeout (${timeoutMs}ms) - proceeding`)
                        resolve()
                        return
                    }

                    try {
                        // Re-query to get updated favicon data
                        const updatedTabs = await browser.tabs.query({ currentWindow: true })
                        const withFavicons = updatedTabs.filter(t => t.favIconUrl).length
                        const total = updatedTabs.length

                        if (withFavicons >= Math.max(1, total * 0.7)) {
                            console.log(`[waitForFaviconsLoaded] ✅ ${withFavicons}/${total} favicons ready (${elapsed}ms)`)
                            this.tabs = updatedTabs
                            resolve()
                            return
                        }

                        // Check again
                        setTimeout(checkFavicons, pollInterval)
                    } catch (err) {
                        console.debug('[waitForFaviconsLoaded] Check error:', err)
                        setTimeout(checkFavicons, pollInterval)
                    }
                }

                checkFavicons()
            })
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
        async saveAllTabs(
            storage: Storage.StorageArea = browser.storage.local,
        ): Promise<TabsSnapshot | undefined> {
            this.loading = true
            this.error = null
            try {
                const savedAt = new Date().toISOString()
                const snapshot: TabsSnapshot = { tabs: this.tabs, savedAt }
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
        async loadTabsHistory(
            storage: Storage.StorageArea = browser.storage.local,
        ): Promise<Tabs.Tab[]> {
            this.loading = true
            this.error = null
            try {
                const result = await storage.get(APP_DEFAULTS.TAB_HISTORY_KEY)
                const snapshot = result?.[APP_DEFAULTS.TAB_HISTORY_KEY] as TabsSnapshot | undefined
                console.log('Loaded saved tabs:', snapshot?.tabs)
                if (snapshot) {
                    this.tabs = Array.isArray(snapshot.tabs)
                        ? snapshot.tabs
                        : Object.values(snapshot.tabs as Record<string, Tabs.Tab>)
                    this.lastSaveDate = snapshot.savedAt
                    console.log('Loaded saved tabs (normalized):', this.tabs)
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
            const index = boundaries.findIndex((t) => days <= t)
            const classificationIndex = index !== -1 ? index : DOT_COLOR_MAP.length - 1
            const resolved = DOT_COLOR_MAP[classificationIndex]
            return { ...resolved, days, classificationIndex }
        },

        getLastAccessMsg(row: TabRow): string {
            const { days } = this.getAgeClassification(row)
            if (!Number.isFinite(days)) return '—'
            return days === 1 ? '1 day ago' : `${days} days ago`
        },

        /**
         * ✅ ACTIVE — marks all tabs with the L-bracket favicon overlay.
         * This is the ONLY marking method in use.
         *
         * 🎯 DEDUPLICATION: Only marks tabs that aren't already marked
         * (checks markedTabIds Set)
         */
        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const boundaries = useGlobalStore().thresholdsArray
                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                console.log(`[markOldTabs] boundaries=${JSON.stringify(boundaries)} tabs=${tabRows.length} already_marked=${this.markedTabIds.size}`)

                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return

                        // 🎯 SKIP if already marked
                        if (this.markedTabIds.has(row.id)) {
                            console.log(`[markOldTabs] tab#${row.id} already marked, skipping`)
                            return
                        }

                        const { color, days } = this.getAgeClassification(row, boundaries)
                        console.log(`[markOldTabs] tab#${row.id} days=${days} color=${color} marking...`)
                        await this.markTabWithLBracket(row.id, color)
                    }),
                )
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
            }
        },

        /**
         * ✅ CRITICAL — CONFIRMED WORKING (2026-05-19)
         * Injects the L-bracket age indicator onto the tab favicon.
         * Pre-fetches favicon in extension context to avoid CORS.
         *
         * 🎯 Tracks marking in markedTabIds Set (survives tab reloads)
         */
        async markTabWithLBracket(tabId: number, color: string): Promise<void> {
            try {
                const tab = this.tabs.find((t) => t.id === tabId)
                if (!tab) return

                const faviconDataUrl = tab.favIconUrl
                    ? await TabDots.fetchFaviconDataUrl(tab.favIconUrl)
                    : null

                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.applyLBracketPageScript,
                    args: [color, faviconDataUrl],
                })

                // ✅ Track as marked in Set (survives reload)
                this.markedTabIds.add(tabId)
                console.log(`[markTabWithLBracket] tab#${tabId} marked successfully`)
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
                // 🎯 Remove from tracking Set
                this.markedTabIds.delete(tabId)
                console.log(`[removeLBracket] tab#${tabId} removed from marks`)
            } catch (err) {
                console.debug(`[removeLBracket] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /**
         * ✅ ACTIVE — Complete reset: removes all L-bracket overlays from every open tab,
         * ungroups tabs, and refreshes the store to a clean original state (blank slate).
         * This is the single unified reset method.
         *
         * 🎯 Clears all marking metadata to prevent stale tracking.
         */
        async reset(): Promise<void> {
            this.error = null
            this.loading = true
            try {
                // 1️⃣ Remove L-brackets and ungroup from all current tabs
                const tabRows = TabRow.fromTabs(this.tabs)

                // Ungroup all tabs
                const allTabIds = this.tabs
                    .map(t => t.id)
                    .filter((id): id is number => id != null)

                if (allTabIds.length > 0) {
                    await this.ungroupAllTabs()
                }

                // Remove L-brackets
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        await this.removeLBracket(row.id)
                    }),
                )

                // 2️⃣ Refresh tabs from browser (gets latest data)
                const freshTabs = await browser.tabs.query({ currentWindow: true })
                this.tabs = freshTabs

                // 3️⃣ Wait for favicons to reload after removing overlays
                await this.waitForFaviconsLoaded(freshTabs, 2000)

                // 4️⃣ Clear all tracking
                this.markedTabIds.clear()
                this.isGrouped = false

                console.log('[reset] ✅ Clean slate complete — all marking cleared')
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting tabs'
            } finally {
                this.loading = false
            }
        },

        // ── Deprecated methods (kept for backwards compatibility) ────────────────
        /** @deprecated Use reset() instead */
        async clearDotsFromOpenTabs(): Promise<void> {
            await this.reset()
        },

        /** @deprecated Use reset() instead */
        async resetAllTabMarks(): Promise<void> {
            await this.reset()
        },

        /**
         * 🎯 Groups tabs by age classification
         * ONLY groups tabs older than YOUNG threshold (Middle + Old)
         * Fresh and Young tabs are NOT grouped
         *
         * Behavior:
         * - Old group → moved to leftmost position, OPENED
         * - Middle group → after Old, OPENED
         * - Tabs inside group → sorted by last access (newest first)
         * - All groups opened (not collapsed)
         *
         * Returns number of groups created (for testing)
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
                            query?: (o: { windowId: number }) => Promise<Array<{ id: number }>>
                            update?: (id: number, o: { title?: string; color?: string; collapsed?: boolean }) => Promise<void>
                            move?: (id: number, o: { index: number }) => Promise<void>
                        }
                    }
                }
                const { chrome } = globalThis as unknown as ChromeAPI
                if (!chrome?.tabs?.group || !chrome?.tabGroups?.update) {
                    this.error = 'Chrome tab grouping API not available (Firefox?)'
                    return 0
                }

                const boundaries = useGlobalStore().thresholdsArray
                const [_young, middle, old] = boundaries  // _young not used - we only group Middle + Old

                // 🎯 ONLY group Middle (index 2) and Old (index 3) tabs
                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                const middleAndOldTabs: TabRow[] = []

                for (const row of tabRows) {
                    const { classificationIndex } = this.getAgeClassification(row, boundaries)
                    // Only collect Middle (2) and Old (3) tabs
                    if (classificationIndex >= 2) {
                        middleAndOldTabs.push(row)
                    }
                }

                if (middleAndOldTabs.length === 0) {
                    console.log('[groupTabsByAge] No tabs older than YOUNG threshold - nothing to group')
                    this.isGrouped = false
                    return 0
                }

                // 🎯 Sort by last access (newest first)
                middleAndOldTabs.sort((a, b) => (b.lastAccess ?? 0) - (a.lastAccess ?? 0))

                // 🎯 Separate into Old and Middle groups
                const oldTabs: TabRow[] = []
                const middleTabs: TabRow[] = []

                for (const row of middleAndOldTabs) {
                    const { classificationIndex } = this.getAgeClassification(row, boundaries)
                    if (classificationIndex === 3) {
                        oldTabs.push(row)
                    } else if (classificationIndex === 2) {
                        middleTabs.push(row)
                    }
                }

                // 🎯 Group OLD first (will appear leftmost)
                let oldGroupId: number | null = null
                if (oldTabs.length > 0) {
                    const oldTabIds = oldTabs.map(r => r.id).filter((id): id is number => id != null)
                    if (oldTabIds.length > 0) {
                        try {
                            oldGroupId = await chrome.tabs.group!({ tabIds: oldTabIds })
                            await chrome.tabGroups.update!(oldGroupId, {
                                title: `🔴 Old (${old}d+)`,
                                color: 'red',
                                collapsed: false,  // 🎯 OPENED (not collapsed)
                            })
                            groupsCreated++
                            console.log(`[groupTabsByAge] ✅ Created OLD group#${oldGroupId} with ${oldTabIds.length} tabs`)
                        } catch (err) {
                            console.debug('[groupTabsByAge] Old group error:', err instanceof Error ? err.message : err)
                        }
                    }
                }

                // 🎯 Group MIDDLE after OLD
                if (middleTabs.length > 0) {
                    const middleTabIds = middleTabs.map(r => r.id).filter((id): id is number => id != null)
                    if (middleTabIds.length > 0) {
                        try {
                            const middleGroupId = await chrome.tabs.group!({ tabIds: middleTabIds })
                            await chrome.tabGroups.update!(middleGroupId, {
                                title: `🟠 Middle (${middle}d+)`,
                                color: 'orange',
                                collapsed: false,  // 🎯 OPENED (not collapsed)
                            })
                            groupsCreated++
                            console.log(`[groupTabsByAge] ✅ Created MIDDLE group#${middleGroupId} with ${middleTabIds.length} tabs`)
                        } catch (err) {
                            console.debug('[groupTabsByAge] Middle group error:', err instanceof Error ? err.message : err)
                        }
                    }
                }

                // 🎯 Move OLD group to leftmost position (index 0)
                if (oldGroupId !== null && chrome.tabGroups?.move) {
                    try {
                        await chrome.tabGroups.move(oldGroupId, { index: 0 })
                        console.log(`[groupTabsByAge] ✅ Moved OLD group#${oldGroupId} to leftmost position`)
                    } catch (err) {
                        console.debug('[groupTabsByAge] Move group error:', err instanceof Error ? err.message : err)
                    }
                }

                // 🎯 TEST: Verify all groups were created
                if (chrome.tabGroups?.query) {
                    try {
                        const windowId = (chrome as any).windows?.WINDOW_ID_CURRENT ?? 0
                        const allGroups = await chrome.tabGroups.query!({ windowId })
                        console.log(`[groupTabsByAge] 🧪 TEST: Total groups in window: ${allGroups.length}`)
                        allGroups.forEach((group, idx) => {
                            console.log(`  Group #${idx}: id=${group.id}`)
                        })
                    } catch (err) {
                        console.debug('[groupTabsByAge] Query groups error:', err instanceof Error ? err.message : err)
                    }
                }

                this.isGrouped = true
                console.log(`[groupTabsByAge] ✅ Grouping complete - ${groupsCreated} groups created`)
                return groupsCreated
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while grouping tabs by age'
                return 0
            } finally {
                this.loading = false
            }
        },

        /**
         * 🎯 Ungroups all tabs (removes all tab groups)
         */
        async ungroupAllTabs(): Promise<void> {
            this.error = null
            this.loading = true
            try {
                type ChromeAPI = {
                    chrome?: {
                        tabs?: { ungroup?: (ids: number | number[]) => Promise<void> }
                    }
                }
                const { chrome } = globalThis as unknown as ChromeAPI

                if (!chrome?.tabs?.ungroup) {
                    this.error = 'Chrome tab ungrouping API not available (Firefox?)'
                    return
                }

                // 🎯 Ungroup all tabs
                const allTabIds = this.tabs
                    .map(t => t.id)
                    .filter((id): id is number => id != null)

                if (allTabIds.length > 0) {
                    await chrome.tabs.ungroup(allTabIds)
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

        /**
         * 🧹 CLEANUP & LIFECYCLE MANAGEMENT
         *
         * Triggers full extension cleanup (for disable/uninstall scenarios).
         * Removes all marks from all tabs, ungroups tab groups, clears storage.
         * Safe to call multiple times.
         */
        async performExtensionCleanup(): Promise<void> {
            console.log('[performExtensionCleanup] Delegating to ExtensionCleanupService...')
            await ExtensionCleanupService.performFullCleanup()
            // 🎯 Clear marking metadata
            this.markedTabIds.clear()
            this.isGrouped = false
        },
    },
})
