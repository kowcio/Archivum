import type { Tabs } from 'webextension-polyfill'

/**
 * Snapshot of the full tab state persisted to browser.storage.local.
 * Single source of truth — shared by background, popup, options and content.
 *
 * Architecture: every store mutation calls _persist() → writes this shape →
 * storage.onChanged fires → initStorageSync() patches every open UI context reactively.
 */
export class TabsSnapshot {
    readonly tabs: Tabs.Tab[]
    /** Whether Chrome tab groups are currently active in the window. */
    readonly isGrouped: boolean
    readonly savedAt: string

    constructor(tabs: Tabs.Tab[], isGrouped: boolean, savedAt: string) {
        this.tabs = tabs
        this.isGrouped = isGrouped
        this.savedAt = savedAt
    }
}

