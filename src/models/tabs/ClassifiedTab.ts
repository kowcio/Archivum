import type { Tabs } from 'webextension-polyfill'

/**
 * Tab extended with age state and marking metadata.
 * Browser APIs consume it as plain Tabs.Tab — extra fields are silently ignored.
 */
export type ClassifiedTab = Tabs.Tab & {
    /** True when the L-bracket favicon overlay is applied. */
    isMarked: boolean
    /**
     * Age classification index: 0=Fresh 1=Young 2=Middle 3=Old.
     * Use `new AgeClassification(tab.ageIndex)` to get color/cssClass/booleans.
     */
    ageIndex: number
    /**
     * Pre-rendered favicon+L-bracket data URL (OffscreenCanvas in extension context).
     * Set by markTabWithLBracket, cleared by removeLBracket.
     * Used by TabRow.thumbnail so the table shows the SAME image as the browser tab bar.
     */
    markedFaviconDataUrl?: string | null
}

/** Factory helpers for creating and mutating ClassifiedTab instances. */
export class ClassifiedTabFactory {
    /**
     * Factory helper: wrap a raw Tabs.Tab into a ClassifiedTab with default age/mark state.
     * Uses Object.assign to preserve all tab properties and avoid Proxy issues.
     * @param tab - raw browser tab
     * @param isMarked - carry over previous marking state (default false)
     */
    static fromTab(tab: Tabs.Tab, isMarked = false): ClassifiedTab {
        return Object.assign({}, tab, {
            isMarked,
            ageIndex: 0,
            markedFaviconDataUrl: undefined,
        }) as ClassifiedTab
    }

    /**
     * Batch-convert raw tabs, preserving marking state for previously marked IDs.
     * @param tabs - raw browser tabs
     * @param previouslyMarkedIds - Set of tab IDs that were marked before reload
     */
    static fromTabs(tabs: Tabs.Tab[], previouslyMarkedIds: ReadonlySet<number> = new Set()): ClassifiedTab[] {
        return tabs.map((tab) =>
            ClassifiedTabFactory.fromTab(tab, !!(tab.id && previouslyMarkedIds.has(tab.id)))
        )
    }
}
