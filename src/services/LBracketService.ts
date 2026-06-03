/**
 * LBracketService — single source of truth for all L-bracket favicon overlay operations.
 *
 * Used by both background (BackgroundTabService) and UI contexts (TabStore).
 * No Pinia — pure browser API calls only. Safe to import in background service workers.
 *
 * Responsibilities:
 *   isMarked(tab)                       → check whether a tab is currently bracketed
 *   renderBracket(faviconUrl, color)    → OffscreenCanvas render → data URL (no scripting)
 *   applyBracket(tabId, faviconUrl, color) → render + executeScript inject → returns data URL
 *   removeBracket(tabId)                → executeScript to restore original favicons
 */

import browser from 'webextension-polyfill'
import { TabDots } from '@/services/TabDots'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'

export class LBracketService {
    /**
     * Returns true when the tab has an active L-bracket overlay.
     * Reads the ClassifiedTab.isMarked field — no async I/O.
     */
    static isMarked(tab: ClassifiedTab): boolean {
        return tab.isMarked === true
    }

    /**
     * Renders a favicon + L-bracket composite image using OffscreenCanvas (extension context).
     * Does NOT inject anything into the page — call applyBracket() for that.
     *
     * @param rawFaviconUrl - original tab favicon URL (http/https only; data: URLs are skipped)
     * @param color         - hex color for the L-bracket stroke (from AgeClassification.color)
     * @returns             - PNG data URL ready for both scripting injection and thumbnail display
     */
    static async renderBracket(rawFaviconUrl: string | undefined, color: string): Promise<string> {
        const faviconDataUrl = rawFaviconUrl
            ? await TabDots.fetchFaviconDataUrl(rawFaviconUrl)
            : null
        return TabDots.renderLBracketDataUrl(faviconDataUrl, color)
    }

    /**
     * Renders the L-bracket overlay and injects it into the tab page via executeScript.
     * Returns the rendered data URL for storage in ClassifiedTab.markedFaviconDataUrl.
     *
     * Throws on executeScript failure — caller must catch for restricted pages
     * (chrome://, extension pages, etc.).
     *
     * @param tabId         - browser tab ID to inject into
     * @param rawFaviconUrl - original tab favicon URL (skipped if undefined or data:)
     * @param color         - hex bracket color from AgeClassification.color
     * @returns             - the rendered data URL (same image shown in tab bar and table thumbnail)
     */
    static async applyBracket(tabId: number, rawFaviconUrl: string | undefined, color: string): Promise<string> {
        const renderedUrl = await LBracketService.renderBracket(rawFaviconUrl, color)
        await browser.scripting.executeScript({
            target: { tabId },
            func: TabDots.applyLBracketPageScript,
            args: [renderedUrl],
        })
        return renderedUrl
    }

    /**
     * Removes the L-bracket overlay from a tab and restores original favicons.
     * Throws on executeScript failure — caller must catch for restricted pages.
     *
     * @param tabId - browser tab ID to clean up
     */
    static async removeBracket(tabId: number): Promise<void> {
        await browser.scripting.executeScript({
            target: { tabId },
            func: TabDots.removeLBracketPageScript,
            args: [],
        })
    }
}

