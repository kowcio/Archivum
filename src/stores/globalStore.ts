import {defineStore} from 'pinia'
import StorageService from '@/services/StorageService.ts'
import {APP_CONSTANTS, APP_DEFAULTS} from "@/constants.ts";

export type AppThresholds = {
  young: number   // 0..young → 🟢 fresh
  middle: number  // young..middle → 🟡 yellow
  old: number     // middle..old → 🟠 orange, >old → 🔴 red
}

export type AppFlags = {
  thresholds: AppThresholds
}

export type GlobalState = {
  appName: string
  version: string
  flags: AppFlags
  lastUpdated: number
}

// ─── Partial type used when loading from storage ──────────────────────────────
type PersistedState = Partial<Omit<GlobalState, 'flags'>> & { flags?: Partial<AppFlags> }

export const DEFAULT_THRESHOLDS: AppThresholds = {
  young:  APP_DEFAULTS.THRESHOLDS.YOUNG,
  middle: APP_DEFAULTS.THRESHOLDS.MIDDLE,
  old:    APP_DEFAULTS.THRESHOLDS.OLD,
}


export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    appName: APP_CONSTANTS.APP_NAME,
    version: APP_CONSTANTS.APP_VERSION,
    flags: {
      thresholds: { ...DEFAULT_THRESHOLDS },
    },
    lastUpdated: Date.now(),
  }),

  getters: {
    /** Current thresholds as sorted array [young, middle, old] */
    thresholdsArray: (state): readonly [number, number, number] => [
      state.flags.thresholds.young,
      state.flags.thresholds.middle,
      state.flags.thresholds.old,
    ],
    /** Expose constants so any component can read them via the store */
    constants: (): typeof APP_CONSTANTS => APP_CONSTANTS,
  },

  actions: {
    /** Merge partial flag changes and persist. */
    async setFlags(patch: Partial<AppFlags>): Promise<void> {
      this.flags = {
        ...this.flags,
        ...patch,
        // Deep-merge thresholds if provided
        thresholds: patch.thresholds
          ? { ...this.flags.thresholds, ...patch.thresholds }
          : this.flags.thresholds,
      }
      await this.save()
    },

    async load(): Promise<void> {
      const data = await StorageService.get<PersistedState>(APP_CONSTANTS.STORAGE_KEY)
      if (data) {
        this.appName = data.appName ?? this.appName
        this.lastUpdated = data.lastUpdated ?? this.lastUpdated
        this.flags = {
          ...this.flags,
          ...data.flags,
          // Deep-merge thresholds so missing keys fall back to defaults
          thresholds: {
            ...DEFAULT_THRESHOLDS,
            ...data.flags?.thresholds,
          },
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
      await StorageService.set(APP_CONSTANTS.STORAGE_KEY, {
        appName: this.appName,
        version: this.version,
        flags: this.flags,
        lastUpdated: this.lastUpdated,
      })
    },

    initStorageSync(): void {
      StorageService.onChanged((changes) => {
        const payload = changes[APP_CONSTANTS.STORAGE_KEY] as PersistedState | undefined
        if (!payload) return
        if (payload.lastUpdated && payload.lastUpdated === this.lastUpdated) return
        this.appName = payload.appName ?? this.appName
        this.lastUpdated = payload.lastUpdated ?? this.lastUpdated
        this.flags = {
          ...this.flags,
          ...payload.flags,
          thresholds: {
            ...this.flags.thresholds,
            ...payload.flags?.thresholds,
          },
        }
      })
    },

    async init(): Promise<void> {
      await this.load()
      this.initStorageSync()
    },
  },
})
