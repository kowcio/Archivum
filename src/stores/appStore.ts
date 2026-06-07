import { defineStore } from 'pinia'
import browser, { type Tabs } from 'webextension-polyfill'
import StorageService from '@/services/StorageService.ts'
import { tabStorageItem } from '@/utils/tabStorage'
import { TabRow } from '@/models/tabs/TabRow'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import { ClassifiedTabFactory } from '@/models/tabs/ClassifiedTab'
import { TabsSnapshot } from '@/models/tabs/TabsSnapshot'
import { APP_CONSTANTS, APP_DEFAULTS, THEME_COLORS } from '@/constants.ts'
import type { ThresholdLevel } from '@/constants'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { LBracketService } from '@/services/LBracketService'

// Re-export models consumed by external code
export type { ClassifiedTab }
export { AgeClassification, TabsSnapshot, AppThresholds, DEFAULT_THRESHOLDS }

/** Enriched tab row for display */
export type OptionsEnrichedTabRow = TabRow & {
  ordinal: number
  lastAccessAge: string
  rowStyle: Record<string, string>
}

type Nullable<T> = T | null

/** Unified application state combining config + tabs */
export type AppState = {
  // ─── Config ───────────────────────────────────────────────────────────
  appName: string
  version: string
  thresholds: AppThresholds
  configLastUpdated: number

  // ─── Tabs ─────────────────────────────────────────────────────────────
  tabs: ClassifiedTab[]
  isGrouped: boolean
  tabsLastUpdated: number

  // ─── Browser Capabilities ─────────────────────────────────────────────
  canGroup: boolean

  // ─── UI State ──────────────────────────────────────────────────────────
  loading: boolean
  error: Nullable<string>

  // ─── Internal State ────────────────────────────────────────────────────
  storageWatchersInitialized: boolean
}

// ─── Persisted State Types ────────────────────────────────────────────────
type PersistedConfigState = {
  appName: string
  version: string
  thresholds: { levels?: Partial<ThresholdLevel>[]; activeLevels?: number }
  configLastUpdated: number
}

export const useAppStore = defineStore(APP_CONSTANTS.STORE_GLOBAL_STORE, {
  state: (): AppState => ({
    // Config
    appName: APP_CONSTANTS.APP_NAME,
    version: APP_CONSTANTS.APP_VERSION,
    thresholds: DEFAULT_THRESHOLDS,
    configLastUpdated: Date.now(),

    // Tabs
    tabs: [],
    isGrouped: false,
    tabsLastUpdated: Date.now(),

    // Browser Capabilities
    canGroup: false,

    // UI
    loading: false,
    error: null,

    // Internal state
    storageWatchersInitialized: false,
  }),

  getters: {
    /**
     * Sorted, enriched tab rows — uses active thresholds from state
     * Optimized to minimize recalculations: only sorts when tabs change
     */
    tabRows(): OptionsEnrichedTabRow[] {
      // Reuse cached thresholds object
      const activeThresholds = this.thresholds

      // Single in-place sort without creating a copy first (more efficient)
      const sorted = this.tabs.slice().sort(
        (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
      )

      // Build rows in single pass
      const rows = TabRow.fromTabs(sorted, activeThresholds)

      return rows.map((row, index) => {
        const days = Number.isFinite(row.lastAccessDays) ? (row.lastAccessDays ?? 0) : 0
        const classification = AgeClassification.fromDays(days, activeThresholds)
        return Object.assign({}, row, {
          ordinal: index + 1,
          lastAccessAge: Number.isFinite(row.lastAccessDays) ? `${row.lastAccessDays}d` : '—',
          rowStyle: classification.inlineStyle,
        }) as OptionsEnrichedTabRow
      })
    },

    constants: (): typeof APP_CONSTANTS => APP_CONSTANTS,
  },

  actions: {
    // ─────────────────────────────────────────────────────────────────────
    // CONFIGURATION ACTIONS
    // ─────────────────────────────────────────────────────────────────────

    async setThresholds(patch: Partial<Record<number, Partial<ThresholdLevel>>>): Promise<void> {
      const updated = this.thresholds.merge(patch)
      if (!updated.isValid()) {
        console.warn('[appStore] Invalid thresholds rejected:', updated.toJSON())
        return
      }
      this.thresholds = updated
      await this.saveConfig()
    },

    async setActiveLevels(count: number): Promise<void> {
      const min = 1
      const max = APP_DEFAULTS.THRESHOLDS.presets.length
      if (count < min || count > max) {
        console.warn(`[appStore] Invalid activeLevels: ${count} (must be ${min}-${max})`)
        return
      }
      this.thresholds = this.thresholds.withActiveLevels(count)
      await this.saveConfig()
    },

    async resetToDefaults(): Promise<void> {
      this.thresholds = new AppThresholds(
        DEFAULT_THRESHOLDS.levels,
        DEFAULT_THRESHOLDS.activeLevels
      )
      await this.saveConfig()
    },

    async saveConfig(): Promise<void> {
      this.configLastUpdated = Date.now()
      await StorageService.set(APP_CONSTANTS.STORE_GLOBAL_STORE, {
        appName: this.appName,
        version: this.version,
        thresholds: this.thresholds.toJSON(),
        configLastUpdated: this.configLastUpdated,
      } as PersistedConfigState)
    },

    // ─────────────────────────────────────────────────────────────────────
    // TAB ACTIONS
    // ─────────────────────────────────────────────────────────────────────

    getAgeClassification(this: { thresholds: AppThresholds }, row: TabRow, thresholds: AppThresholds = this.thresholds): AgeClassification {
      const days = Number.isFinite(row.lastAccessDays) ? (row.lastAccessDays ?? 0) : 0
      return AgeClassification.fromDays(days, thresholds)
    },

    getLastAccessMsg(row: TabRow): string {
      const days = Number.isFinite(row.lastAccessDays) ? (row.lastAccessDays ?? 0) : NaN
      if (!Number.isFinite(days)) return '—'
      return days === 1 ? '1 day ago' : `${days} days ago`
    },

    async getAllOpenedTabs(): Promise<ClassifiedTab[]> {
      this.loading = true
      this.error = null
      try {
        const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
        const existingById = new Map(this.tabs.map(t => [t.id, t]))
        this.tabs = fetchedTabs.map(fetchedTab => {
          const existing = fetchedTab.id != null ? existingById.get(fetchedTab.id) : undefined
          const base = ClassifiedTabFactory.fromTab(fetchedTab, false)
          return existing != null
            ? Object.assign({}, base, { lastAccessed: existing.lastAccessed ?? fetchedTab.lastAccessed })
            : base
        })

        await this.markOldTabs()
        console.log('[appStore] Loaded:', this.tabs.length, 'tabs')
        await this.persistTabs()
        return this.tabs
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while loading tabs'
        return []
      } finally {
        this.loading = false
      }
    },

    async markOldTabs(): Promise<void> {
      this.error = null
      try {
        const activeThresholds = new AppThresholds(
          this.thresholds.levels,
          this.thresholds.activeLevels
        )
        const tabRows = TabRow.fromTabs(this.tabs, activeThresholds)

        // Build a map once instead of calling findIndex for every tab (O(n) instead of O(n²))
        const updateMap = new Map<number | undefined, { ageIndex: number; isMarked: boolean }>()

        for (const row of tabRows) {
          if (row.id == null) continue
          const classification = this.getAgeClassification(row, activeThresholds)
          updateMap.set(row.id, {
            ageIndex: classification.index,
            isMarked: !classification.isFresh,
          })
        }

        // Apply all updates in single pass
        this.tabs = this.tabs.map(tab => {
          const update = tab.id != null ? updateMap.get(tab.id) : undefined
          return Object.assign({}, tab, update || {})
        })
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while marking old tabs'
      }
    },

    async closeTab(tabId: number): Promise<ClassifiedTab[]> {
      this.error = null
      try {
        await browser.tabs.remove(tabId)
        // Use filter instead of findIndex + splice (cleaner and prevents accidental double-removal)
        this.tabs = this.tabs.filter((t) => t.id !== tabId)
        await this.persistTabs()
        return this.tabs
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while closing tab'
        return this.tabs
      }
    },

    async updateTabLastAccessed(tabId: number): Promise<void> {
      this.error = null
      try {
        const now = Date.now()

        // Use map-based lookup instead of findIndex (O(n) becomes O(1))
        let found = false
        this.tabs = this.tabs.map(t => {
          if (t.id === tabId) {
            found = true
            return Object.assign({}, t, { lastAccessed: now })
          }
          return Object.assign({}, t)
        })

        if (!found) {
          console.warn(`[appStore] Tab#${tabId} not found for lastAccessed update`)
          return
        }

        await this.persistTabs()
        console.log(`[appStore] Updated tab#${tabId} lastAccessed to ${new Date(now).toISOString()}`)
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while updating tab lastAccessed'
      }
    },

    async loadMockTabs(): Promise<void> {
      this.loading = true
      this.error = null

      const MOCK_TABS: { url: string; daysAgo: number }[] = [
        { url: 'https://en.wikipedia.org/wiki/Main_Page', daysAgo: 1 },
        { url: 'https://codeberg.com', daysAgo: 5 },
        { url: 'https://developer.mozilla.org', daysAgo: 10 },
        { url: 'https://stackoverflow.com', daysAgo: 13 },
        { url: 'https://www.youtube.com', daysAgo: 16 },
        { url: 'https://www.kowalskipiotr.pl', daysAgo: 19 },
        { url: 'https://news.wykop.pl', daysAgo: 22 },
        { url: 'https://www.reddit.com', daysAgo: 25 },
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

        const newMockTabs = loadedTabs.map((tab, idx) => {
          const classified = ClassifiedTabFactory.fromTab(tab, false)
          return Object.assign({}, classified, {
            lastAccessed: now - (MOCK_TABS[idx]?.daysAgo ?? 0) * DAY_MS,
          })
        })

        const existingIds = new Set(this.tabs.map(t => t.id))
        const trulyNew = newMockTabs.filter(t => !existingIds.has(t.id))

        this.tabs = [...this.tabs, ...trulyNew]
        this.error = null
        await this.persistTabs()
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while loading mock tabs'
      } finally {
        this.loading = false
      }
    },

    async reset(): Promise<void> {
      this.error = null
      this.loading = true
      try {
        const markedIds = new Set(
          this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id as number),
        )

        if (this.isGrouped) await this.ungroupAllTabs()
        await Promise.all(Array.from(markedIds).map(tabId => LBracketService.removeBracket(tabId).catch(() => {
          // Silently fail on restricted pages (chrome://, extensions pages)
          console.debug(`[appStore] Could not remove bracket from tab#${tabId} (restricted page)`)
        })))

        this.isGrouped = false
        await this.persistTabs()
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while resetting tabs'
      } finally {
        this.loading = false
      }
    },

    async groupTabsByAge(): Promise<number> {
      this.error = null
      this.loading = true
      try {
        if (!this.canGroup) {
          this.error = 'Tab grouping not supported in this browser'
          return 0
        }

        // Delegate to background service via message — background holds source of truth
        const response = await browser.runtime.sendMessage<{ action: string }, { groupsCreated?: number; error?: string }>({
          action: 'groupTabsByAge',
        })

        if (response?.error) {
          this.error = response.error
          return 0
        }

        this.isGrouped = true
        await this.persistTabs()
        return response?.groupsCreated ?? 0
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error while grouping tabs by age'
        return 0
      } finally {
        this.loading = false
      }
    },

    async ungroupAllTabs(): Promise<void> {
      this.error = null
      this.loading = true
      try {
        const allTabIds = this.tabs.map(t => t.id).filter((id): id is number => id != null)
        if (allTabIds.length > 0) {
          try {
            // Use universal browser API (Chrome/Edge only, Firefox gracefully fails)
            await (browser.tabs as any).ungroup(allTabIds)
          } catch (err) {
            // Feature not available (Firefox) — graceful fallback
            console.debug('[appStore] ungroup not available:', err)
          }
        }
        this.isGrouped = false
        await this.persistTabs()
      } catch (err) {
        console.error('[appStore] Error ungrouping tabs:', err)
        this.isGrouped = false
        await this.persistTabs()
      } finally {
        this.loading = false
      }
    },

    async performExtensionCleanup(): Promise<void> {
      await ExtensionCleanupService.performFullCleanup()
      this.isGrouped = false
      await this.persistTabs()
    },

    // ─────────────────────────────────────────────────────────────────────
    // PERSISTENCE & SYNC
    // ─────────────────────────────────────────────────────────────────────

    _snapshotTabs(): TabsSnapshot {
      return new TabsSnapshot(this.tabs, this.isGrouped, new Date().toISOString())
    },

    async persistTabs(): Promise<void> {
      this.tabsLastUpdated = Date.now()
      await tabStorageItem.setValue(this._snapshotTabs())
    },

    async loadTabsHistory(): Promise<ClassifiedTab[]> {
      this.loading = true
      this.error = null
      try {
        const snapshot = await tabStorageItem.getValue()
        if (snapshot?.tabs) {
          const rawTabs = Array.isArray(snapshot.tabs)
            ? snapshot.tabs
            : Object.values(snapshot.tabs as Record<string, unknown>)

          // Convert to plain objects to avoid Proxy serialization issues
          this.tabs = rawTabs.map(t => {
            const tab = t as unknown as Record<string, any>
            return Object.assign({}, tab, {
              isMarked: tab.isMarked ?? false,
              ageIndex: tab.ageIndex ?? 0,
              markedFaviconDataUrl: tab.markedFaviconDataUrl ?? undefined,
            }) as ClassifiedTab
          })

          this.isGrouped = snapshot.isGrouped ?? false
          console.log('[appStore] Restored', this.tabs.length, 'tabs from storage')
        } else {
          // No tabs in storage yet - start with empty array
          this.tabs = []
          this.isGrouped = false
          console.log('[appStore] No saved tabs, starting fresh')
        }
        return this.tabs
      } catch (err) {
        console.error('[appStore] Error loading tabs history:', err)
        // Ensure tabs array exists even if loading fails
        this.tabs = []
        this.isGrouped = false
        return []
      } finally {
        this.loading = false
      }
    },

    initStorageSync(): void {
      // Guard: Only initialize watchers once (plugin + init() both try to call this)
      // This is necessary because both appStoreSyncPlugin (via Pinia hook) and
      // AppBootstrapper (calling init()) may run initialization. The guard ensures
      // watchers are set up exactly once, preventing duplicate listeners.
      if (this.storageWatchersInitialized) return
      this.storageWatchersInitialized = true

      let lastTabPatchTime = 0
      let lastTabCount = this.tabs.length

      // Watch tabs storage
      tabStorageItem.watch((snapshot) => {
        if (!snapshot?.tabs) return

        const rawTabs = Array.isArray(snapshot.tabs)
          ? snapshot.tabs
          : Object.values(snapshot.tabs as Record<string, unknown>)

        // GATE: Ignore own changes within 100ms (persistTabs → watch → $patch delay)
        const now = Date.now()
        if (now - lastTabPatchTime < 100 && rawTabs.length === lastTabCount) {
          return
        }
        lastTabPatchTime = now
        lastTabCount = rawTabs.length

        // Convert to plain objects to avoid Proxy serialization issues
        // Use Object.assign to ensure all Tabs.Tab properties are preserved
        const restoredTabs: ClassifiedTab[] = rawTabs.map(t => {
          const tab = t as unknown as Record<string, any>
          return Object.assign({}, tab, {
            isMarked: tab.isMarked ?? false,
            ageIndex: tab.ageIndex ?? 0,
            markedFaviconDataUrl: tab.markedFaviconDataUrl ?? undefined,
          }) as ClassifiedTab
        })

        this.$patch({
          tabs: restoredTabs,
          isGrouped: snapshot.isGrouped ?? false,
          tabsLastUpdated: Date.now(),
        })
        console.debug('[appStore] Tab storage sync: received', restoredTabs.length, 'tabs')
      })

      // Watch config storage
      StorageService.onChanged((changes) => {
        const payload = changes[APP_CONSTANTS.STORE_GLOBAL_STORE] as PersistedConfigState | undefined
        if (!payload) return
        if (payload.configLastUpdated && payload.configLastUpdated === this.configLastUpdated) return

        this.appName = payload.appName ?? this.appName
        this.configLastUpdated = payload.configLastUpdated ?? this.configLastUpdated
        if (payload.thresholds?.levels) {
          const merged = this.thresholds.merge(
            Object.fromEntries(
              payload.thresholds.levels.map((level, idx) => [idx, level])
            )
          )
          this.thresholds = merged.withActiveLevels(payload.thresholds.activeLevels ?? this.thresholds.activeLevels)
        }
        console.debug('[appStore] Config storage sync: thresholds updated')
      })

      console.debug('[appStore] Storage sync initialized (tabs + config watchers)')
    },

    async loadConfig(): Promise<void> {
      try {
        const data = await StorageService.get<PersistedConfigState>(APP_CONSTANTS.STORE_GLOBAL_STORE)
        if (data) {
          this.appName = data.appName ?? this.appName
          this.configLastUpdated = data.configLastUpdated ?? this.configLastUpdated
          if (data.thresholds?.levels) {
            const merged = DEFAULT_THRESHOLDS.merge(
              Object.fromEntries(
                data.thresholds.levels.map((level, idx) => [idx, level])
              )
            )
            this.thresholds = merged.withActiveLevels(data.thresholds.activeLevels ?? DEFAULT_THRESHOLDS.activeLevels)
          }
          console.debug('[appStore] Config loaded from storage')
        } else {
          await this.saveConfig()
        }

        const runtimeVersion = await this.getRuntimeVersion()
        if (runtimeVersion) this.version = runtimeVersion
      } catch (err) {
        console.error('[appStore] Error loading config:', err)
        // Save defaults if loading fails
        await this.saveConfig()
      }
    },

    async getRuntimeVersion(): Promise<string | undefined> {
      try {
        const browserNs = (globalThis as unknown as {
          browser?: { runtime?: { getManifest?: () => { version: string } } };
          chrome?: { runtime?: { getManifest?: () => { version: string } } }
        }).browser
          ?? (globalThis as unknown as {
          chrome?: { runtime?: { getManifest?: () => { version: string } } }
        }).chrome
        return browserNs?.runtime?.getManifest?.()?.version
      } catch {
        return undefined
      }
    },

    async init(): Promise<void> {
      console.debug('[appStore] Initializing unified store...')
      try {
        // Load config first (needed for threshold validation)
        await this.loadConfig()
        console.debug('[appStore] Config initialized')
      } catch (err) {
        console.error('[appStore] Fatal error loading config:', err)
        // Ensure state has valid defaults even if loading fails
        this.thresholds = DEFAULT_THRESHOLDS
      }

      try {
        // Load tabs history
        await this.loadTabsHistory()
        console.debug('[appStore] Tabs initialized')
      } catch (err) {
        console.error('[appStore] Fatal error loading tabs history:', err)
        // Ensure tabs array exists even if loading fails
        this.tabs = []
      }

      try {
        // Detect browser grouping capability once and cache in state
        this.canGroup = browser.tabGroups != null
        console.debug('[appStore] Browser capability detected: canGroup =', this.canGroup)
      } catch {
        this.canGroup = false
      }

      // Initialize unified storage sync (both tabs + config in single watcher setup)
      this.initStorageSync()

      console.debug('[appStore] ✅ Initialization complete')
    },
  },
})

// Backward compatibility exports
export const useGlobalStore = useAppStore
export const useTabStore = useAppStore

