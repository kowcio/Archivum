import { describe, it, expect, vi } from 'vitest'
import {createMockTabs, createTabServiceMock} from "@/test/unit/mock/TabServiceMockFactory.ts";

vi.mock('webextension-polyfill', () => {
    const tabs = {}
    const storage = { local: {} }
    return { __esModule: true, default: { tabs, storage }, tabs, storage }
})

describe('TabService', () => {
    it('saves all opened tabs and loads them back from storage', async () => {
        const { service, tabsApi, storage, mockTabs } = createTabServiceMock()

        const snapshot = await service.saveAllTabs()

        expect(tabsApi.query).toHaveBeenCalledWith({})
        expect(storage.set).toHaveBeenCalledWith({ tab_history: snapshot })
        expect(snapshot.tabs).toEqual(mockTabs)
        expect(snapshot.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

        const loaded = await service.loadTabsHistory()
        expect(storage.get).toHaveBeenCalledWith('tab_history')
        expect(loaded).toEqual(snapshot)
    })

    it('returns null when no history is stored', async () => {
        const { service, storage } = createTabServiceMock()

        const history = await service.loadTabsHistory()

        expect(storage.get).toHaveBeenCalledWith('tab_history')
        expect(history).toBeNull()
    })

    it('updates a tab using the tabs API', async () => {
        const { service, tabsApi } = createTabServiceMock()

        const updated = await service.updateTab(1, { highlighted: false })

        expect(tabsApi.update).toHaveBeenCalledWith(1, { highlighted: false })
        expect(updated.highlighted).toBe(false)
    })

    it('returns all opened tabs', async () => {
        const customTabs = createMockTabs(3)
        const { service, tabsApi } = createTabServiceMock({ tabs: customTabs })

        const tabs = await service.getAllOpenedTabs()

        expect(tabsApi.query).toHaveBeenCalledWith({})
        expect(tabs).toEqual(customTabs)
    })
})
