import { vi } from 'vitest'
import type { Storage, Tabs } from 'webextension-polyfill'
import TabService, { type TabsSnapshot } from '@/services/TabService.ts'

const TAB_HISTORY_KEY = 'tab_history'

export interface TabServiceMock {
    service: TabService
    tabsApi: Tabs.Static
    storage: Storage.StorageArea
    mockTabs: Tabs.Tab[]
    saved: Record<string, TabsSnapshot | undefined>
}

export const createMockTabs = (count = 2): Tabs.Tab[] =>
    Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        index,
        windowId: 1,
        active: index === 0,
        highlighted: index === 0,
        pinned: false,
        incognito: false,
    } satisfies Tabs.Tab))

export const createTabServiceMock = (options?: {
    tabs?: Tabs.Tab[]
    initialSnapshot?: TabsSnapshot
}): TabServiceMock => {
    const mockTabs = options?.tabs ?? createMockTabs()
    const saved: Record<string, TabsSnapshot | undefined> = options?.initialSnapshot
        ? { [TAB_HISTORY_KEY]: options.initialSnapshot }
        : {}

    const tabsApi = {
        query: vi.fn(async () => mockTabs),
        update: vi.fn(async (tabId: number, updateProps: Tabs.UpdateUpdatePropertiesType) => {
            const tab = mockTabs.find((t) => t.id === tabId)
            if (!tab) {
                throw new Error(`Tab with id ${tabId} not found`)
            }
            return { ...tab, ...updateProps } as Tabs.Tab
        }),
    } as unknown as Tabs.Static

    const storage = {
        set: vi.fn(async (value: Record<string, TabsSnapshot>) => {
            Object.assign(saved, value)
        }),
        get: vi.fn(async (key: string | string[]) => {
            if (typeof key === 'string') {
                return { [key]: saved[key] }
            }
            return key.reduce<Record<string, TabsSnapshot | undefined>>((acc, curr) => {
                acc[curr] = saved[curr]
                return acc
            }, {})
        }),
    } as unknown as Storage.StorageArea

    const service = new TabService(tabsApi, storage)

    return { service, tabsApi, storage, mockTabs, saved }
}

