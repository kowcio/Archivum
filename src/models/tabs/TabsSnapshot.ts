import type { Tabs } from 'webextension-polyfill'

/**
 * Snapshot of the full tab state persisted to browser.storage.local.
 * Plain object — safe for structured cloning (no class prototype).
 */
export type TabsSnapshot = {
    tabs: Tabs.Tab[]
    isGrouped: boolean
    savedAt: string
}

