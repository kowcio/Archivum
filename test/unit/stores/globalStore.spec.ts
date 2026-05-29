import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import StorageService from "../../../src/services/StorageService";
import { useGlobalStore } from "../../../src/stores/globalStore";
import { AppThresholds, DEFAULT_THRESHOLDS } from "../../../src/models/AppThresholds";
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
            thresholds: { young: 3, middle: 10, old: 30 },
            lastUpdated: 1,
        })
        const s = useGlobalStore()
        await s.load()
        expect(StorageService.get).toHaveBeenCalled()
        expect(s.appName).toBe('proj')
        expect(s.thresholds).toEqual({ young: 3, middle: 10, old: 30 })
    })

    it('saves data via StorageService.set and updates lastUpdated', async () => {
        vi.spyOn(StorageService as any, 'set').mockResolvedValueOnce(undefined)
        const s = useGlobalStore()
        s.appName = 'myapp'
        await s.setThresholds({ young: 5, middle: 12, old: 25 })
        expect(StorageService.set).toHaveBeenCalledWith(
            APP_CONSTANTS.STORAGE_KEY,
            expect.objectContaining({
                appName: 'myapp',
                thresholds: { young: 5, middle: 12, old: 25 },
            }),
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
                thresholds: { young: 4, middle: 11, old: 28 },
                lastUpdated: 999,
            },
        }
        expect(registeredCb).toBeDefined()
        registeredCb?.(incoming)

        expect(s.appName).toBe('carol')
        expect(s.thresholds).toEqual({ young: 4, middle: 11, old: 28 })
        expect(s.lastUpdated).toBe(999)
    })

    // ─── Thresholds ────────────────────────────────────────────────────────────

    describe('thresholds', () => {
        it('initialises with APP_DEFAULTS values', () => {
            const s = useGlobalStore()
            expect(s.thresholds.young).toBe(APP_DEFAULTS.THRESHOLDS.YOUNG)
            expect(s.thresholds.middle).toBe(APP_DEFAULTS.THRESHOLDS.MIDDLE)
            expect(s.thresholds.old).toBe(APP_DEFAULTS.THRESHOLDS.OLD)
        })

        it('DEFAULT_THRESHOLDS constant matches APP_DEFAULTS', () => {
            expect(DEFAULT_THRESHOLDS.young).toBe(APP_DEFAULTS.THRESHOLDS.YOUNG)
            expect(DEFAULT_THRESHOLDS.middle).toBe(APP_DEFAULTS.THRESHOLDS.MIDDLE)
            expect(DEFAULT_THRESHOLDS.old).toBe(APP_DEFAULTS.THRESHOLDS.OLD)
        })

        it('toBoundaries() returns array [young, middle, old]', () => {
            const s = useGlobalStore()
            expect(s.thresholds.toBoundaries()).toEqual([
                APP_DEFAULTS.THRESHOLDS.YOUNG,
                APP_DEFAULTS.THRESHOLDS.MIDDLE,
                APP_DEFAULTS.THRESHOLDS.OLD,
            ])
        })

        it('isValid() returns true for valid thresholds', () => {
            const valid = new AppThresholds(7, 14, 21)
            expect(valid.isValid()).toBe(true)
        })

        it('isValid() returns false when young >= middle', () => {
            const invalid = new AppThresholds(14, 14, 21)
            expect(invalid.isValid()).toBe(false)
        })

        it('isValid() returns false when middle >= old', () => {
            const invalid = new AppThresholds(7, 21, 21)
            expect(invalid.isValid()).toBe(false)
        })

        it('setThresholds deep-merges thresholds without replacing missing keys', async () => {
            vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setThresholds({ young: 5 })

            // young updated, middle and old unchanged
            expect(s.thresholds.young).toBe(5)
            expect(s.thresholds.middle).toBe(APP_DEFAULTS.THRESHOLDS.MIDDLE)
            expect(s.thresholds.old).toBe(APP_DEFAULTS.THRESHOLDS.OLD)
        })

        it('setThresholds rejects invalid changes', async () => {
            vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()
            const before = s.thresholds.toJSON()

            await s.setThresholds({ young: 50 }) // young >= middle → invalid

            expect(s.thresholds.toJSON()).toEqual(before) // unchanged
        })

        it('does not persist when setThresholds input is invalid', async () => {
            const setSpy = vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()
            await s.setThresholds({ young: 200 })
            expect(setSpy).not.toHaveBeenCalled()
        })

        it('persists thresholds via StorageService.set on setThresholds', async () => {
            const setSpy = vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setThresholds({ young: 5, middle: 12, old: 25 })

            expect(setSpy).toHaveBeenCalledWith(
                APP_CONSTANTS.STORAGE_KEY,
                expect.objectContaining({
                    thresholds: { young: 5, middle: 12, old: 25 },
                }),
            )
        })

        it('loads thresholds from storage and deep-merges with defaults', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                thresholds: { young: 3, middle: 10, old: 30 },
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.thresholds.young).toBe(3)
            expect(s.thresholds.middle).toBe(10)
            expect(s.thresholds.old).toBe(30)
        })

        it('falls back to DEFAULT_THRESHOLDS for missing keys on load', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                thresholds: { young: 5 }, // middle and old missing
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.thresholds.young).toBe(5)
            expect(s.thresholds.middle).toBe(DEFAULT_THRESHOLDS.middle)
            expect(s.thresholds.old).toBe(DEFAULT_THRESHOLDS.old)
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
                    thresholds: { young: 4, middle: 11, old: 28 },
                    lastUpdated: 9999,
                },
            })

            expect(s.thresholds.young).toBe(4)
            expect(s.thresholds.middle).toBe(11)
            expect(s.thresholds.old).toBe(28)
        })
    })
})
