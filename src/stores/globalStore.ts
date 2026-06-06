import {defineStore} from 'pinia'
import StorageService from '@/services/StorageService.ts'
import {APP_CONSTANTS, APP_DEFAULTS} from "@/constants.ts";
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import type { ThresholdLevel } from '@/constants'

export { AppThresholds, DEFAULT_THRESHOLDS }

export type GlobalState = {
  appName: string
  version: string
  thresholds: AppThresholds
  lastUpdated: number
}

// ─── Partial type used when loading from storage ──────────────────────────────
type PersistedState = Partial<Omit<GlobalState, 'thresholds'>> & {
  thresholds?: { levels?: Partial<ThresholdLevel>[]; activeLevels?: number }
}


export const useGlobalStore = defineStore(APP_CONSTANTS.STORE_GLOBAL_STORE, {
  state: (): GlobalState => ({
    appName: APP_CONSTANTS.APP_NAME,
    version: APP_CONSTANTS.APP_VERSION,
    thresholds: DEFAULT_THRESHOLDS,
    lastUpdated: Date.now(),
  }),

  getters: {
    /** Expose constants so any component can read them via the store */
    constants: (): typeof APP_CONSTANTS => APP_CONSTANTS,
  },

  actions: {
    /** Merge partial threshold changes and persist. */
    async setThresholds(patch: Partial<Record<number, Partial<ThresholdLevel>>>): Promise<void> {
      const updated = this.thresholds.merge(patch)
      if (!updated.isValid()) {
        console.warn('[globalStore] Invalid thresholds rejected:', updated.toJSON())
        return
      }
      this.thresholds = updated
      await this.save()
    },

    /** Update the number of active threshold levels */
    async setActiveLevels(count: number): Promise<void> {
      const min = 1
      const max = APP_DEFAULTS.THRESHOLDS.presets.length
      if (count < min || count > max) {
        console.warn(`[globalStore] Invalid activeLevels: ${count} (must be ${min}-${max})`)
        return
      }
      this.thresholds = this.thresholds.withActiveLevels(count)
      await this.save()
    },

    async load(): Promise<void> {
      const data = await StorageService.get<PersistedState>(APP_CONSTANTS.STORE_GLOBAL_STORE)
      if (data) {
        this.appName = data.appName ?? this.appName
        this.lastUpdated = data.lastUpdated ?? this.lastUpdated
        // Deep-merge thresholds so missing keys fall back to defaults
        if (data.thresholds?.levels) {
          const merged = DEFAULT_THRESHOLDS.merge(
            Object.fromEntries(
              data.thresholds.levels.map((level, idx) => [idx, level])
            )
          )
          this.thresholds = merged.withActiveLevels(data.thresholds.activeLevels ?? DEFAULT_THRESHOLDS.activeLevels)
        }
      } else {
        // First time — persist the defaults
        await this.save()
      }

      // Prefer the extension manifest version over the build-time value
      const runtimeVersion = await this.getRuntimeVersion()
      if (runtimeVersion) this.version = runtimeVersion
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
        // not running inside an extension context
      }
      return undefined
    },

    async save(): Promise<void> {
      this.lastUpdated = Date.now()
      await StorageService.set(APP_CONSTANTS.STORE_GLOBAL_STORE, {
        appName: this.appName,
        version: this.version,
        thresholds: this.thresholds.toJSON(),
        lastUpdated: this.lastUpdated,
      })
    },

    initStorageSync(): void {
      StorageService.onChanged((changes) => {
        const payload = changes[APP_CONSTANTS.STORE_GLOBAL_STORE] as PersistedState | undefined
        if (!payload) return
        if (payload.lastUpdated && payload.lastUpdated === this.lastUpdated) return
        this.appName = payload.appName ?? this.appName
        this.lastUpdated = payload.lastUpdated ?? this.lastUpdated
        if (payload.thresholds?.levels) {
          const merged = this.thresholds.merge(
            Object.fromEntries(
              payload.thresholds.levels.map((level, idx) => [idx, level])
            )
          )
          this.thresholds = merged.withActiveLevels(payload.thresholds.activeLevels ?? this.thresholds.activeLevels)
        }
      })
    },

    async init(): Promise<void> {
      await this.load()
      this.initStorageSync()
    },
  },
})
