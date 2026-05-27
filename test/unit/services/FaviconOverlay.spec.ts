/**
 * Dedicated tests for favicon L-bracket overlay marking logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { TabDots } from 'src/services/TabDots'
import { useTabStore } from 'src/stores/TabStore'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs:     { query: vi.fn(), remove: vi.fn() },
    storage:  { local: { get: vi.fn(), set: vi.fn() } },
    action:   { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
  },
}))

// ─── applyLBracketPageScript ─────────────────────────────────────────────────
// applyLBracketPageScript now takes a single pre-rendered data URL (no canvas work inside)

async function runLBracketScript(renderedDataUrl = 'data:image/png;base64,MOCK'): Promise<HTMLLinkElement | null> {
  document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
  const scriptFn = TabDots.applyLBracketPageScript
  scriptFn(renderedDataUrl)
  await Promise.resolve()
  return document.querySelector<HTMLLinkElement>('link[data-ext-age-ring]')
}

describe('applyLBracketPageScript', () => {
  it('injects a <link data-ext-age-ring> into document.head', async () => {
    const link = await runLBracketScript()
    expect(link).not.toBeNull()
    expect(link!.getAttribute('data-ext-age-ring')).toBe('true')
    expect(link!.rel).toBe('icon')
    expect(link!.type).toBe('image/png')
  })

  it('link href equals the provided data URL', async () => {
    const link = await runLBracketScript('data:image/png;base64,TESTDATA')
    expect(link!.href).toContain('data:image/png')
  })

  it('replaces an existing data-ext-age-ring link (no duplicates)', async () => {
    await runLBracketScript('data:image/png;base64,FIRST')
    await runLBracketScript('data:image/png;base64,SECOND')
    expect(document.querySelectorAll('link[data-ext-age-ring]').length).toBe(1)
  })

  it('injects link for each call with a different data URL', async () => {
    const urls = [
      'data:image/png;base64,URL1',
      'data:image/png;base64,URL2',
      'data:image/png;base64,URL3',
      'data:image/png;base64,URL4',
    ]
    for (const url of urls) {
      const link = await runLBracketScript(url)
      expect(link).not.toBeNull()
    }
  })
})

// ─── removeLBracketPageScript ────────────────────────────────────────────────

describe('removeLBracketPageScript', () => {
  it('removes the injected link from DOM', () => {
    const link = document.createElement('link')
    link.setAttribute('data-ext-age-ring', 'true')
    document.head.appendChild(link)
    TabDots.removeLBracketPageScript()
    expect(document.querySelector('link[data-ext-age-ring]')).toBeNull()
  })

  it('is a no-op when no overlay link exists', () => {
    document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
    expect(() => TabDots.removeLBracketPageScript()).not.toThrow()
  })
})

// ─── markTabWithLBracket (store → executeScript integration) ─────────────────

describe('markTabWithLBracket (store)', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.scripting.executeScript).mockResolvedValue(undefined as any)
    // tabs.query must return tabs with status='complete' to skip the wait-for-complete loop
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 42, status: 'complete', index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false },
      { id: 7,  status: 'complete', index: 1, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false },
      { id: 55, status: 'complete', index: 2, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false },
    ] as any)
    // renderLBracketDataUrl uses OffscreenCanvas which is not available in jsdom
    vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,MOCK')
    setActivePinia(createPinia())
  })

  it('calls executeScript with correct tabId', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 42, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, isMarked: false, ageIndex: 0 }] })

    await store.markTabWithLBracket(42, '#00e676')

    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42 } }),
    )
  })

  it('pre-fetches favicon and passes data URL to renderLBracketDataUrl', async () => {
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 7, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, favIconUrl: 'https://example.com/favicon.ico', isMarked: false, ageIndex: 0 }] })
    const fetchSpy = vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue('data:image/png;base64,TESTDATA')
    const renderSpy = vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,RENDERED')

    await store.markTabWithLBracket(7, '#ff1744')

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/favicon.ico')
    expect(renderSpy).toHaveBeenCalledWith('data:image/png;base64,TESTDATA', '#ff1744')
  })

  it('does NOT set store.error when executeScript throws (silent fail)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.scripting.executeScript).mockRejectedValueOnce(new Error('Cannot access a chrome:// URL'))
    const store = useTabStore()
    await store.markTabWithLBracket(1, '#00e676')
    expect(store.error).toBeNull()
  })

  it('sets isMarked=true on tab after successful mark', async () => {
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 42, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, isMarked: false, ageIndex: 0 }] })

    await store.markTabWithLBracket(42, '#ffd740')

    expect(store.tabs.find(t => t.id === 42)?.isMarked).toBe(true)
  })

  it('calls removeLBracket for correct tabId', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    await store.removeLBracket(55)
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 55 } }),
    )
  })

  it('sets isMarked=false on tab after removeLBracket', async () => {
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 55, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, isMarked: true, ageIndex: 1 }] })

    await store.removeLBracket(55)

    expect(store.tabs.find(t => t.id === 55)?.isMarked).toBe(false)
  })

  it('markOldTabs: does NOT mark Fresh tabs (index 0, < young threshold)', async () => {
    const store = useTabStore()
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    store.$patch({
      tabs: [
        { id: 1, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 1  * DAY, isMarked: false, ageIndex: 0 },
        { id: 2, index: 1, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 10 * DAY, isMarked: false, ageIndex: 0 },
        { id: 3, index: 2, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 30 * DAY, isMarked: false, ageIndex: 0 },
      ],
    })

    const lbSpy = vi.spyOn(store, 'markTabWithLBracket').mockResolvedValue()
    await store.markOldTabs()

    expect(lbSpy).not.toHaveBeenCalledWith(1, expect.any(String))
    expect(lbSpy).toHaveBeenCalledWith(2, expect.any(String))
    expect(lbSpy).toHaveBeenCalledWith(3, expect.any(String))
    expect(lbSpy).toHaveBeenCalledTimes(2)
  })

  it('markOldTabs: does NOT re-mark already marked tabs (no stacking)', async () => {
    const store = useTabStore()
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    store.$patch({
      tabs: [
        { id: 10, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 30 * DAY, isMarked: true, ageIndex: 3 },
        { id: 11, index: 1, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 20 * DAY, isMarked: true, ageIndex: 2 },
      ],
    })

    const lbSpy = vi.spyOn(store, 'markTabWithLBracket').mockResolvedValue()
    await store.markOldTabs()

    expect(lbSpy).not.toHaveBeenCalled()
  })
})
