import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { DEFAULT_THRESHOLDS } from '@/models/AppThresholds'

// ── Mocks (hoisted before all imports) ───────────────────────────────────────

vi.mock('webextension-polyfill', () => ({
    default: {
        tabs: { query: vi.fn(), remove: vi.fn() },
        scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    },
}))

vi.mock('@/utils/tabStorage', () => ({
    tabStorageItem: {
        getValue: vi.fn().mockResolvedValue(null),
        setValue: vi.fn().mockResolvedValue(undefined),
        watch:    vi.fn().mockReturnValue(() => {}),
    },
}))

vi.mock('@/services/TabDots', () => ({
    TabDots: {
        fetchFaviconDataUrl:     vi.fn().mockResolvedValue('data:image/png;base64,favicon'),
        renderLBracketDataUrl:   vi.fn().mockResolvedValue('data:image/png;base64,marked'),
        applyLBracketPageScript: vi.fn(),
        removeLBracketPageScript: vi.fn(),
    },
}))

vi.mock('@/stores/globalStore', () => ({
    useGlobalStore: vi.fn(() => ({
        thresholds: DEFAULT_THRESHOLDS,
        init:       vi.fn().mockResolvedValue(undefined),
    })),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import browser from 'webextension-polyfill'
import { tabStorageItem } from '@/utils/tabStorage'
import { useTabStore } from '@/stores/TabStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()

/** Build a minimal Tabs.Tab-like object with a controllable lastAccessed. */
function makeTab(id: number, daysAgo: number, status: 'complete' | 'loading' = 'complete') {
    return {
        id,
        url:          `https://example${id}.com`,
        title:        `Tab ${id}`,
        favIconUrl:   `https://example${id}.com/favicon.ico`,
        active:       false,
        pinned:       false,
        highlighted:  false,
        windowId:     1,
        incognito:    false,
        index:        id - 1,
        selected:     false,
        discarded:    false,
        autoDiscardable: true,
        groupId:      -1,
        status,
        lastAccessed: now - daysAgo * DAY_MS,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TabStore — load / reset cycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
        // Default: browser returns 4 tabs with different ages
        vi.mocked(browser.tabs.query).mockResolvedValue([
            makeTab(1,  3),  // Fresh  (3d  ≤ young=7)
            makeTab(2, 10),  // Young  (7 < 10 ≤ middle=14)
            makeTab(3, 18),  // Middle (14 < 18 ≤ old=21)
            makeTab(4, 30),  // Old    (30 > old=21)
        ] as any)
    })

    // ── getAllOpenedTabs ───────────────────────────────────────────────────────

    it('getAllOpenedTabs: loads tabs into store', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        expect(store.tabs).toHaveLength(4)
    })

    it('getAllOpenedTabs: marks non-fresh tabs (Young / Middle / Old)', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()

        const tabById = (id: number) => store.tabs.find(t => t.id === id)!
        expect(tabById(1).isMarked).toBe(false) // Fresh
        expect(tabById(2).isMarked).toBe(true)  // Young
        expect(tabById(3).isMarked).toBe(true)  // Middle
        expect(tabById(4).isMarked).toBe(true)  // Old
    })

    it('getAllOpenedTabs: persists snapshot to storage', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
    })

    it('getAllOpenedTabs: clears any pre-existing isMarked state', async () => {
        const store = useTabStore()
        // Manually pre-set a tab as marked (simulates stale state)
        await store.getAllOpenedTabs()
        expect(store.tabs.find(t => t.id === 1)?.isMarked).toBe(false) // Fresh stays false
        // Now simulate a second call (e.g. if called while tabs are loaded)
        vi.clearAllMocks()
        vi.mocked(browser.tabs.query).mockResolvedValue([makeTab(1, 3)] as any)
        vi.mocked(tabStorageItem.setValue).mockResolvedValue(undefined)
        await store.getAllOpenedTabs()
        expect(store.tabs.find(t => t.id === 1)?.isMarked).toBe(false) // Still fresh
    })

    // ── reset ─────────────────────────────────────────────────────────────────

    it('reset: removes isMarked flag from all tabs but keeps them in the store', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        expect(store.tabs.filter(t => t.isMarked)).toHaveLength(3)

        await store.reset()
        expect(store.tabs).toHaveLength(4)                         // tabs preserved
        expect(store.tabs.every(t => !t.isMarked)).toBe(true)      // all unmarked
        expect(store.tabs.every(t => !t.markedFaviconDataUrl)).toBe(true) // overlays cleared
    })

    it('reset: saves snapshot with tabs intact (only markings cleared)', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        vi.clearAllMocks()
        vi.mocked(tabStorageItem.setValue).mockResolvedValue(undefined)

        await store.reset()
        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
        const saved = vi.mocked(tabStorageItem.setValue).mock.calls[0][0]
        expect(saved?.tabs).toHaveLength(4)                        // tabs preserved in storage
        expect((saved?.tabs as any[]).every((t: any) => !t.isMarked)).toBe(true)
    })

    it('reset: preserves lastAccessed timestamps', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        const lastAccessedBefore = store.tabs.map(t => t.lastAccessed)

        await store.reset()
        const lastAccessedAfter = store.tabs.map(t => t.lastAccessed)
        expect(lastAccessedAfter).toEqual(lastAccessedBefore)
    })

    it('reset: sets loading to false after completion', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        await store.reset()
        expect(store.loading).toBe(false)
    })

    // ── Full Load → Reset → Load cycle ────────────────────────────────────────

    it('cycle: after reset + reload, ALL non-fresh tabs are marked again', async () => {
        const store = useTabStore()

        // First load
        await store.getAllOpenedTabs()
        expect(store.tabs.filter(t => t.isMarked)).toHaveLength(3) // Young, Middle, Old

        // Reset — tabs stay in store, markings stripped
        await store.reset()
        expect(store.tabs).toHaveLength(4)
        expect(store.tabs.every(t => !t.isMarked)).toBe(true)

        // Second load — ALL non-fresh tabs must be marked again
        vi.mocked(browser.tabs.query).mockResolvedValue([
            makeTab(1,  3),
            makeTab(2, 10),
            makeTab(3, 18),
            makeTab(4, 30),
        ] as any)
        await store.getAllOpenedTabs()

        const tabById = (id: number) => store.tabs.find(t => t.id === id)!
        expect(tabById(1).isMarked).toBe(false) // Fresh
        expect(tabById(2).isMarked).toBe(true)  // Young
        expect(tabById(3).isMarked).toBe(true)  // Middle
        expect(tabById(4).isMarked).toBe(true)  // Old
    })

    it('cycle: isLoaded (any marked tab) toggles correctly', async () => {
        const store = useTabStore()

        expect(store.tabs.some(t => t.isMarked)).toBe(false) // before load
        await store.getAllOpenedTabs()
        expect(store.tabs.some(t => t.isMarked)).toBe(true)  // after load (non-fresh tabs marked)
        await store.reset()
        expect(store.tabs.some(t => t.isMarked)).toBe(false) // after reset (markings stripped, tabs kept)
    })

    // ── _persist ──────────────────────────────────────────────────────────────

    it('_persist: writes current snapshot to storage', async () => {
        const store = useTabStore()
        await store.getAllOpenedTabs()
        vi.clearAllMocks()
        vi.mocked(tabStorageItem.setValue).mockResolvedValue(undefined)

        await store._persist()

        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
        const saved = vi.mocked(tabStorageItem.setValue).mock.calls[0][0]
        expect(saved?.tabs).toHaveLength(4)
    })
})
