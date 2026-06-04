import { defineStore } from 'pinia'
import browser, { type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { LBracketService } from '@/services/LBracketService'
import { useGlobalStore } from '@/stores/globalStore'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import { ClassifiedTabFactory } from '@/models/tabs/ClassifiedTab'
import { TabsSnapshot } from '@/models/tabs/TabsSnapshot'
import { tabStorageItem } from '@/utils/tabStorage'
import {APP_CONSTANTS} from "@/constants.ts";

// Re-export models consumed by external code (App.vue, tests)
export type { ClassifiedTab }
export { AgeClassification, TabsSnapshot }

/**
 * TabRow enriched with display-only fields computed at render time.
 * Returned by the tabRows getter — use this type in components.
 */
export type OptionsEnrichedTabRow = TabRow & {
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

export const useTabStore = defineStore(APP_CONSTANTS.STORE_TAB_STORE, {
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
        tabRows(): OptionsEnrichedTabRow[] {
            const globalStore = useGlobalStore()
            const thresholds = globalStore.thresholds

            const sorted = [...this.tabs].sort(
                (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
            )

            return TabRow.fromTabs(sorted, thresholds).map((row, index) => {
                const days = Number.isFinite(row.lastAccessDays) ? (row.lastAccessDays ?? 0) : 0
                const classification = AgeClassification.fromDays(days, thresholds)
                return {
                    ...row,
                    ordinal: index + 1,
                    lastAccessAge: Number.isFinite(row.lastAccessDays) ? `${row.lastAccessDays}d` : '—',
                    lastAccessClass: classification.cssClass,
                } as OptionsEnrichedTabRow
            })
        },
    },

    actions: {
        // ─── Storage ──────────────────────────────────────────────────────────────

        /**
         * Builds a TabsSnapshot from current local state.
         *
         * ⚠️  Write pattern & race condition note:
         *
         *   Every mutating action follows this sequence:
         *     1. Mutate this.tabs / this.isGrouped synchronously (local store, instant Vue update)
         *     2. Call tabStorageItem.setValue(this._snapshot())
         *        → triggers browser.storage.onChanged
         *        → initStorageSync() watch fires in ALL contexts (including this one) asynchronously
         *        → $patch() updates every Pinia instance on next event-loop tick
         *
         *   Step 1 is redundant for THIS context (the watch will $patch the same data a tick later)
         *   but it guarantees instant local reactivity without waiting for the storage round-trip.
         *
         *   ⚠️  Rare race condition — last-write-wins:
         *   If two contexts write simultaneously (e.g. popup calls groupTabsByAge() while the
         *   background alarm calls loadAndMarkTabs() at the same time), one write will overwrite
         *   the other because each write is a full snapshot replacement (no partial merge).
         *
         *   This is acceptable for a tab-age tracker — the next alarm cycle will self-correct.
         *   If partial writes ever become critical, migrate to storage.setMeta() or a versioned
         *   snapshot with a vector clock.
         */
        _snapshot(): TabsSnapshot {
            return new TabsSnapshot(this.tabs, this.isGrouped, new Date().toISOString())
        },

        /** Persists current state to storage so all contexts stay in sync. */
        async _persist(): Promise<void> {
            await tabStorageItem.setValue(this._snapshot())
        },

        // ─── Read ─────────────────────────────────────────────────────────────────

        /**
         * Hydrates store from the last persisted snapshot in storage.
         * Called by tabStoreSyncPlugin on store creation (crash recovery / cross-context hydration).
         *
         * Restores full ClassifiedTab shape (isMarked, ageIndex, markedFaviconDataUrl)
         * — does NOT reset them to defaults via ClassifiedTabFactory, so marked tabs
         * keep their visual state across popup open/close cycles.
         */
        async loadTabsHistory(): Promise<ClassifiedTab[]> {
            this.loading = true
            this.error = null
            try {
                const snapshot = await tabStorageItem.getValue()
                if (snapshot?.tabs) {
                    const rawTabs = Array.isArray(snapshot.tabs)
                        ? snapshot.tabs
                        : Object.values(snapshot.tabs as Record<string, unknown>)

                    // Preserve all ClassifiedTab fields stored in the snapshot.
                    // The snapshot stores ClassifiedTab[] (with isMarked, ageIndex, markedFaviconDataUrl),
                    // so we cast directly instead of going through ClassifiedTabFactory which would
                    // reset ageIndex → 0 and markedFaviconDataUrl → undefined.
                    this.tabs = rawTabs.map(t => ({
                        ...(t as Tabs.Tab),
                        isMarked:             (t as ClassifiedTab).isMarked             ?? false,
                        ageIndex:             (t as ClassifiedTab).ageIndex             ?? 0,
                        markedFaviconDataUrl: (t as ClassifiedTab).markedFaviconDataUrl ?? undefined,
                    })) as ClassifiedTab[]

                    this.isGrouped = snapshot.isGrouped ?? false
                    console.log('[loadTabsHistory] Restored', this.tabs.length, 'tabs from storage, isGrouped:', this.isGrouped)
                }
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs history'
                return []
            } finally {
                this.loading = false
            }
        },

        /**
         * Subscribes to storage changes from any context via WXT typed watch().
         * Called by tabStoreSyncPlugin — no component should call this directly.
         * Returns unwatch — called automatically on store.$dispose().
         *
         * Flow (any context → this store):
         *   tabStorageItem.setValue() → storage.onChanged → watch callback → $patch() → Vue
         *
         * ⚠️  Same-context watch timing:
         *   When THIS context calls setValue(), the watch fires asynchronously (next event loop tick).
         *   this.tabs is already updated synchronously above the setValue call, so the $patch
         *   here will be idempotent (same data). No visual glitch, no double-render concern.
         *
         * ⚠️  Field preservation:
         *   Restores full ClassifiedTab shape — same logic as loadTabsHistory().
         */
        initStorageSync(): () => void {
            const unwatch = tabStorageItem.watch((snapshot) => {
                if (!snapshot?.tabs) return

                const rawTabs = Array.isArray(snapshot.tabs)
                    ? snapshot.tabs
                    : Object.values(snapshot.tabs as Record<string, unknown>)

                const restoredTabs: ClassifiedTab[] = rawTabs.map(t => ({
                    ...(t as Tabs.Tab),
                    isMarked:             (t as ClassifiedTab).isMarked             ?? false,
                    ageIndex:             (t as ClassifiedTab).ageIndex             ?? 0,
                    markedFaviconDataUrl: (t as ClassifiedTab).markedFaviconDataUrl ?? undefined,
                })) as ClassifiedTab[]

                this.$patch({
                    tabs:      restoredTabs,
                    isGrouped: snapshot.isGrouped ?? false,
                })
                console.debug('[TabStore] Storage sync: received', restoredTabs.length, 'tabs, isGrouped:', snapshot.isGrouped)
            })
            return unwatch
        },

        // ─── Mutations ────────────────────────────────────────────────────────────

        /**
         * Fetches current window tabs, merges with store state, marks old tabs.
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

                console.log('[getAllOpenedTabs] Loaded:', this.tabs.length, 'tabs')

                // Write to storage → watch fires async in all contexts (including this one, idempotent)
                await tabStorageItem.setValue(this._snapshot())
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
                await tabStorageItem.setValue(this._snapshot())
                return this.tabs
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while closing tab'
                return this.tabs
            }
        },

        /**
         * Updates a tab's lastAccessed timestamp to now.
         * Called when tab is activated in the background service worker.
         * Automatically triggers storage sync → all contexts re-render.
         */
        async updateTabLastAccessed(tabId: number): Promise<void> {
            this.error = null
            try {
                const now = Date.now()
                const tabIndex = this.tabs.findIndex(t => t.id === tabId)
                if (tabIndex === -1) {
                    console.warn(`[TabStore] Tab#${tabId} not found for lastAccessed update`)
                    return
                }
                this.tabs[tabIndex] = {
                    ...this.tabs[tabIndex],
                    lastAccessed: now,
                }
                await tabStorageItem.setValue(this._snapshot())
                console.log(`[TabStore] Updated tab#${tabId} lastAccessed to ${new Date(now).toISOString()}`)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while updating tab lastAccessed'
            }
        },

        // ─── Helpers (non-persisting internal) ───────────────────────────────────

        getAgeClassification(
            row: TabRow,
            thresholds: AppThresholds = DEFAULT_THRESHOLDS,
        ): AgeClassification {
            const days = Number.isFinite(row.lastAccessDays) ? row.lastAccessDays ?? 0 : 0
            return AgeClassification.fromDays(days, thresholds)
        },

        getLastAccessMsg(row: TabRow): string {
            const days = Number.isFinite(row.lastAccessDays) ? row.lastAccessDays ?? 0 : NaN
            if (!Number.isFinite(days)) return '—'
            return days === 1 ? '1 day ago' : `${days} days ago`
        },

        /** Marks tabs with age classification. No visual L-bracket overlay. */
        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const thresholds = useGlobalStore().thresholds
                const tabRows = TabRow.fromTabs(this.tabs, thresholds)

                for (const row of tabRows) {
                    if (row.id == null) continue

                    const classification = this.getAgeClassification(row, thresholds)
                    const tabIndex = this.tabs.findIndex(t => t.id === row.id)

                    if (tabIndex !== -1) {
                        this.tabs[tabIndex] = {
                            ...this.tabs[tabIndex],
                            ageIndex: classification.index,
                        }
                    }
                }
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
            }
        },

        /**
         * Marks a tab with the L-bracket age indicator.
         * Internal — called by markOldTabs(). The caller is responsible for persisting.
         */
        async markTabWithLBracket(tabId: number, color: string): Promise<void> {
            this.tabs = this.tabs.map(t =>
                t.id === tabId ? { ...t, isMarked: true } : t
            )

            try {
                const tab = this.tabs.find(t => t.id === tabId)
                if (!tab) return

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

                const renderedDataUrl = await LBracketService.applyBracket(tabId, rawFaviconUrl, color)

                this.tabs = this.tabs.map(t =>
                    t.id === tabId ? { ...t, markedFaviconDataUrl: renderedDataUrl } : t
                )
            } catch (err) {
                console.debug(`[markTabWithLBracket] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /** Removes the L-bracket favicon overlay and restores the original favicon. Internal. */
        async removeLBracket(tabId: number): Promise<void> {
            try {
                await LBracketService.removeBracket(tabId)
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
         *
         * New mock tabs are ADDED to the existing store — duplicate URLs are intentional
         * (e.g. YouTube opened 4× with different ages). Existing tabs are untouched.
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
            const now    = Date.now()

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
                    const complete  = loadedTabs.filter(t => t.status === 'complete').length
                    const favicons  = loadedTabs.filter(t => t.favIconUrl).length
                    if (complete === tabIds.length && favicons >= Math.ceil(tabIds.length * 0.7)) break
                }

                const newMockTabs = loadedTabs.map((tab, idx) => ({
                    ...ClassifiedTabFactory.fromTab(tab, false),
                    lastAccessed: now - (MOCK_TABS[idx]?.daysAgo ?? 0) * DAY_MS,
                }))

                const existingIds = new Set(this.tabs.map(t => t.id))
                const trulyNew    = newMockTabs.filter(t => !existingIds.has(t.id))

                this.tabs  = [...this.tabs, ...trulyNew]
                this.error = null
                await tabStorageItem.setValue(this._snapshot())
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while loading mock tabs'
            } finally {
                this.loading = false
            }
        },

        /** Resets marking only: removes L-bracket overlays but preserves lastAccessed timestamps. */
        async reset(): Promise<void> {
            this.error   = null
            this.loading = true
            try {
                const markedIds = new Set(
                    this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id as number),
                )

                if (this.isGrouped) await this.ungroupAllTabs()

                await Promise.all(Array.from(markedIds).map(tabId => this.removeLBracket(tabId)))

                this.isGrouped = false
                await tabStorageItem.setValue(this._snapshot())
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while resetting tabs'
            } finally {
                this.loading = false
            }
        },

        /** Groups Middle + Old + Young tabs by age using Chrome tab groups API. */
        async groupTabsByAge(): Promise<number> {
            this.error   = null
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

                const thresholds   = useGlobalStore().thresholds
                const oldTabIds:    number[] = []
                const middleTabIds: number[] = []
                const youngTabIds:  number[] = []

                const sortedRows = [...TabRow.fromTabs(this.tabs, thresholds)]
                    .sort((a, b) => (b.lastAccess ?? 0) - (a.lastAccess ?? 0))

                for (const row of sortedRows) {
                    if (row.id == null) continue
                    const c = this.getAgeClassification(row, thresholds)
                    if      (c.isOld)    oldTabIds.push(row.id)
                    else if (c.isMiddle) middleTabIds.push(row.id)
                    else if (c.isYoung)  youngTabIds.push(row.id)
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

                const oldGroupId    = await createGroup(oldTabIds,    `🔴 Old (${thresholds.old}d+)`,      'red')
                const middleGroupId = await createGroup(middleTabIds, `🟠 Middle (${thresholds.middle}d+)`, 'orange')
                const youngGroupId  = await createGroup(youngTabIds,  `🟡 Young (${thresholds.young}d+)`,  'yellow')

                if (chromeApi.tabGroups?.move) {
                    for (const id of [youngGroupId, middleGroupId, oldGroupId]) {
                        if (id !== null) {
                            try { await chromeApi.tabGroups.move(id, { index: 0 }) } catch { /* silent */ }
                        }
                    }
                }

                this.isGrouped = true
                await tabStorageItem.setValue(this._snapshot())
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
            this.error   = null
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
                await tabStorageItem.setValue(this._snapshot())
            } catch {
                this.isGrouped = false
                await tabStorageItem.setValue(this._snapshot())
            } finally {
                this.loading = false
            }
        },

        /** Triggers full extension cleanup on disable/uninstall. */
        async performExtensionCleanup(): Promise<void> {
            await ExtensionCleanupService.performFullCleanup()
            this.isGrouped = false
            await tabStorageItem.setValue(this._snapshot())
        },
    },
})
