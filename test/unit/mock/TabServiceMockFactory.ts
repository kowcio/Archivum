import { vi } from 'vitest'
import type { Storage, Tabs } from 'webextension-polyfill'
import dayjs from 'dayjs'

export const createMockTabs = (count = 2): Tabs.Tab[] =>
    Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        index,
        windowId: 1,
        active: index === 0,
        highlighted: index === 0,
        lastAccessed: dayjs().subtract(6, 'day').unix(),
        pinned: false,
        incognito: false,
    } satisfies Tabs.Tab))

export const createMockStorage = (initial: Record<string, unknown> = {}): Storage.StorageArea => {
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
