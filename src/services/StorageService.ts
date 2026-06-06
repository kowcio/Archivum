import browser from 'webextension-polyfill'

export default class StorageService {
    private static isBrowserStorageAvailable = typeof browser !== 'undefined' && !!browser.storage && !!browser.storage.local

    public static async get<T>(key: string): Promise<T | undefined> {
        try {
            if (this.isBrowserStorageAvailable) {
                const res = await browser.storage.local.get(key)
                return res?.[key] as T | undefined
            }
            const raw = localStorage.getItem(key)
            return raw ? (JSON.parse(raw) as T) : undefined
        } catch (err) {
            console.error('[StorageService] get error', err)
            return undefined
        }
    }

    public static async set(key: string, value: unknown): Promise<void> {
        try {
            // Convert to plain object to avoid Proxy serialization issues
            const plainValue = JSON.parse(JSON.stringify(value))

            if (this.isBrowserStorageAvailable) {
                await browser.storage.local.set({ [key]: plainValue })
                return
            }
            localStorage.setItem(key, JSON.stringify(plainValue))
        } catch (err) {
            console.error('[StorageService] set error', err)
            throw err
        }
    }

    public static async remove(key: string): Promise<void> {
        try {
            if (this.isBrowserStorageAvailable) {
                await browser.storage.local.remove(key)
                return
            }
            localStorage.removeItem(key)
        } catch (err) {
            console.error('[StorageService] remove error', err)
        }
    }

    public static onChanged(callback: (changes: Record<string, any>) => void): void {
        if (this.isBrowserStorageAvailable && browser.storage.onChanged && typeof browser.storage.onChanged.addListener === 'function') {
            browser.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local') {
                    const out: Record<string, any> = {}
                    for (const key in changes) out[key] = changes[key].newValue
                    callback(out)
                }
            })
        } else {
            // Fallback: listen for window.storage events (same-origin pages / tests)
            window.addEventListener('storage', (e: StorageEvent) => {
                if (!e.key) return
                try {
                    const val = e.newValue ? JSON.parse(e.newValue) : null
                    callback({ [e.key]: val })
                } catch (err) {
                    callback({ [e.key]: e.newValue })
                }
            })
        }
    }
}
