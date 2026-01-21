import { defineStore } from 'pinia'

type OptionsState = {
    username: string
    enabled: boolean
}

const STORAGE_KEY = 'extension-options'

export const useOptionsStore = defineStore('options', {
    state: (): OptionsState => ({
        username: '',
        enabled: false,
    }),
    actions: {
        async load() {
            // Try browser storage first
            try {
                console.log("LOADING STORE for options !")
            } catch (e) {
                console.log(e);
            }

            // Fallback to localStorage
            try {
                const raw = localStorage.getItem(STORAGE_KEY)
                if (raw) {
                    const parsed = JSON.parse(raw)
                    this.username = parsed.username || ''
                    this.enabled = !!parsed.enabled
                }
            } catch (e) {
                console.log(e);

            }
        },
        async loadDefaults() {
            const payload = { username: this.username, enabled: this.enabled }
            try {
                console.log("Load defaults");
            } catch (e) {
                console.log(e);
            }
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
            } catch (e) {
                console.log(e);

            }
        }
    }
})
