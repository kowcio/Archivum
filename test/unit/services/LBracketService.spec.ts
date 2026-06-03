// ── Mocks (hoisted before all imports) ───────────────────────────────────────

vi.mock('webextension-polyfill', () => ({
    default: {
        scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    },
}))

vi.mock('@/services/TabDots', () => ({
    TabDots: {
        fetchFaviconDataUrl:      vi.fn().mockResolvedValue('data:image/png;base64,favicon'),
        renderLBracketDataUrl:    vi.fn().mockResolvedValue('data:image/png;base64,marked'),
        applyLBracketPageScript:  vi.fn(),
        removeLBracketPageScript: vi.fn(),
    },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import browser from 'webextension-polyfill'
import { TabDots } from '@/services/TabDots'
import { LBracketService } from '@/services/LBracketService'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClassifiedTab(overrides: Partial<ClassifiedTab> = {}): ClassifiedTab {
    return {
        id:                   1,
        url:                  'https://example.com',
        title:                'Example Tab',
        favIconUrl:           'https://example.com/favicon.ico',
        active:               false,
        pinned:               false,
        highlighted:          false,
        windowId:             1,
        incognito:            false,
        index:                0,
        selected:             false,
        discarded:            false,
        autoDiscardable:      true,
        groupId:              -1,
        status:               'complete',
        isMarked:             false,
        ageIndex:             0,
        markedFaviconDataUrl: undefined,
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LBracketService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── isMarked ──────────────────────────────────────────────────────────────

    describe('isMarked', () => {
        it('returns true when tab.isMarked is true', () => {
            const tab = makeClassifiedTab({ isMarked: true })
            expect(LBracketService.isMarked(tab)).toBe(true)
        })

        it('returns false when tab.isMarked is false', () => {
            const tab = makeClassifiedTab({ isMarked: false })
            expect(LBracketService.isMarked(tab)).toBe(false)
        })

        it('returns false when isMarked is explicitly set to false on a tab with a favicon', () => {
            const tab = makeClassifiedTab({ isMarked: false, markedFaviconDataUrl: 'data:image/png;base64,old' })
            expect(LBracketService.isMarked(tab)).toBe(false)
        })
    })

    // ── renderBracket ─────────────────────────────────────────────────────────

    describe('renderBracket', () => {
        it('fetches favicon and delegates to renderLBracketDataUrl', async () => {
            const result = await LBracketService.renderBracket('https://example.com/favicon.ico', '#ff0000')
            expect(TabDots.fetchFaviconDataUrl).toHaveBeenCalledWith('https://example.com/favicon.ico')
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith('data:image/png;base64,favicon', '#ff0000')
            expect(result).toBe('data:image/png;base64,marked')
        })

        it('passes null when rawFaviconUrl is undefined (no fetch)', async () => {
            await LBracketService.renderBracket(undefined, '#ff0000')
            expect(TabDots.fetchFaviconDataUrl).not.toHaveBeenCalled()
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith(null, '#ff0000')
        })

        it('passes fetchFaviconDataUrl result even when it returns null (restricted URL)', async () => {
            vi.mocked(TabDots.fetchFaviconDataUrl).mockResolvedValueOnce(null)
            await LBracketService.renderBracket('chrome://newtab/favicon.ico', '#00ff00')
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith(null, '#00ff00')
        })

        it('forwards the color argument to renderLBracketDataUrl unchanged', async () => {
            await LBracketService.renderBracket(undefined, '#abcdef')
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith(null, '#abcdef')
        })

        it('returns the data URL produced by renderLBracketDataUrl', async () => {
            vi.mocked(TabDots.renderLBracketDataUrl).mockResolvedValueOnce('data:image/png;base64,CUSTOM')
            const result = await LBracketService.renderBracket(undefined, '#000000')
            expect(result).toBe('data:image/png;base64,CUSTOM')
        })
    })

    // ── applyBracket ──────────────────────────────────────────────────────────

    describe('applyBracket', () => {
        it('renders bracket and injects into tab via scripting', async () => {
            const result = await LBracketService.applyBracket(42, 'https://example.com/favicon.ico', '#ff0000')
            expect(TabDots.fetchFaviconDataUrl).toHaveBeenCalledWith('https://example.com/favicon.ico')
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith('data:image/png;base64,favicon', '#ff0000')
            expect(browser.scripting.executeScript).toHaveBeenCalledWith({
                target: { tabId: 42 },
                func:   TabDots.applyLBracketPageScript,
                args:   ['data:image/png;base64,marked'],
            })
            expect(result).toBe('data:image/png;base64,marked')
        })

        it('works with undefined favicon URL (no fetch, null passed to render)', async () => {
            const result = await LBracketService.applyBracket(7, undefined, '#00ff00')
            expect(TabDots.fetchFaviconDataUrl).not.toHaveBeenCalled()
            expect(TabDots.renderLBracketDataUrl).toHaveBeenCalledWith(null, '#00ff00')
            expect(result).toBe('data:image/png;base64,marked')
        })

        it('returns the rendered data URL (same value passed to executeScript)', async () => {
            vi.mocked(TabDots.renderLBracketDataUrl).mockResolvedValueOnce('data:image/png;base64,SPECIAL')
            const result = await LBracketService.applyBracket(1, undefined, '#ffffff')
            expect(result).toBe('data:image/png;base64,SPECIAL')
            expect(browser.scripting.executeScript).toHaveBeenCalledWith(
                expect.objectContaining({ args: ['data:image/png;base64,SPECIAL'] }),
            )
        })

        it('propagates errors thrown by executeScript (restricted pages)', async () => {
            vi.mocked(browser.scripting.executeScript).mockRejectedValueOnce(new Error('Restricted page'))
            await expect(LBracketService.applyBracket(99, undefined, '#ff0000')).rejects.toThrow('Restricted page')
        })

        it('uses correct tabId in executeScript target', async () => {
            await LBracketService.applyBracket(123, undefined, '#aabbcc')
            expect(browser.scripting.executeScript).toHaveBeenCalledWith(
                expect.objectContaining({ target: { tabId: 123 } }),
            )
        })
    })

    // ── removeBracket ─────────────────────────────────────────────────────────

    describe('removeBracket', () => {
        it('calls executeScript with removeLBracketPageScript and empty args', async () => {
            await LBracketService.removeBracket(42)
            expect(browser.scripting.executeScript).toHaveBeenCalledWith({
                target: { tabId: 42 },
                func:   TabDots.removeLBracketPageScript,
                args:   [],
            })
        })

        it('uses correct tabId in executeScript target', async () => {
            await LBracketService.removeBracket(77)
            expect(browser.scripting.executeScript).toHaveBeenCalledWith(
                expect.objectContaining({ target: { tabId: 77 } }),
            )
        })

        it('propagates errors thrown by executeScript (restricted pages)', async () => {
            vi.mocked(browser.scripting.executeScript).mockRejectedValueOnce(new Error('Cannot access'))
            await expect(LBracketService.removeBracket(5)).rejects.toThrow('Cannot access')
        })

        it('resolves with void on success', async () => {
            const result = await LBracketService.removeBracket(10)
            expect(result).toBeUndefined()
        })
    })
})

