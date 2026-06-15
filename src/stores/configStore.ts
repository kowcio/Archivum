import { defineStore } from 'pinia'
import { configStorage } from '@/utils/configStorage'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { APP_CONSTANTS } from '@/constants'

/**
 * Pinia store for extension configuration only.
 *
 * No tabs state — tabs are queried live from browser.tabs API.
 * No storage sync watchers for tabs — only config watcher cross-context.
 */
type State = {
  thresholds: AppThresholds
  configLastUpdated: number
  loading: boolean
  error: string | null
}

export const useConfigStore = defineStore(APP_CONSTANTS.STORE_GLOBAL_STORE, {
  state: (): State => ({
    thresholds: DEFAULT_THRESHOLDS,
    configLastUpdated: Date.now(),
    loading: false,
    error: null,
  }),

  actions: {
    async load(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const data = await configStorage.getValue()
        if (data?.thresholds) {
          this.thresholds = AppThresholds.fromObject(data.thresholds)
          this.configLastUpdated = data.configLastUpdated
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load config'
        this.thresholds = DEFAULT_THRESHOLDS
      } finally {
        this.loading = false
      }
    },

    async save(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        this.configLastUpdated = Date.now()
        await configStorage.setValue({
          thresholds: this.thresholds.toJSON(),
          configLastUpdated: this.configLastUpdated,
        })
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save config'
      } finally {
        this.loading = false
      }
    },

    /** Watch for config changes from other contexts (background, other UI tabs). Idempotent. */
    watch(): void {
      configStorage.watch((data) => {
        if (!data?.thresholds) return
        if (data.configLastUpdated === this.configLastUpdated) return
        this.thresholds = AppThresholds.fromObject(data.thresholds)
        this.configLastUpdated = data.configLastUpdated
      })
    },

    async setThresholds(patch: Record<number, Partial<{ days: number }>>): Promise<void> {
      const updated = this.thresholds.merge(patch)
      if (!updated.isValid()) return
      this.thresholds = updated
      await this.save()
    },

    async setActiveLevels(count: number): Promise<void> {
      this.thresholds = this.thresholds.withActiveLevels(count)
      await this.save()
    },

    async resetToDefaults(): Promise<void> {
      this.thresholds = DEFAULT_THRESHOLDS
      await this.save()
    },
  },
})
