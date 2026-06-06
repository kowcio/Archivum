import type { PiniaPlugin, PiniaPluginContext, Pinia } from 'pinia'
import type { AppState } from '@/stores/appStore'
import type { Store } from 'pinia'
import { APP_CONSTANTS } from "@/constants.ts";

/**
 * Pinia plugin — auto-wires WXT storage sync for `appStore` in every UI context.
 *
 * Registered once in AppBootstrapper.initUI() via `pinia.use(appStoreSyncPlugin)`.
 * No manual calls needed in popup / options / content components.
 *
 * Per context lifecycle:
 *   1. store created → hydrate from tabStorageItem (crash recovery / cross-context state)
 *   2. tabStorageItem.watch() → $patch() → Vue reactivity
 *   3. store.$dispose() → unwatch() (important for content scripts)
 */

type AppStoreType = Store<typeof APP_CONSTANTS.STORE_GLOBAL_STORE, AppState> & {
    loadTabsHistory: () => Promise<unknown>
    initTabStorageSync: () => () => void
}

export const appStoreSyncPlugin: PiniaPlugin = (context: PiniaPluginContext) => {
    if (context.store.$id !== APP_CONSTANTS.STORE_GLOBAL_STORE) return

    const store = context.store as AppStoreType

    // Hydrate from storage (non-blocking — UI renders immediately with empty state,
    // tabs appear as soon as the promise resolves and $patch fires)
    store.loadTabsHistory().catch((err: unknown) => {
        console.warn('[appStoreSyncPlugin] hydration failed:', err instanceof Error ? err.message : err)
    })

    // Watch for changes produced by any other context (popup, options, background alarm)
    const unwatch = store.initTabStorageSync()

    // Clean up the watcher when the store is disposed.
    // Critical for content scripts — the page stays alive but the script can be removed.
    // For popup/options the whole VM is destroyed on close so this is a safety net.
    const originalDispose = store.$dispose.bind(store)
    store.$dispose = () => {
        unwatch()
        originalDispose()
    }
}

/**
 * Disposes all stores registered in the given Pinia instance.
 *
 * Pinia NIE wywołuje $dispose automatycznie przy app.unmount().
 * Wywołuj ręcznie w onRemove() content scriptów — inaczej listener
 * storage.onChanged żyje dalej po invalidacji scripta (memory / event leak).
 *
 * @example
 *   onRemove: ({ pinia, app }) => {
 *     disposeAllStores(pinia)
 *     app.unmount()
 *   }
 */
export function disposeAllStores(pinia: Pinia): void {
    // Use mapState stores API if available, otherwise fall back to no-op
    try {
        const internalStores = (pinia as unknown as { _s?: Map<string, Store> })._s
        if (internalStores instanceof Map) {
            internalStores.forEach(store => store.$dispose())
        }
    } catch {
        // Silent fail if API changed in newer Pinia versions
    }
}

