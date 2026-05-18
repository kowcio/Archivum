import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Storage, Tabs } from 'webextension-polyfill'
import { useTabStore, TAB_HISTORY_KEY, type TabsSnapshot } from 'src/stores/TabStore'
import { createMockTabs } from '../mock/TabServiceMockFactory'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: { query: vi.fn(), remove: vi.fn(), update: vi.fn() },
    storage: { local: { get: vi.fn(), set: vi.fn() } },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    scripting: { executeScript: vi.fn() },
  },
}))

// ─── In-memory storage factory ─────────────────────────────────────────────

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
  return { tabs, savedAt: savedAt ?? new Date().toISOString() }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

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

  it('loads tabs and savedAt from a stored snapshot, returns the tabs array', async () => {
    const mockTabs = createMockTabs(3)
    const snapshot = makeSnapshot(mockTabs, '2026-01-01T12:00:00.000Z')
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: snapshot })
    const store = useTabStore()

    const result = await store.loadTabsHistory(storage)

    expect(result).toEqual(mockTabs)
    expect(store.tabs).toEqual(mockTabs)
    expect(store.lastSaveDate).toBe('2026-01-01T12:00:00.000Z')
  })

  it('replaces existing tabs in store with loaded snapshot', async () => {
    const oldTabs = createMockTabs(5)
    const newTabs = createMockTabs(2)
    const snapshot = makeSnapshot(newTabs, '2026-06-01T00:00:00.000Z')
    const storage = createInMemoryStorage({ [TAB_HISTORY_KEY]: snapshot })
    const store = useTabStore()
    store.$patch({ tabs: oldTabs })

    const result = await store.loadTabsHistory(storage)

    expect(result).toHaveLength(2)
    expect(store.tabs).toEqual(newTabs)
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
    // Simulate browser.storage.local deserializing array as {0:…, 1:…, 2:…}
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

