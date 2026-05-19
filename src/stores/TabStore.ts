import { defineStore } from 'pinia'
import browser, { type Storage, type Tabs } from 'webextension-polyfill'
import { TabRow } from '@/models/tabs/TabRow'
import { TabDot, TabDots, DOT_COLOR_MAP, GROUP_COLOR_MAP, type TabGroupColor } from '@/services/TabDots.ts'
import { useGlobalStore, DEFAULT_THRESHOLDS } from '@/stores/globalStore'

export const TAB_HISTORY_KEY = 'tab_history'

export interface AgeClassification {
    cssClass: string
    color: string
    days: number
    dot: TabDot
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
                console.log('Loaded opened tabs:', fetchedTabs)
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
        ): Promise<Tabs.Tab[]> {
            this.loading = true
            this.error = null
            try {
                const result = await storage.get(TAB_HISTORY_KEY)
                const snapshot = result?.[TAB_HISTORY_KEY] as TabsSnapshot | undefined
                console.log('Loaded saved tabs:', snapshot?.tabs)
                if (snapshot) {
                    // browser.storage.local may deserialize arrays as {0:…, 1:…} objects
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

        async markOldTabs(): Promise<void> {
            this.error = null
            try {
                const boundaries = useGlobalStore().thresholdsArray
                const tabRows = TabRow.fromTabs(this.tabs, boundaries)
                console.log(`[markOldTabs] boundaries=${JSON.stringify(boundaries)} tabs=${tabRows.length}`)
                await Promise.all(
                    tabRows.map(async (row) => {
                        if (row.id == null) return
                        const { color, dot, days, classificationIndex } = this.getAgeClassification(row, boundaries)
                        console.log(`[markOldTabs] tab#${row.id} days=${days} dot="${dot}" color=${color} title="${row.title?.slice(0,40)}"`)
                        // Always apply favicon overlay (works for all age groups incl. fresh)
                        await this.markTabWithFaviconOverlay(row.id, color)
                        await this.markTabWithBadge(row.id, TabDot.Bullet, color)
                        await this.markTabWithGroupColor(row.id, GROUP_COLOR_MAP[classificationIndex])
                        // Title dot prefix disabled — kept for future reference:
                        // if (dot) await this.markTabWithTitle(row.id, `${dot} `)
                        // else await this.resetTabTitle(row.id)
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
                const msg = err instanceof Error ? err.message : String(err)
                console.warn(`[markTabWithTitle] tab#${tabId} failed:`, msg)
                this.error = msg
            }
        },

        async markTabWithBadge(tabId: number, text: string = '●', color: string = '#e53935'): Promise<void> {
            this.error = null
            try {
                await browser.action.setBadgeText({ text, tabId })
                await browser.action.setBadgeBackgroundColor({ color, tabId })
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.warn(`[markTabWithBadge] tab#${tabId} failed:`, msg)
                this.error = msg
                return
            }
            // setBadgeTextColor is not in webextension-polyfill — call chrome API directly (Chrome 110+)
            try {
                const chromeAction = (globalThis as unknown as { chrome?: { action?: { setBadgeTextColor?: (d: object) => void } } }).chrome?.action
                chromeAction?.setBadgeTextColor?.({ color: '#ffffff', tabId })
            } catch {
                // older Chrome / Firefox — not critical, badge colour still applies
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
                        await this.unmarkTabGroup(row.id)
                        await this.removeFaviconOverlay(row.id)
                    }),
                )
                // Strip dot prefixes from store tab titles
                this.tabs = this.tabs.map((tab) => ({
                    ...tab,
                    title: tab.title ? TabDots.stripDotPrefix(tab.title) : tab.title,
                }))
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
                        await this.removeFaviconOverlay(row.id)
                        await this.unmarkTabBadge(row.id)
                        await this.unmarkTabGroup(row.id)
                    }),
                )
                // Refresh tabs from browser to get clean original titles
                const freshTabs = await this.getAllOpenedTabs()
                console.log('[clearDotsFromOpenTabs] refreshed tabs from browser:', freshTabs.length)
            } catch (err) {
                this.error = err instanceof Error ? err.message : 'Unknown error while clearing dots from open tabs'
            }
        },

        getDotFromColor(color: string): string {
            return TabDots.dotFromColor(color)
        },

        /** Injects a coloured ring around the tab favicon (Chrome + Firefox). */
        async markTabWithFaviconOverlay(tabId: number, color: string): Promise<void> {
            try {
                // Pre-fetch favicon from extension context (full cross-origin access)
                // then pass as data URL to the page script — avoids CORS in content script
                const tab = this.tabs.find((t) => t.id === tabId)
                const faviconDataUrl = tab?.favIconUrl
                    ? await TabDots.fetchFaviconDataUrl(tab.favIconUrl)
                    : null

                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.applyFaviconOverlayPageScript,
                    args: [color, faviconDataUrl],
                })
            } catch (err) {
                console.debug(`[markTabWithFaviconOverlay] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /** Removes the injected favicon ring overlay. */
        async removeFaviconOverlay(tabId: number): Promise<void> {
            try {
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: TabDots.removeFaviconOverlayPageScript,
                    args: [],
                })
            } catch (err) {
                console.debug(`[removeFaviconOverlay] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /** Groups a tab and sets its group color (Chrome-only, no-op on Firefox). */        async markTabWithGroupColor(tabId: number, color: TabGroupColor): Promise<void> {
            try {
                const chrome = (globalThis as unknown as { chrome?: { tabs?: { group?: (o: object) => Promise<number> }, tabGroups?: { update?: (id: number, o: object) => Promise<void> } } }).chrome
                if (!chrome?.tabs?.group || !chrome?.tabGroups?.update) return
                const groupId = await chrome.tabs.group({ tabIds: tabId })
                await chrome.tabGroups.update(groupId, { color })
            } catch (err) {
                // tab groups not supported (Firefox) or tab not accessible — silent fail
                console.debug(`[markTabWithGroupColor] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
        },

        /** Removes a tab from its group (Chrome-only, no-op on Firefox). */
        async unmarkTabGroup(tabId: number): Promise<void> {
            try {
                const chrome = (globalThis as unknown as { chrome?: { tabs?: { ungroup?: (ids: number | number[]) => Promise<void> } } }).chrome
                await chrome?.tabs?.ungroup?.(tabId)
            } catch (err) {
                console.debug(`[unmarkTabGroup] tab#${tabId}:`, err instanceof Error ? err.message : err)
            }
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

                const groupMeta: Array<{ dot: string; label: string; color: string }> = [
                    { dot: '🟢', label: `🟢 Fresh (<${young}d)`,   color: 'green'  },
                    { dot: '🟡', label: `🟡 Young (${young}d+)`,   color: 'yellow' },
                    { dot: '🟠', label: `🟠 Middle (${middle}d+)`, color: 'orange' },
                    { dot: '🔴', label: `🔴 Old (${old}d+)`,       color: 'red'    },
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
    },
})
