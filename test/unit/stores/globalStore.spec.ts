import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import StorageService from "../../../src/services/StorageService";
import { useGlobalStore, DEFAULT_THRESHOLDS } from "../../../src/stores/globalStore";
import { APP_CONSTANTS, APP_DEFAULTS } from "../../../src/constants";

vi.mock('webextension-polyfill', () => ({ default: { storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }, onChanged: { addListener: vi.fn() } } } }))


describe('global store', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
    })

    it('loads data via StorageService.get', async () => {
        vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
            appName: 'proj',
            flags: { username: 'alice', enabled: true },
            lastUpdated: 1,
        })
        const s = useGlobalStore()
        await s.load()
        expect(StorageService.get).toHaveBeenCalled()
        expect(s.appName).toBe('proj')
        expect(s.flags.username).toBe('alice')
        expect(s.flags.enabled).toBe(true)
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
                flags: { username: 'carol', enabled: true },
                lastUpdated: 999,
            },
        }
        expect(registeredCb).toBeDefined()
        registeredCb?.(incoming)

        expect(s.appName).toBe('carol')
        expect(s.flags.username).toBe('carol')
        expect(s.lastUpdated).toBe(999)
    })

    // ─── Thresholds ────────────────────────────────────────────────────────────

    describe('thresholds', () => {
        it('initialises with APP_DEFAULTS values', () => {
            const s = useGlobalStore()
            expect(s.flags.thresholds).toEqual({
                young:  APP_DEFAULTS.THRESHOLDS.YOUNG,
                middle: APP_DEFAULTS.THRESHOLDS.MIDDLE,
                old:    APP_DEFAULTS.THRESHOLDS.OLD,
            })
        })

        it('DEFAULT_THRESHOLDS constant matches APP_DEFAULTS', () => {
            expect(DEFAULT_THRESHOLDS).toEqual({
                young:  APP_DEFAULTS.THRESHOLDS.YOUNG,
                middle: APP_DEFAULTS.THRESHOLDS.MIDDLE,
                old:    APP_DEFAULTS.THRESHOLDS.OLD,
            })
        })

        it('thresholdsArray getter returns [young, middle, old]', () => {
            const s = useGlobalStore()
            expect(s.thresholdsArray).toEqual([
                APP_DEFAULTS.THRESHOLDS.YOUNG,
                APP_DEFAULTS.THRESHOLDS.MIDDLE,
                APP_DEFAULTS.THRESHOLDS.OLD,
            ])
        })

        it('setFlags deep-merges thresholds without replacing missing keys', async () => {
            vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setFlags({ thresholds: { young: 5 } as any })

            // young updated, middle and old unchanged
            expect(s.flags.thresholds.young).toBe(5)
            expect(s.flags.thresholds.middle).toBe(APP_DEFAULTS.THRESHOLDS.MIDDLE)
            expect(s.flags.thresholds.old).toBe(APP_DEFAULTS.THRESHOLDS.OLD)
        })

        it('persists thresholds via StorageService.set on setFlags', async () => {
            const setSpy = vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setFlags({ thresholds: { young: 5, middle: 12, old: 25 } })

            expect(setSpy).toHaveBeenCalledWith(
                APP_CONSTANTS.STORAGE_KEY,
                expect.objectContaining({
                    flags: expect.objectContaining({
                        thresholds: { young: 5, middle: 12, old: 25 },
                    }),
                }),
            )
        })

        it('loads thresholds from storage and deep-merges with defaults', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                flags: { thresholds: { young: 3, middle: 10, old: 30 } },
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.flags.thresholds).toEqual({ young: 3, middle: 10, old: 30 })
        })

        it('falls back to DEFAULT_THRESHOLDS for missing keys on load', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                flags: { thresholds: { young: 5 } }, // middle and old missing
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.flags.thresholds.young).toBe(5)
            expect(s.flags.thresholds.middle).toBe(DEFAULT_THRESHOLDS.middle)
            expect(s.flags.thresholds.old).toBe(DEFAULT_THRESHOLDS.old)
        })

        it('storage sync updates thresholds via onChanged callback', async () => {
            let registeredCb: ((changes: Record<string, any>) => void) | undefined
            vi.spyOn(StorageService as any, 'onChanged').mockImplementation((cb: any) => {
                registeredCb = cb
            })
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce(undefined)

            const s = useGlobalStore()
            await s.init()

            registeredCb?.({
                [APP_CONSTANTS.STORAGE_KEY]: {
                    flags: { thresholds: { young: 4, middle: 11, old: 28 } },
                    lastUpdated: 9999,
                },
            })

            expect(s.flags.thresholds).toEqual({ young: 4, middle: 11, old: 28 })
        })
    })
})
