import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

import FinanseService from '@/services/FinanseService.ts'
import ApiUrlsService from '@/services/ApiUrlsService'

describe('FinanseService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        document.body.innerHTML = ''
    })

    it('fetchKontaFinansowe reads from DOM', async () => {
        // Ensure location includes target so function doesn't attempt window.open (jsdom doesn't implement it)
        Object.defineProperty(window, 'location', {
            value: new URL('https://rozliczenia.estatecare.pl/content/InetObsKontr/finanse'),
            writable: true,
        })

        document.body.innerHTML = `
      <a class="app-konto-finansowe" href="/content/InetObsKontr/finanse/123">1</a>
      <a class="app-konto-finansowe" href="/content/InetObsKontr/finanse/456">2</a>
    `
        const result = await FinanseService.fetchKontaFinansowe()
        expect(result).toContain('123')
        expect(result).toContain('456')
    })

    it('fetchHistoriaRachunku returns Finanse[]', async () => {
        const mockData = { data: { Finanse: [{ McStanu: '2025-01-01' }] } }
            ; (axios.get as any).mockResolvedValueOnce({ data: mockData })
        // ApiUrlsService.getFinanseUrl should return a string - it's not critical for the test
        vi.spyOn(ApiUrlsService, 'getFinanseUrl').mockReturnValueOnce('http://test')

        const res = await FinanseService.fetchHistoriaRachunku('123')
        expect(res).toEqual(mockData.data.Finanse)
        expect(axios.get).toHaveBeenCalled()
    })

    it('fetchDokument returns dokument object', async () => {
        const doc = { Ident: '9', Opis: 'ok' }
            ; (axios.get as any).mockResolvedValueOnce({ data: { data: doc } })
        vi.spyOn(ApiUrlsService, 'getDokumentyUrl').mockReturnValueOnce('http://doc')

        const res = await FinanseService.fetchDokument('9')
        expect(res).toEqual(doc)
        expect(axios.get).toHaveBeenCalled()
    })
})
