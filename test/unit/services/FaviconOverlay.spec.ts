/**
 * Dedicated tests for favicon L-bracket overlay marking logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { TabDots, DOT_COLOR_MAP } from 'src/services/TabDots'
import { useTabStore } from 'src/stores/TabStore'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs:     { query: vi.fn(), remove: vi.fn() },
    storage:  { local: { get: vi.fn(), set: vi.fn() } },
    action:   { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
  },
}))

const mockCtx = {
  clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), clip: vi.fn(),
  drawImage: vi.fn(), stroke: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(),
  strokeStyle: '', lineWidth: 0, lineCap: '',
}

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')

async function runLBracketScript(color: string, faviconDataUrl: string | null = null): Promise<HTMLLinkElement | null> {
  document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
  vi.clearAllMocks()
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
  HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')

  const scriptFn = TabDots.applyLBracketPageScript
  scriptFn(color, faviconDataUrl)
  await Promise.resolve()
  return document.querySelector<HTMLLinkElement>('link[data-ext-age-ring]')
}

// ─── applyLBracketPageScript ─────────────────────────────────────────────────

describe('applyLBracketPageScript', () => {
  it('injects a <link data-ext-age-ring> into document.head', async () => {
    const link = await runLBracketScript('#00e676')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('data-ext-age-ring')).toBe('true')
    expect(link!.rel).toBe('icon')
    expect(link!.type).toBe('image/png')
  })

  it('link href is a data: URL (canvas output)', async () => {
    const link = await runLBracketScript('#ff1744')
    expect(link!.href).toMatch(/^data:image\/png/)
  })

  it('replaces an existing data-ext-age-ring link (no duplicates)', async () => {
    await runLBracketScript('#00e676')
    await runLBracketScript('#ffd740')
    expect(document.querySelectorAll('link[data-ext-age-ring]').length).toBe(1)
  })

  it('produces a link when faviconData is null (L-bracket only)', async () => {
    const link = await runLBracketScript('#ff6d00', null)
    expect(link).not.toBeNull()
    expect(link!.href).toMatch(/^data:image\/png/)
  })

  it('draws the L-bracket (moveTo + lineTo + stroke called)', async () => {
    await runLBracketScript('#ffd740')
    expect(mockCtx.moveTo).toHaveBeenCalled()
    expect(mockCtx.lineTo).toHaveBeenCalled()
    expect(mockCtx.stroke).toHaveBeenCalled()
  })

  it.each(DOT_COLOR_MAP.map((e) => [e.cssClass, e.color]))(
    'produces overlay for class "%s" with color %s',
    async (_cssClass: string, color: string) => {
      const link = await runLBracketScript(color)
      expect(link).not.toBeNull()
      expect(link!.href).toMatch(/^data:image\/png/)
    },
  )
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
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
    HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')
    setActivePinia(createPinia())
  })

  it('calls executeScript with correct tabId and color', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 42, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false }] })

    await store.markTabWithLBracket(42, '#00e676')

    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42 }, args: ['#00e676', null] }),
    )
  })

  it('pre-fetches favicon and passes data URL to executeScript', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 7, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, favIconUrl: 'https://example.com/favicon.ico' }] })
    const fetchSpy = vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue('data:image/png;base64,TESTDATA')

    await store.markTabWithLBracket(7, '#ff1744')

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/favicon.ico')
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['#ff1744', 'data:image/png;base64,TESTDATA'] }),
    )
  })

  it('does NOT set store.error when executeScript throws (silent fail)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.scripting.executeScript).mockRejectedValueOnce(new Error('Cannot access a chrome:// URL'))
    const store = useTabStore()
    await store.markTabWithLBracket(1, '#00e676')
    expect(store.error).toBeNull()
  })

  it('calls removeLBracket for correct tabId', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    await store.removeLBracket(55)
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 55 } }),
    )
  })

  it('calls markTabWithLBracket for every tab in markOldTabs', async () => {
    const store = useTabStore()
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    store.$patch({
      tabs: [
        { id: 1, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 1  * DAY },
        { id: 2, index: 1, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 10 * DAY },
        { id: 3, index: 2, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, lastAccessed: now - 30 * DAY },
      ],
    })

    const lbSpy = vi.spyOn(store, 'markTabWithLBracket').mockResolvedValue()
    await store.markOldTabs()

    expect(lbSpy).toHaveBeenCalledTimes(3)
    expect(lbSpy).toHaveBeenCalledWith(1, '#00e676')  // fresh → green
    expect(lbSpy).toHaveBeenCalledWith(3, '#ff1744')  // old   → red
  })
})
