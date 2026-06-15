/**
 * 🧹 Extension Lifecycle & Cleanup Service
 *
 * Handles plugin enable/disable/uninstall logic:
 * - Ungroups all Chrome tab groups
 * - Clears config storage (thresholds)
 */
import { browser } from 'wxt/browser'

export class ExtensionCleanupService {
    static async performFullCleanup(): Promise<void> {
        console.log('[ExtensionCleanupService] Starting full cleanup...')
        try {
            if (browser.tabGroups != null) {
                const allTabs = await browser.tabs.query({})
                const ids = allTabs.map(t => t.id).filter((id): id is number => id != null)
                if (ids.length) {
                    await (browser.tabs as any).ungroup(ids)
                }
            }
            await browser.storage.local.clear()
            console.log('[ExtensionCleanupService] ✅ Cleanup done')
        } catch (err) {
            console.error('[ExtensionCleanupService] ❌', err)
        }
    }

    static registerLifecycleListeners(): void {
        const chrome = globalThis as unknown as {
            chrome?: { runtime?: { onInstalled?: { addListener: (cb: (details: { reason: string }) => void) => void } } }
        }
        if (!chrome?.chrome?.runtime?.onInstalled?.addListener) return

        chrome.chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'update') {
                browser.storage.local.clear()
            }
        })

        // Register uninstall URL if needed
        // browser.runtime.setUninstallURL('https://example.com/uninstall')
    }
}
