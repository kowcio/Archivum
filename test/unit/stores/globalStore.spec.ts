import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('webextension-polyfill', () => ({ default: { storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }, onChanged: { addListener: vi.fn() } } } }))

import { useGlobalStore } from 'src/stores/globalStore.ts'
import StorageService from 'src/services/StorageService'
import {APP_CONSTANTS} from "src/constants.ts";

describe('global store', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
    })

    it('loads data via StorageService.get', async () => {
        vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
            appName: 'proj',
            flags: { username: 'alice', enabled: true, tabsMarkingAge: 14 },
            lastUpdated: 1,
        })
        const s = useGlobalStore()
        await s.load()
        expect(StorageService.get).toHaveBeenCalled()
        expect(s.appName).toBe('proj')
        expect(s.flags.username).toBe('alice')
        expect(s.flags.enabled).toBe(true)
        expect(s.flags.tabsMarkingAge).toBe(14)
    })

    it('saves data via StorageService.set and updates lastUpdated', async () => {
        vi.spyOn(StorageService as any, 'set').mockResolvedValueOnce(undefined)
        const s = useGlobalStore()
        s.appName = 'myapp'
        await s.setFlags({ username: 'bob', enabled: false })
        expect(StorageService.set).toHaveBeenCalledWith(
            APP_CONSTANTS.STORAGE_KEY,
            expect.objectContaining({ appName: 'myapp', flags: expect.objectContaining({ username: 'bob' }) }),
        )
        expect(s.lastUpdated).toBeGreaterThan(0)
    })

    it('init registers storage onChanged and applies incoming updates', async () => {
        let registeredCb: ((changes: Record<string, any>) => void) | undefined
        vi.spyOn(StorageService as any, 'onChanged').mockImplementation((cb: any) => {
            registeredCb = cb
        })
        vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce(undefined)

        const s = useGlobalStore()
        await s.init()

        const incoming = {
            [APP_CONSTANTS.STORAGE_KEY]: {
                appName: 'carol',
                flags: { username: 'carol', enabled: true, tabsMarkingAge: 21 },
                lastUpdated: 999,
            },
        }
        expect(registeredCb).toBeDefined()
        registeredCb?.(incoming)

        expect(s.appName).toBe('carol')
        expect(s.flags.username).toBe('carol')
        expect(s.flags.tabsMarkingAge).toBe(21)
        expect(s.lastUpdated).toBe(999)
    })

    it('exposes APP_CONSTANTS via the constants getter', () => {
        const s = useGlobalStore()
        expect(s.constants.DEFAULT_TABS_MARKING_AGE).toBe(APP_CONSTANTS.DEFAULT_TABS_MARKING_AGE)
        expect(s.constants.STORAGE_KEY).toBe(APP_CONSTANTS.STORAGE_KEY)
    })
})
