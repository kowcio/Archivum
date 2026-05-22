import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Storage, Tabs } from 'webextension-polyfill'
import { useTabStore, TAB_HISTORY_KEY } from 'src/stores/TabStore'
import { TabsSnapshot } from 'src/models/tabs/TabsSnapshot'
import { useGlobalStore } from 'src/stores/globalStore'
import { createMockTabs } from '../mock/TabServiceMockFactory'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: { query: vi.fn(), remove: vi.fn(), update: vi.fn() },
    storage: { local: { get: vi.fn(), set: vi.fn() } },
    action: {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setBadgeTextColor: vi.fn().mockResolvedValue(undefined),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
  },
}))

// ─── Helpers ───────────────────────────────────────────────────────────────

function createInMemoryStorage(initial: Record<string, unknown> = {}): Storage.StorageArea {
  const data: Record<string, unknown> = { ...initial }
  return {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(data, items) }),
    remove: vi.fn(async (key: string) => { delete data[key] }),
    clear: vi.fn(async () => { Object.keys(data).forEach((k) => delete data[k]) }),
    getBytesInUse: vi.fn(async () => 0),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
  } as unknown as Storage.StorageArea
}

function makeSnapshot(tabs: Tabs.Tab[], savedAt?: string): TabsSnapshot {
  return new TabsSnapshot(tabs, savedAt ?? new Date().toISOString())
}

/** Creates a tab whose lastAccessed puts it exactly N days in the past */
function tabWithAge(id: number, daysAgo: number): Tabs.Tab {
  return {
    id,
    index: id,
    windowId: 1,
    active: false,
    highlighted: false,
    pinned: false,
    incognito: false,
    lastAccessed: Date.now() - daysAgo * 24 * 60 * 60 * 1000,
    title: `Tab ${id}`,
    url: `https://example.com/${id}`,
  } as Tabs.Tab
}

// ─── markOldTabs badge colour tests ───────────────────────────────────────

describe.skip('TabStore › markOldTabs › badge colors (disabled — badge marking not active)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('sets green badge for fresh tab (0 days, young=7)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [tabWithAge(1, 0)] })
    await store.markOldTabs()
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '●', tabId: 1 })
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#66bb6a', tabId: 1 })
  })

  it('sets yellow badge for young tab (10 days, young=7, middle=14)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [tabWithAge(2, 10)] })
    await store.markOldTabs()
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f2c037', tabId: 2 })
  })

  it('sets orange badge for middle tab (18 days, middle=14, old=21)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [tabWithAge(3, 18)] })
    await store.markOldTabs()
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#fb8c00', tabId: 3 })
  })

  it('sets red badge for old tab (30 days, old=21)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    const store = useTabStore()
    store.$patch({ tabs: [tabWithAge(4, 30)] })
    await store.markOldTabs()
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#e53935', tabId: 4 })
  })
})

// ─── clearDotsFromOpenTabs / reset store sync ─────────────────────────────

describe('TabStore › reset syncs tabs from browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('reset reloads tabs from browser (strips any stale data)', async () => {
    const store = useTabStore()
    const cleanTabs = [
      { ...tabWithAge(1, 10), title: 'My Tab' },
      { ...tabWithAge(2, 20), title: 'Another Tab' },
      { ...tabWithAge(3, 0),  title: 'Fresh Tab' },
    ]
    store.$patch({ tabs: cleanTabs as any })
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(cleanTabs as Tabs.Tab[])

    await store.clearDotsFromOpenTabs()

    expect(store.tabs[0].title).toBe('My Tab')
    expect(store.tabs[1].title).toBe('Another Tab')
    expect(store.tabs[2].title).toBe('Fresh Tab')
  })

  it('resetAllTabMarks delegates to reset (reloads from browser)', async () => {
    const store = useTabStore()
    const cleanTabs = [
      { ...tabWithAge(1, 30), title: 'Old Tab' },
      { ...tabWithAge(2, 5),  title: 'Fresh Tab' },
    ]
    store.$patch({ tabs: cleanTabs as any })
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(cleanTabs as Tabs.Tab[])

    await store.resetAllTabMarks()

    expect(browser.tabs.query).toHaveBeenCalled()
  })

  it('leaves tabs without marks unchanged after reset', async () => {
    const store = useTabStore()
    const cleanTab = { ...tabWithAge(1, 5), title: 'Clean Title' }
    store.$patch({ tabs: [cleanTab as any] })
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue([cleanTab] as Tabs.Tab[])

    await store.clearDotsFromOpenTabs()

    expect(store.tabs[0].title).toBe('Clean Title')
  })

  it('reset clears isGrouped flag', async () => {
    const store = useTabStore()
    store.$patch({ isGrouped: true, tabs: [] })
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue([])

    await store.reset()

    expect(store.isGrouped).toBe(false)
  })
})

// ─── loadTabsHistory tests ─────────────────────────────────────────────────

describe('TabStore › loadTabsHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('returns empty array and leaves tabs empty when storage has no snapshot', async () => {
    const storage = createInMemoryStorage()
    const store = useTabStore()

    const result = await store.loadTabsHistory(storage)

    expect(result).toEqual([])
    expect(store.tabs).toHaveLength(0)
    expect(store.lastSaveDate).toBeNull()
  })

  it('loads tabs and savedAt from a stored snapshot, tabs contain original fields', async () => {
    const mockTabs = createMockTabs(3)
    const snapshot = makeSnapshot(mockTabs, '2026-01-01T12:00:00.000Z')
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: snapshot })
    const store = useTabStore()

    const result = await store.loadTabsHistory(storage)

    // ClassifiedTab wraps raw tabs — check original fields are present
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe(mockTabs[0].id)
    expect(result[0].index).toBe(mockTabs[0].index)
    expect(store.lastSaveDate).toBe('2026-01-01T12:00:00.000Z')
  })

  it('replaces existing tabs in store with loaded snapshot', async () => {
    const newTabs = createMockTabs(2)
    const snapshot = makeSnapshot(newTabs, '2026-06-01T00:00:00.000Z')
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: snapshot })
    const store = useTabStore()
    store.$patch({ tabs: createMockTabs(5) as any })

    const result = await store.loadTabsHistory(storage)

    expect(result).toHaveLength(2)
    expect(store.tabs).toHaveLength(2)
  })

  it('sets loading=false after successful load', async () => {
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: makeSnapshot(createMockTabs(1)) })
    const store = useTabStore()

    await store.loadTabsHistory(storage)

    expect(store.loading).toBe(false)
  })

  it('sets error and returns empty array on storage failure', async () => {
    const storage = createInMemoryStorage()
    vi.mocked(storage.get).mockRejectedValueOnce(new Error('Storage read error'))
    const store = useTabStore()

    const result = await store.loadTabsHistory(storage)

    expect(result).toEqual([])
    expect(store.error).toBe('Storage read error')
    expect(store.loading).toBe(false)
  })

  it('sets loading=false even after storage failure', async () => {
    const storage = createInMemoryStorage()
    vi.mocked(storage.get).mockRejectedValueOnce(new Error('fail'))
    const store = useTabStore()

    await store.loadTabsHistory(storage)

    expect(store.loading).toBe(false)
  })

  it('normalizes tabs when storage returns object with numeric keys instead of array', async () => {
    const mockTabs = createMockTabs(3)
    const snapshotWithObjectTabs = {
      tabs: { 0: mockTabs[0], 1: mockTabs[1], 2: mockTabs[2] },
      savedAt: '2026-01-01T00:00:00.000Z',
    }
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: snapshotWithObjectTabs })
    const store = useTabStore()

    const result = await store.loadTabsHistory(storage)

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
    expect(Array.isArray(store.tabs)).toBe(true)
  })

  it('uses browser.storage.local by default (no storage param)', async () => {
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ [TAB_HISTORY_KEY]: undefined })
    const store = useTabStore()

    const result = await store.loadTabsHistory()

    expect(browser.storage.local.get).toHaveBeenCalledWith(TAB_HISTORY_KEY)
    expect(result).toEqual([])
  })
})

