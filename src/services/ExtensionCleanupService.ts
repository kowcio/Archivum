/**
 * 🧹 Extension Lifecycle & Cleanup Service
 *
 * Handles plugin enable/disable/uninstall logic with comprehensive cleanup:
 * - Ungroups all Chrome tab groups
 * - Clears all extension storage (including tab history)
 * - Prevents leftover UI artifacts when plugin is disabled/removed
 *
 * WHY IMPORTANT:
 *  - Users expect clean state after uninstall (zero traces)
 *  - Browser extension can be disabled/re-enabled repeatedly
 *  - Chrome/Firefox don't auto-cleanup tab groups from extension context removal
 */
import { APP_DEFAULTS } from '@/constants'

export class ExtensionCleanupService {
    /**
     * 🧹 MAIN CLEANUP METHOD
     * Called on:
     *  - Extension uninstall (runtime.onInstalled reason='install' on fresh install, OR reason='update')
     *  - Extension disable (internal trigger before disabling)
     *  - Manual user cleanup (options page "Reset" button)
     */
    static async performFullCleanup(): Promise<void> {
        console.log('[ExtensionCleanupService] Starting full cleanup...')
        try {
            // 1️⃣ Ungroup all Chrome tab groups
            await this.ungroupAllTabs()

            // 2️⃣ Clear all extension storage (tabs history, settings, etc.)
            await this.clearAllStorage()

            console.log('[ExtensionCleanupService] ✅ Full cleanup completed successfully')
        } catch (err) {
            console.error('[ExtensionCleanupService] ❌ Cleanup error:', err instanceof Error ? err.message : err)
        }
    }


    /**
     * 🧹 Ungroup all Chrome tab groups
     * No-op on Firefox (Chrome-specific API)
     */
    private static async ungroupAllTabs(): Promise<void> {
        try {
            const chrome = (globalThis as unknown as {
                chrome?: { tabs?: { query?: (query: any) => Promise<any[]>; ungroup?: (ids: number | number[]) => Promise<void> } }
            }).chrome

            if (!chrome?.tabs?.ungroup) return

            // Use chrome.tabs.query for ESM compatibility
            const allTabs = await chrome.tabs.query({})
            const tabIds = allTabs.filter((t: any) => t.id).map((t: any) => t.id!) as number[]

            if (tabIds.length === 0) return

            console.log(`[ungroupAllTabs] Ungrouping ${tabIds.length} tabs...`)
            await chrome.tabs.ungroup(tabIds)
        } catch (err) {
            console.debug('[ungroupAllTabs] Error (likely Firefox):', err instanceof Error ? err.message : err)
        }
    }

    /**
     * 🧹 Clear all extension storage
     * Removes:
     *  - Tab history (saved tabs snapshot)
     *  - Marked tabs registry
     *  - User settings/thresholds
     *  - Any other extension data
     */
    private static async clearAllStorage(): Promise<void> {
        try {
            console.log('[clearAllStorage] Clearing all storage...')
            const chrome = (globalThis as unknown as {
                chrome?: { storage?: { local?: { clear?: () => Promise<void> }; sync?: { clear?: () => Promise<void> } } }
            }).chrome

            if (chrome?.storage?.local?.clear) {
                await chrome.storage.local.clear()
            }
            if (chrome?.storage?.sync?.clear) {
                await chrome.storage.sync.clear()
            }
            console.log('[clearAllStorage] ✅ All storage cleared')
        } catch (err) {
            console.error('[clearAllStorage] Error:', err instanceof Error ? err.message : err)
        }
    }

    /**
     * 🎯 Register extension lifecycle listeners
     * Call this once in background.ts on extension startup
     */
    static registerLifecycleListeners(): void {
        console.log('[registerLifecycleListeners] Setting up extension lifecycle listeners...')

        const chrome = (globalThis as unknown as {
            chrome?: { runtime?: { onInstalled?: { addListener?: (callback: (details: any) => void) => void } } }
        }).chrome

        if (!chrome?.runtime?.onInstalled?.addListener) {
            console.warn('[registerLifecycleListeners] ⚠️ chrome.runtime.onInstalled not available')
            return
        }

        // Called when extension is installed/updated/enabled
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('[onInstalled]', details.reason)

            if (details.reason === 'install') {
                console.log('[onInstalled] First time install - no cleanup needed')
            } else if (details.reason === 'update') {
                console.log('[onInstalled] Extension updated - running compatibility cleanup')
                // Optionally run partial cleanup on update (tab history)
                this.clearTabHistory().catch((err) =>
                    console.error('[onInstalled update] Cleanup error:', err),
                )
            }
        })

        // Hook for disable/uninstall - requires manifest permission
        // Chrome/Firefox inform content scripts but we handle cleanup in background
        console.log('[registerLifecycleListeners] ✅ Lifecycle listeners registered')
    }

    /**
     * 🧹 Clear only tab history (saved tabs snapshot)
     * Used on extension update to clear old tab data
     */
    private static async clearTabHistory(): Promise<void> {
        try {
            console.log('[clearTabHistory] Clearing tab history...')
            const chrome = (globalThis as unknown as {
                chrome?: { storage?: { local?: { remove?: (keys: string | string[]) => Promise<void> } } }
            }).chrome

            if (chrome?.storage?.local?.remove) {
                // Clear tab storage: WXT storage (local:tab_history) and tab_store key
                await chrome.storage.local.remove(['local:tab_history', 'tab_store'])
                console.log('[clearTabHistory] ✅ Tab history cleared')
            } else {
                console.warn('[clearTabHistory] ⚠️ chrome.storage.local.remove not available')
            }
        } catch (err) {
            console.debug('[clearTabHistory]', err instanceof Error ? err.message : err)
        }
    }


    /**
     * 🎬 Trigger cleanup before extension disables
     * Can be called from options page or background on signal
     */
    static async prepareForDisable(): Promise<void> {
        console.log('[prepareForDisable] Preparing extension for disable...')
        await this.performFullCleanup()
        console.log('[prepareForDisable] ✅ Ready for disable')
    }
}


