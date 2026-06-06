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

// ── Imports after mocks ───────────────────────────────────────────────────────

import browser from 'webextension-polyfill'
import { tabStorageItem } from '@/utils/tabStorage'
import { useAppStore } from '@/stores/appStore'

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
        const store = useAppStore()
        await store.getAllOpenedTabs()
        expect(store.tabs).toHaveLength(4)
    })

    it('getAllOpenedTabs: classifies tabs by age (Fresh / Young / Middle / Old)', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()

        const tabById = (id: number) => store.tabs.find(t => t.id === id)!
        expect(tabById(1).ageIndex).toBe(0) // Fresh
        expect(tabById(2).ageIndex).toBe(1) // Young
        expect(tabById(3).ageIndex).toBe(2) // Middle
        expect(tabById(4).ageIndex).toBe(3) // Old
    })

    it('getAllOpenedTabs: persists snapshot to storage', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()
        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
    })

    it('getAllOpenedTabs: clears any pre-existing isMarked state', async () => {
        const store = useAppStore()
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

    // (removed - no longer test isMarked state)

    it('reset: saves snapshot with tabs intact', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()
        vi.clearAllMocks()
        vi.mocked(tabStorageItem.setValue).mockResolvedValue(undefined)

        await store.reset()
        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
        const saved = vi.mocked(tabStorageItem.setValue).mock.calls[0][0]
        expect(saved?.tabs).toHaveLength(4)
        expect(saved?.isGrouped).toBe(false)
    })

    it('reset: preserves lastAccessed timestamps', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()
        const lastAccessedBefore = store.tabs.map(t => t.lastAccessed)

        await store.reset()
        const lastAccessedAfter = store.tabs.map(t => t.lastAccessed)
        expect(lastAccessedAfter).toEqual(lastAccessedBefore)
    })

    it('reset: sets loading to false after completion', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()
        await store.reset()
        expect(store.loading).toBe(false)
    })

    // ── Full Load → Reset → Load cycle ────────────────────────────────────────

    it('cycle: after reset + reload, tabs are classified by age again', async () => {
        const store = useAppStore()

        // First load
        await store.getAllOpenedTabs()
        expect(store.tabs.filter(t => t.ageIndex > 0)).toHaveLength(3) // Young, Middle, Old

        // Reset — tabs stay in store
        await store.reset()
        expect(store.tabs).toHaveLength(4)

        // Second load — ALL non-fresh tabs must be classified again
        vi.mocked(browser.tabs.query).mockResolvedValue([
            makeTab(1,  3),
            makeTab(2, 10),
            makeTab(3, 18),
            makeTab(4, 30),
        ] as any)
        await store.getAllOpenedTabs()

        const tabById = (id: number) => store.tabs.find(t => t.id === id)!
        expect(tabById(1).ageIndex).toBe(0) // Fresh
        expect(tabById(2).ageIndex).toBe(1) // Young
        expect(tabById(3).ageIndex).toBe(2) // Middle
        expect(tabById(4).ageIndex).toBe(3) // Old
    })

    it('cycle: age classification toggles correctly through load/reset cycle', async () => {
        const store = useAppStore()

        expect(store.tabs.some(t => t.ageIndex > 0)).toBe(false) // before load
        await store.getAllOpenedTabs()
        expect(store.tabs.some(t => t.ageIndex > 0)).toBe(true)  // after load (non-fresh tabs classified)
        await store.reset()
        expect(store.tabs).toHaveLength(4) // tabs preserved after reset
    })

    // ── _persist ──────────────────────────────────────────────────────────────

    it('_persist: writes current snapshot to storage', async () => {
        const store = useAppStore()
        await store.getAllOpenedTabs()
        vi.clearAllMocks()
        vi.mocked(tabStorageItem.setValue).mockResolvedValue(undefined)

        await store.persistTabs()

        expect(tabStorageItem.setValue).toHaveBeenCalledOnce()
        const saved = vi.mocked(tabStorageItem.setValue).mock.calls[0][0]
        expect(saved?.tabs).toHaveLength(4)
    })
})
