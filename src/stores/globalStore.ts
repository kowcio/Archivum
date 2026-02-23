import {defineStore} from 'pinia'
import StorageService from '@/services/StorageService.ts'
import {APP_CONSTANTS} from "@/constants.ts";

// ─── Persisted flags ──────────────────────────────────────────────────────────
export interface AppFlags {
  ENABLED: boolean
  tabsMarkingAge: number
}

// ─── Full store state ─────────────────────────────────────────────────────────
export interface GlobalState {
  appName: string
  version: string
  flags: AppFlags
  lastUpdated: number
}

// ─── Partial type used when loading from storage ──────────────────────────────
type PersistedState = Partial<Omit<GlobalState, 'flags'>> & { flags?: Partial<AppFlags> }

async function getRuntimeVersion(): Promise<string | undefined> {
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
}

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    appName: APP_CONSTANTS.APP_NAME,
    version: APP_CONSTANTS.APP_VERSION,
    flags: {
      ENABLED: false,
      tabsMarkingAge: APP_CONSTANTS.DEFAULT_TABS_MARKING_AGE,
    },
    lastUpdated: Date.now(),
  }),

  getters: {
    /** Convenience: is the extension enabled? */
    isEnabled: (state): boolean => state.flags.ENABLED,
    /** Convenience: current tabs-marking-age threshold */
    tabsMarkingAge: (state): number => state.flags.tabsMarkingAge,
    /** Expose constants so any component can read them via the store */
    constants: (): typeof APP_CONSTANTS => APP_CONSTANTS,
  },

  actions: {
    /** Merge partial flag changes and persist. */
    async setFlags(patch: Partial<AppFlags>): Promise<void> {
      this.flags = {...this.flags, ...patch}
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
        }
      }

      // Prefer the extension manifest version over the build-time value
      const runtimeVersion = await getRuntimeVersion()
      if (runtimeVersion) this.version = runtimeVersion
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
        this.flags = {...this.flags, ...payload.flags}
      })
    },

    async init(): Promise<void> {
      await this.load()
      this.initStorageSync()
    },
  },
})
