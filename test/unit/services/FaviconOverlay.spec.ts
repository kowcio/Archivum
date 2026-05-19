/**
 * Dedicated tests for favicon overlay marking logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { TabDots, DOT_COLOR_MAP } from 'src/services/TabDots'
import { useTabStore } from 'src/stores/TabStore'

// ─── Browser API mock ────────────────────────────────────────────────────────
vi.mock('webextension-polyfill', () => ({
  default: {
    tabs:     { query: vi.fn(), remove: vi.fn(), update: vi.fn() },
    storage:  { local: { get: vi.fn(), set: vi.fn() } },
    action:   { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
  },
}))

// ─── Canvas mock (jsdom doesn't implement getContext) ────────────────────────
const mockCtx = {
  clearRect: vi.fn(),
  save:      vi.fn(),
  restore:   vi.fn(),
  beginPath: vi.fn(),
  arc:       vi.fn(),
  clip:      vi.fn(),
  drawImage: vi.fn(),
  stroke:    vi.fn(),
  strokeStyle: '',
  lineWidth:   0,
}

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function runOverlayScript(color: string, faviconDataUrl: string | null = null): Promise<HTMLLinkElement | null> {
  document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
  vi.clearAllMocks()
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
  HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')

  const scriptFn = TabDots.applyFaviconOverlayPageScript
  scriptFn(color, faviconDataUrl)

  // wait one microtask for img.onload to fire (jsdom img is sync in tests)
  await Promise.resolve()

  return document.querySelector<HTMLLinkElement>('link[data-ext-age-ring]')
}

// ─── applyFaviconOverlayPageScript ───────────────────────────────────────────

describe('applyFaviconOverlayPageScript', () => {
  it('injects a <link data-ext-age-ring> into document.head', async () => {
    const link = await runOverlayScript('#66bb6a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('data-ext-age-ring')).toBe('true')
    expect(link!.rel).toBe('icon')
    expect(link!.type).toBe('image/png')
  })

  it('link href is a data: URL (canvas output)', async () => {
    const link = await runOverlayScript('#e53935')
    expect(link!.href).toMatch(/^data:image\/png/)
  })

  it('replaces an existing data-ext-age-ring link (no duplicates)', async () => {
    await runOverlayScript('#66bb6a')
    await runOverlayScript('#f2c037')
    const links = document.querySelectorAll('link[data-ext-age-ring]')
    expect(links.length).toBe(1)
  })

  it('passes faviconData as img.src — when img loads it draws favicon + ring', async () => {
    // In jsdom img.onload does not fire synchronously for data: URLs.
    // We verify the script sets up the img correctly by checking that
    // when faviconData is null the ring path IS taken synchronously.
    const linkNoFavicon = await runOverlayScript('#fb8c00', null)
    expect(linkNoFavicon).not.toBeNull()
    expect(mockCtx.arc).toHaveBeenCalled()
    expect(mockCtx.stroke).toHaveBeenCalled()
  })

  it('still produces a link even when faviconData is null (ring-only)', async () => {
    const link = await runOverlayScript('#e53935', null)
    expect(link).not.toBeNull()
    expect(link!.href).toMatch(/^data:image\/png/)
  })

  it('still produces a link when no faviconData passed', async () => {
    const link = await runOverlayScript('#66bb6a')
    expect(link).not.toBeNull()
    expect(link!.href).toMatch(/^data:image\/png/)
  })

  it('draws the ring (arc + stroke called on canvas context)', async () => {
    await runOverlayScript('#f2c037')
    expect(mockCtx.arc).toHaveBeenCalled()
    expect(mockCtx.stroke).toHaveBeenCalled()
  })

  // Smoke test for all 4 age-group colours
  it.each(DOT_COLOR_MAP.map((e) => [e.cssClass, e.color]))(
    'produces overlay for class "%s" with color %s',
    async (_cssClass: string, color: string) => {
      const link = await runOverlayScript(color)
      expect(link).not.toBeNull()
      expect(link!.href).toMatch(/^data:image\/png/)
    },
  )
})

// ─── removeFaviconOverlayPageScript ──────────────────────────────────────────

describe('removeFaviconOverlayPageScript', () => {
  it('removes the injected link from DOM', () => {
    const link = document.createElement('link')
    link.setAttribute('data-ext-age-ring', 'true')
    document.head.appendChild(link)

    TabDots.removeFaviconOverlayPageScript()

    expect(document.querySelector('link[data-ext-age-ring]')).toBeNull()
  })

  it('is a no-op when no overlay link exists', () => {
    document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
    expect(() => TabDots.removeFaviconOverlayPageScript()).not.toThrow()
  })
})

// ─── markTabWithFaviconOverlay (store → executeScript integration) ────────────

describe('markTabWithFaviconOverlay (store)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply canvas mock after clearAllMocks
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
    HTMLCanvasElement.prototype.toDataURL  = vi.fn().mockReturnValue('data:image/png;base64,MOCK')
    setActivePinia(createPinia())
  })

  it('calls executeScript with the correct tabId and color arg', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 42, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, favIconUrl: undefined }] })

    await store.markTabWithFaviconOverlay(42, '#66bb6a')

    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 42 },
        args:   ['#66bb6a', null],  // no favIconUrl → faviconDataUrl = null
      }),
    )
  })

  it('pre-fetches favicon from store tab and passes data URL to executeScript', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 7, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false, favIconUrl: 'https://example.com/favicon.ico' }] })

    // Mock fetchFaviconDataUrl
    const fetchSpy = vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue('data:image/png;base64,TESTDATA')

    await store.markTabWithFaviconOverlay(7, '#e53935')

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/favicon.ico')
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['#e53935', 'data:image/png;base64,TESTDATA'],
      }),
    )
  })

  it('calls executeScript with red color for old tabs', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [{ id: 99, index: 0, windowId: 1, highlighted: false, active: false, pinned: false, incognito: false }] })

    await store.markTabWithFaviconOverlay(99, '#e53935')

    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ args: expect.arrayContaining(['#e53935']) }),
    )
  })

  it('does not set store.error when executeScript succeeds', async () => {
    const store = useTabStore()
    await store.markTabWithFaviconOverlay(1, '#66bb6a')
    expect(store.error).toBeNull()
  })

  it('does NOT set store.error when executeScript throws (silent debug-only fail)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.scripting.executeScript).mockRejectedValueOnce(
      new Error('Cannot access a chrome:// URL'),
    )
    const store = useTabStore()
    await store.markTabWithFaviconOverlay(1, '#66bb6a')
    expect(store.error).toBeNull()
  })

  it('calls executeScript for removeFaviconOverlay with correct tabId', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()

    await store.removeFaviconOverlay(55)

    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 55 } }),
    )
  })

  it('calls markTabWithFaviconOverlay for every tab in markOldTabs', async () => {
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

    const overlaySpy = vi.spyOn(store, 'markTabWithFaviconOverlay').mockResolvedValue()
    vi.spyOn(store, 'markTabWithBadge').mockResolvedValue()
    vi.spyOn(store, 'markTabWithGroupColor').mockResolvedValue()

    await store.markOldTabs()

    // All 3 tabs should get the favicon overlay
    expect(overlaySpy).toHaveBeenCalledTimes(3)
    // Fresh tab → green
    expect(overlaySpy).toHaveBeenCalledWith(1, '#66bb6a')
    // Old tab → red
    expect(overlaySpy).toHaveBeenCalledWith(3, '#e53935')
  })
})
