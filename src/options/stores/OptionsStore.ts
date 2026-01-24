import { defineStore } from 'pinia'
import { useGlobalStore } from '@/shared/stores/globalStore'

type OptionsState = {
    username: string
    enabled: boolean
}

export const useOptionsStore = defineStore('options', {
    state: (): OptionsState => ({
        username: '',
        enabled: false,
    }),
    actions: {
        async load() {
            try {
                const global = useGlobalStore()
                await global.load()
                this.username = (global.flags as any).username ?? this.username
                this.enabled = !!(global.flags as any).enabled
            } catch (e) {
                console.error('options.load failed', e)
            }
        },

        async loadDefaults() {
            try {
                const global = useGlobalStore()
                global.flags = { ...global.flags, username: this.username, enabled: this.enabled }
                await global.save()
            } catch (e) {
                console.error('options.loadDefaults failed', e)
            }
        },
    },
})
