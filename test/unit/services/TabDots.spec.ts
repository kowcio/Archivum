vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(), remove: vi.fn(), get: vi.fn(), update: vi.fn(),
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated:   { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved:   { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setIcon: vi.fn() },
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
  },
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TabDots } from 'src/services/TabDots'

const ctxMock = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillText: vi.fn(),
  arc: vi.fn(),
  beginPath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  font: '',
  textAlign: '',
  textBaseline: '',
}

const canvasMock = {
  getContext: vi.fn(() => ctxMock),
  convertToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}

vi.stubGlobal('OffscreenCanvas', function OffscreenCanvas() { return canvasMock })

vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 16, height: 16 })))

vi.stubGlobal('FileReader', class {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL(_blob: Blob) {
    this.result = 'data:image/png;base64,FAKE'
    setTimeout(() => this.onload?.(), 0)
  }
})

vi.stubGlobal('fetch', vi.fn())

describe('TabDots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canvasMock.getContext.mockReturnValue(ctxMock)
    canvasMock.convertToBlob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
  })

  describe('fetchFaviconDataUrl', () => {
    it('returns null for chrome:// URL', async () => {
      const result = await TabDots.fetchFaviconDataUrl('chrome://newtab')
      expect(result).toBeNull()
    })

    it('returns null for moz-extension:// URL', async () => {
      const result = await TabDots.fetchFaviconDataUrl('moz-extension://foo')
      expect(result).toBeNull()
    })

    it('returns null for data: URL', async () => {
      const result = await TabDots.fetchFaviconDataUrl('data:image/png;base64,abc')
      expect(result).toBeNull()
    })

    it('returns null when fetch rejects', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(ne w Error('Network error'))
      const result = await TabDots.fetchFaviconDataUrl('https://example.com/favicon.ico')
      expect(result).toBeNull()
    })

    it('returns a data URL when fetch succeeds', async () => {
      const fakeBlob = new Blob(['fakepng'], { type: 'image/png' })
      vi.mocked(fetch).mockResolvedValueOnce({
        blob: async () => fakeBlob,
      } as Response)

      const result = await TabDots.fetchFaviconDataUrl('https://example.com/favicon.png')
      expect(result).toBe('data:image/png;base64,FAKE')
    })
  })

  describe('renderLBracketDataUrl', () => {
     it('renders L-bracket only (no drawImage) when faviconDataUrl is null', async () => {
      const result = await TabDots.renderLBracketDataUrl(null, '#ff0000')

      expect(ctxMock.drawImage).not.toHaveBeenCalled()
      expect(ctxMock.stroke).toHaveBeenCalled()
      expect(result).toBe('data:image/png;base64,FAKE')
    })

    it('renders favicon via drawImage when faviconDataUrl is valid and createImageBitmap succeeds', async () => {
      const fakeBlob = new Blob(['fakepng'], { type: 'image/png' })
      vi.mocked(fetch).mockResolvedValueOnce({
        blob: async () => fakeBlob,
      } as Response)
      vi.mocked(createImageBitmap).mockResolvedValueOnce({ width: 16, height: 16 } as ImageBitmap)

      const result = await TabDots.renderLBracketDataUrl('data:image/png;base64,FAVICON', '#00ff00')

      expect(ctxMock.drawImage).toHaveBeenCalled()
      expect(ctxMock.fillText).not.toHaveBeenCalled()
      expect(ctxMock.stroke).toHaveBeenCalled()
      expect(result).toBe('data:image/png;base64,FAKE')
    })

    it('renders L-bracket only (no drawImage) when faviconDataUrl is truthy but createImageBitmap throws (ICO regression)', async () => {
      const fakeBlob = new Blob(['fakepng'], { type: 'image/x-icon' })
      vi.mocked(fetch).mockResolvedValueOnce({
        blob: async () => fakeBlob,
      } as Response)
      vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('The source image could not be decoded'))

      const result = await TabDots.renderLBracketDataUrl('data:image/x-icon;base64,ICO', '#0000ff')

      expect(ctxMock.drawImage).not.toHaveBeenCalled()
      expect(ctxMock.stroke).toHaveBeenCalled()
      expect(result).toBe('data:image/png;base64,FAKE')
    })

    it('ignores extra arguments (no fallbackEmoji support in current implementation)', async () => {
      await TabDots.renderLBracketDataUrl(null, '#ffffff')

      expect(ctxMock.fillText).not.toHaveBeenCalled()
      expect(ctxMock.stroke).toHaveBeenCalled()
    })

    it('uses the color argument as strokeStyle for the L-bracket', async () => {
      await TabDots.renderLBracketDataUrl(null, '#abcdef')

      expect(ctxMock.strokeStyle).toBe('#abcdef')
      expect(ctxMock.stroke).toHaveBeenCalled()
    })
  })
})


