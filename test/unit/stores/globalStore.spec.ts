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
            thresholds: {
                levels: [
                    { days: 3, key: 'young', label: 'Young', color: '#ffd740' },
                    { days: 10, key: 'middle', label: 'Middle', color: '#ff6d00' },
                    { days: 30, key: 'old', label: 'Old', color: '#ff1744' }
                ]
            },
            lastUpdated: 1,
        })
        const s = useGlobalStore()
        await s.load()
        expect(StorageService.get).toHaveBeenCalled()
        expect(s.appName).toBe('proj')
        expect(s.thresholds.levels[0].days).toBe(3)
        expect(s.thresholds.levels[1].days).toBe(10)
        expect(s.thresholds.levels[2].days).toBe(30)
    })

    it('saves data via StorageService.set and updates lastUpdated', async () => {
        vi.spyOn(StorageService as any, 'set').mockResolvedValueOnce(undefined)
        const s = useGlobalStore()
        s.appName = 'myapp'
        await s.setThresholds({
            0: { days: 5 },
            1: { days: 12 },
            2: { days: 25 }
        })
        expect(StorageService.set).toHaveBeenCalledWith(
            APP_CONSTANTS.STORE_GLOBAL_STORE,
            expect.objectContaining({
                appName: 'myapp',
                thresholds: expect.objectContaining({
                    levels: expect.any(Array),
                }),
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
            [APP_CONSTANTS.STORE_GLOBAL_STORE]: {
                appName: 'carol',
                thresholds: {
                    levels: [
                        { days: 4, key: 'young', label: 'Young', color: '#ffd740' },
                        { days: 11, key: 'middle', label: 'Middle', color: '#ff6d00' },
                        { days: 28, key: 'old', label: 'Old', color: '#ff1744' }
                    ]
                },
                lastUpdated: 999,
            },
        }
        expect(registeredCb).toBeDefined()
        registeredCb?.(incoming)

        expect(s.appName).toBe('carol')
        expect(s.thresholds.levels[0].days).toBe(4)
        expect(s.thresholds.levels[1].days).toBe(11)
        expect(s.thresholds.levels[2].days).toBe(28)
        expect(s.lastUpdated).toBe(999)
    })

    // ─── Thresholds ────────────────────────────────────────────────────────────

    describe('thresholds', () => {
        it('initialises with APP_DEFAULTS values', () => {
            const s = useGlobalStore()
            expect(s.thresholds.levels.length).toBeGreaterThanOrEqual(3)
            expect(s.thresholds.levels[0].days).toBeGreaterThanOrEqual(0)
            expect(s.thresholds.levels[1].days).toBeGreaterThan(s.thresholds.levels[0].days)
            expect(s.thresholds.levels[2].days).toBeGreaterThan(s.thresholds.levels[1].days)
        })

        it('DEFAULT_THRESHOLDS constant matches APP_DEFAULTS', () => {
            expect(DEFAULT_THRESHOLDS.levels.length).toBeGreaterThanOrEqual(3)
            for (let i = 1; i < DEFAULT_THRESHOLDS.levels.length; i++) {
                expect(DEFAULT_THRESHOLDS.levels[i].days).toBeGreaterThan(
                    DEFAULT_THRESHOLDS.levels[i - 1].days
                )
            }
        })

        it('toBoundaries() returns array of days', () => {
            const s = useGlobalStore()
            const boundaries = s.thresholds.toBoundaries()
            expect(Array.isArray(boundaries)).toBe(true)
            expect(boundaries.length).toBeGreaterThanOrEqual(3)
        })

        it('isValid() returns true for valid thresholds', () => {
            const valid = new AppThresholds([
                { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
                { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
                { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
            ])
            expect(valid.isValid()).toBe(true)
        })

        it('isValid() returns false when level[i] >= level[i+1]', () => {
            const invalid = new AppThresholds([
                { key: 'y', label: 'Young', days: 14, color: '#ffd740' },
                { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
                { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
            ])
            expect(invalid.isValid()).toBe(false)
        })

        it('setThresholds deep-merges thresholds without replacing missing keys', async () => {
            vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setThresholds({ 0: { days: 5 } })

            // level[0].days updated, others unchanged
            expect(s.thresholds.levels[0].days).toBe(5)
            expect(s.thresholds.levels[1].days).toBe(DEFAULT_THRESHOLDS.levels[1].days)
            expect(s.thresholds.levels[2].days).toBe(DEFAULT_THRESHOLDS.levels[2].days)
        })

        it('setThresholds rejects invalid changes', async () => {
            vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()
            const before = s.thresholds.toJSON()

            await s.setThresholds({ 0: { days: 50 } }) // level[0] >= level[1] → invalid

            expect(s.thresholds.toJSON()).toEqual(before) // unchanged
        })

        it('does not persist when setThresholds input is invalid', async () => {
            const setSpy = vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()
            await s.setThresholds({ 0: { days: 200 } })
            expect(setSpy).not.toHaveBeenCalled()
        })

        it('persists thresholds via StorageService.set on setThresholds', async () => {
            const setSpy = vi.spyOn(StorageService as any, 'set').mockResolvedValue(undefined)
            const s = useGlobalStore()

            await s.setThresholds({
                0: { days: 5 },
                1: { days: 12 },
                2: { days: 25 }
            })

            expect(setSpy).toHaveBeenCalledWith(
                APP_CONSTANTS.STORE_GLOBAL_STORE,
                expect.objectContaining({
                    thresholds: expect.objectContaining({
                        levels: expect.any(Array),
                    }),
                }),
            )
        })

        it('loads thresholds from storage and deep-merges with defaults', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                thresholds: {
                    levels: [
                        { days: 3, key: 'y', label: 'Y', color: '#ffd740' },
                        { days: 10, key: 'm', label: 'M', color: '#ff6d00' },
                        { days: 30, key: 'o', label: 'O', color: '#ff1744' }
                    ]
                },
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.thresholds.levels[0].days).toBe(3)
            expect(s.thresholds.levels[1].days).toBe(10)
            expect(s.thresholds.levels[2].days).toBe(30)
        })

        it('falls back to DEFAULT_THRESHOLDS for missing levels on load', async () => {
            vi.spyOn(StorageService as any, 'get').mockResolvedValueOnce({
                thresholds: {
                    levels: [
                        { days: 5, key: 'y', label: 'Y', color: '#ffd740' }
                    ]
                },
            })
            const s = useGlobalStore()
            await s.load()

            expect(s.thresholds.levels[0].days).toBe(5)
            // Missing levels fall back to defaults
            for (let i = 1; i < DEFAULT_THRESHOLDS.levels.length; i++) {
                expect(s.thresholds.levels[i].days).toBe(DEFAULT_THRESHOLDS.levels[i].days)
            }
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
                [APP_CONSTANTS.STORE_GLOBAL_STORE]: {
                    thresholds: {
                        levels: [
                            { days: 4, key: 'y', label: 'Y', color: '#ffd740' },
                            { days: 11, key: 'm', label: 'M', color: '#ff6d00' },
                            { days: 28, key: 'o', label: 'O', color: '#ff1744' }
                        ]
                    },
                    lastUpdated: 9999,
                },
            })

            expect(s.thresholds.levels[0].days).toBe(4)
            expect(s.thresholds.levels[1].days).toBe(11)
            expect(s.thresholds.levels[2].days).toBe(28)
        })
    })
})
