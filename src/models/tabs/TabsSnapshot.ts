import type { Tabs } from 'webextension-polyfill'

/**
 * Snapshot of saved tabs stored in extension storage.
 * Single source of truth — import from here, never redefine.
 */
export class TabsSnapshot {
    readonly tabs: Tabs.Tab[]
    readonly savedAt: string

    constructor(tabs: Tabs.Tab[], savedAt: string) {
        this.tabs = tabs
        this.savedAt = savedAt
    }
}

