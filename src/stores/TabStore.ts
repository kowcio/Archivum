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
}

export const useTabStore = defineStore('tabStore', {
    state: (): TabState => ({
        tabs: [],
        lastSaveDate: null,
        loading: false,
        error: null,
        markedTabIds: new Set<number>(),  // 🎯 Track tab IDs that have L-bracket overlay
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
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        await this.removeLBracket(row.id)
                        await this.unmarkTabGroup(row.id)
                    }),
                )

                // 2️⃣ Refresh tabs from browser (gets latest data)
                const freshTabs = await browser.tabs.query({ currentWindow: true })
                this.tabs = freshTabs

                // 3️⃣ Wait for favicons to reload after removing overlays
                await this.waitForFaviconsLoaded(freshTabs, 2000)

                // 4️⃣ Clear all tracking
                this.markedTabIds.clear()

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

        /** Groups all open tabs by age classification into colour-coded Chrome tab groups. */
        async groupTabsByAge(): Promise<void> {
            this.error = null
            try {
                type ChromeAPI = {
                    chrome?: {
                        tabs?: { group?: (o: { tabIds: number[] }) => Promise<number> }
                        tabGroups?: { update?: (id: number, o: object) => Promise<void> }
                    }
                }
                const { chrome } = globalThis as unknown as ChromeAPI
                if (!chrome?.tabs?.group || !chrome?.tabGroups?.update) return

                const boundaries = useGlobalStore().thresholdsArray
                const [young, middle, old] = boundaries

                const groupMeta = [
                    { label: `🟢 Fresh (<${young}d)`,   color: 'green'  },
                    { label: `🟡 Young (${young}d+)`,   color: 'yellow' },
                    { label: `🟠 Middle (${middle}d+)`, color: 'orange' },
                    { label: `🔴 Old (${old}d+)`,       color: 'red'    },
                ]

                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                const buckets: Map<number, number[]> = new Map([0, 1, 2, 3].map((i) => [i, []]))

                for (const row of tabRows) {
                    if (row.id == null) continue
                    const { classificationIndex } = this.getAgeClassification(row, boundaries)
                    buckets.get(classificationIndex)!.push(row.id)
                }

                for (const [index, tabIds] of buckets.entries()) {
                    if (tabIds.length === 0) continue
                    const { label, color } = groupMeta[index]
                    try {
                        const groupId = await chrome.tabs.group!({ tabIds })
                        await chrome.tabGroups.update!(groupId, { title: label, color })
                    } catch (err) {
                        console.debug(`[groupTabsByAge] bucket#${index}:`, err instanceof Error ? err.message : err)
                    }
                }
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while grouping tabs by age'
            }
        },

        /** Removes a tab from its Chrome tab group (no-op on Firefox). */
        async unmarkTabGroup(tabId: number): Promise<void> {
            try {
                const chrome = (globalThis as unknown as { chrome?: { tabs?: { ungroup?: (ids: number | number[]) => Promise<void> } } }).chrome
                await chrome?.tabs?.ungroup?.(tabId)
            } catch (err) {
                console.debug(`[unmarkTabGroup] tab#${tabId}:`, err instanceof Error ? err.message : err)
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
        },
    },
})
