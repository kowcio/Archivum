import type { Tabs } from 'webextension-polyfill'

/**
 * Tab extended with age state and marking metadata.
 * Browser APIs consume it as plain Tabs.Tab — extra fields are silently ignored.
 */
export type ClassifiedTab = Tabs.Tab & {
    /** True when the L-bracket favicon overlay is applied. */
    isMarked: boolean
    /** Hex color of the L-bracket (from AgeClassification.color). */
    ageColor: string
    /** Quasar CSS class for table row background (from AgeClassification.cssClass). */
    ageCssClass: string
    /** 0=Fresh 1=Young 2=Middle 3=Old (from AgeClassification.index). */
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
     * Wrap a raw Tabs.Tab into a ClassifiedTab with default age/mark state.
     * @param tab - raw browser tab
     * @param isMarked - carry over previous marking state (default false)
     */
    static fromTab(tab: Tabs.Tab, isMarked = false): ClassifiedTab {
        return {
            ...tab,
            isMarked,
            ageColor: 'transparent',
            ageCssClass: '',
            ageIndex: 0,
            markedFaviconDataUrl: undefined,
        }
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

    /**
     * Apply age classification fields to an existing ClassifiedTab (mutates in-place).
     */
    static applyClassification(tab: ClassifiedTab, cssClass: string, color: string, index: number): void {
        tab.ageCssClass = cssClass
        tab.ageColor = color
        tab.ageIndex = index
    }
}
