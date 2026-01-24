import { defineStore } from 'pinia'
import StorageService from '@/shared/services/StorageService'

const STORAGE_KEY = 'global_store'

export interface GlobalFlags {
    username?: string
    enabled?: boolean
    [key: string]: unknown
}

export interface GlobalState {
    appName: string
    version?: string
    flags: GlobalFlags
    lastUpdated?: number
}

export const useGlobalStore = defineStore('global', {
    state: (): GlobalState => ({
        appName: 'czynsz_ff',
        version: undefined,
        flags: {},
        lastUpdated: Date.now(),
    }),
    getters: {
        isFlagSet: (state) => (key: string) => !!state.flags[key],
    },
    actions: {
        setFlag(key: string, value: unknown) {
            this.flags = { ...this.flags, [key]: value }
            this.lastUpdated = Date.now()
        },
        async load() {
            const data = await StorageService.get<Partial<GlobalState>>(STORAGE_KEY)
            if (data) {
                this.appName = data.appName ?? this.appName
                this.version = data.version ?? this.version
                this.flags = data.flags ?? this.flags
                this.lastUpdated = data.lastUpdated ?? this.lastUpdated
            }
        },
        async save() {
            this.lastUpdated = Date.now()
            await StorageService.set(STORAGE_KEY, {
                appName: this.appName,
                version: this.version,
                flags: this.flags,
                lastUpdated: this.lastUpdated,
            })
        },
        initStorageSync() {
            StorageService.onChanged((changes) => {
                const payload = changes[STORAGE_KEY]
                if (!payload) return
                if (payload.lastUpdated && payload.lastUpdated === this.lastUpdated) return
                this.appName = payload.appName ?? this.appName
                this.version = payload.version ?? this.version
                this.flags = payload.flags ?? this.flags
                this.lastUpdated = payload.lastUpdated ?? this.lastUpdated
            })
        },
        async init() {
            await this.load()
            this.initStorageSync()
        },
    },
})