import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock webextension-polyfill first (important for StorageService)
vi.mock('webextension-polyfill', () => ({ default: { storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }, onChanged: { addListener: vi.fn() } } } }))

import { useGlobalStore } from '@/stores/globalStore.ts'
import StorageService from '@/services/StorageService'

describe('global store', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
    })

    it('loads data via StorageService.get', async () => {
        vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({ appName: 'proj', flags: { a: true }, lastUpdated: 1 })
        const s = useGlobalStore()
        await s.load()
        expect(StorageService.get).toHaveBeenCalled()
        expect(s.appName).toBe('proj')
        expect(s.flags.a).toBe(true)
    })

    it('saves data via StorageService.set and updates lastUpdated', async () => {
        vi.spyOn(StorageService as any, 'set').mockResolvedValueOnce(undefined)
        const s = useGlobalStore()
        s.appName = 'myapp'
        s.flags = { x: false }
        expect(s.lastUpdated).toBeDefined()
        await s.save()
        expect(StorageService.set).toHaveBeenCalledWith('global_store', expect.objectContaining({ appName: 'myapp', flags: { x: false } }))
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

        const incoming = { global_store: { appName: 'carol', flags: { a: true }, lastUpdated: 999 } }
        expect(registeredCb).toBeDefined()
        registeredCb?.(incoming)

        expect(s.appName).toBe('carol')
        expect(s.flags.a).toBe(true)
        expect(s.lastUpdated).toBe(999)
    })
})
