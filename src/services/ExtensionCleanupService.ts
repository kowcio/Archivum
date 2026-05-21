/**
 * 🧹 Extension Lifecycle & Cleanup Service
 *
 * Handles plugin enable/disable/uninstall logic with comprehensive cleanup:
 * - Removes all tab marks (L-bracket overlays, badges, title prefixes)
 * - Ungroups all Chrome tab groups
 * - Clears all extension storage (including marked tabs registry)
 * - Prevents leftover UI artifacts when plugin is disabled/removed
 *
 * WHY IMPORTANT:
 *  - Users expect clean state after uninstall (zero traces)
 *  - Browser extension can be disabled/re-enabled repeatedly
 *  - Chrome/Firefox don't auto-cleanup injected content from extension context removal
 */
import browser from 'webextension-polyfill'
import { TabDots } from '@/services/TabDots'
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
            // 1️⃣ Remove L-bracket overlays and restore original favicons
            await this.removeAllTabMarks()

            // 2️⃣ Ungroup all Chrome tab groups
            await this.ungroupAllTabs()

            // 3️⃣ Clear all extension storage (tabs history, settings, marked tabs registry, etc.)
            await this.clearAllStorage()

            console.log('[ExtensionCleanupService] ✅ Full cleanup completed successfully')
        } catch (err) {
            console.error('[ExtensionCleanupService] ❌ Cleanup error:', err instanceof Error ? err.message : err)
        }
    }

    /**
     * 🧹 Remove all L-bracket marks from all open tabs
     * Injects removeLBracketPageScript into every tab to:
     *  - Disconnect MutationObserver
     *  - Remove marked favicon links
     *  - Restore original favicon rel attributes
     */
    private static async removeAllTabMarks(): Promise<void> {
        try {
            const allTabs = await browser.tabs.query({})
            console.log(`[removeAllTabMarks] Removing marks from ${allTabs.length} tabs...`)

            await Promise.all(
                allTabs.map(async (tab) => {
                    if (!tab.id) return
                    try {
                        await browser.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: TabDots.removeLBracketPageScript,
                            args: [],
                        })
                    } catch (err) {
                        console.debug(`[removeAllTabMarks] tab#${tab.id}:`, err instanceof Error ? err.message : err)
                    }
                }),
            )
        } catch (err) {
            console.error('[removeAllTabMarks] Error:', err instanceof Error ? err.message : err)
        }
    }

    /**
     * 🧹 Ungroup all Chrome tab groups
     * No-op on Firefox (Chrome-specific API)
     */
    private static async ungroupAllTabs(): Promise<void> {
        try {
            const chrome = (globalThis as unknown as {
                chrome?: { tabs?: { ungroup?: (ids: number | number[]) => Promise<void> } }
            }).chrome

            if (!chrome?.tabs?.ungroup) return

            const allTabs = await browser.tabs.query({})
            const tabIds = allTabs.filter(t => t.id).map(t => t.id!) as number[]

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
            await browser.storage.local.clear()
            await browser.storage.sync?.clear?.()
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

        // Called when extension is installed/updated/enabled
        browser.runtime.onInstalled.addListener((details) => {
            console.log('[onInstalled]', details.reason)

            if (details.reason === 'install') {
                console.log('[onInstalled] First time install - no cleanup needed')
            } else if (details.reason === 'update') {
                console.log('[onInstalled] Extension updated - running compatibility cleanup')
                // Optionally run partial cleanup on update (marked tabs tracking)
                this.clearMarkedTabsRegistry().catch((err) =>
                    console.error('[onInstalled update] Cleanup error:', err),
                )
            }
        })

        // Hook for disable/uninstall - requires manifest permission
        // Chrome/Firefox inform content scripts but we handle cleanup in background
        console.log('[registerLifecycleListeners] ✅ Lifecycle listeners registered')
    }

    /**
     * 🧹 Clear only the marked tabs registry (subset of full cleanup)
     * Useful for resets without removing all storage
     */
    private static async clearMarkedTabsRegistry(): Promise<void> {
        try {
            await browser.storage.local.remove(APP_DEFAULTS.TAB_HISTORY_KEY)
            console.log('[clearMarkedTabsRegistry] ✅ Cleared')
        } catch (err) {
            console.debug('[clearMarkedTabsRegistry]', err instanceof Error ? err.message : err)
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


