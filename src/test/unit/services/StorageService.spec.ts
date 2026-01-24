import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock webextension-polyfill first (critical)
vi.mock('webextension-polyfill', () => {
    // Provide mocks for storage.local and onChanged
    const addListener = vi.fn()
    const mockStorage = {
        local: {
            get: vi.fn(async (key: string) => ({ [key]: { foo: 'bar' } })),
            set: vi.fn(async () => { }),
            remove: vi.fn(async () => { }),
        },
        onChanged: {
            addListener,
        },
    }
    return { default: { storage: mockStorage } }
})

import StorageService from '@/shared/services/StorageService'
import browser from 'webextension-polyfill'

describe('StorageService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses browser.storage.local.get when available', async () => {
        const val = await StorageService.get<{ foo: string }>('test-key')
        expect(val).toEqual({ foo: 'bar' })
        expect(browser.storage.local.get).toHaveBeenCalledWith('test-key')
    })

    it('calls browser.storage.local.set on set()', async () => {
        await StorageService.set('k', { a: 1 })
        expect(browser.storage.local.set).toHaveBeenCalledWith({ k: { a: 1 } })
    })

    it('calls browser.storage.local.remove on remove()', async () => {
        await StorageService.remove('k')
        expect(browser.storage.local.remove).toHaveBeenCalledWith('k')
    })

    it('registers storage change listener and maps change payloads', () => {
        const cb = vi.fn()
        StorageService.onChanged(cb)
        expect(browser.storage.onChanged.addListener).toHaveBeenCalled()

        // extract listener passed to addListener
        const listener = (browser.storage.onChanged.addListener as any).mock.calls[0][0]

        // simulate browser storage change event
        listener({ mykey: { newValue: { x: 1 } } }, 'local')

        expect(cb).toHaveBeenCalledWith({ mykey: { x: 1 } })
    })

    it('falls back to localStorage when browser storage unavailable', async () => {
        // Temporarily disable browser storage availability
        ; (StorageService as any).isBrowserStorageAvailable = false
        try {
            // Use localStorage
            localStorage.setItem('lk', JSON.stringify({ hello: 'world' }))
            const val = await StorageService.get('lk')
            expect(val).toEqual({ hello: 'world' })

            await StorageService.set('lk2', { a: 2 })
            expect(JSON.parse(localStorage.getItem('lk2') || '{}')).toEqual({ a: 2 })

            localStorage.setItem('lk3', 'x')
            await StorageService.remove('lk3')
            expect(localStorage.getItem('lk3')).toBeNull()
        } finally {
            ; (StorageService as any).isBrowserStorageAvailable = true
        }
    })
})
