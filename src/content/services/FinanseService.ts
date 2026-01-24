import axios from 'axios'
import ApiUrlsService from '@/shared/services/ApiUrlsService'
import type { Finanse, HistoriaRachunku } from '@/models/EstateCare/DajDrzewoFinHistoria'
import type { DocumentSzczegoly } from '@/models/EstateCare/DajDokSzczegoly'

export default class FinanseService {
    public static async fetchKontaFinansowe(): Promise<string[]> {
        try {
            const url = 'https://rozliczenia.estatecare.pl/content/InetObsKontr/finanse'
            if (!window.location.href.includes(url)) {
                // Try to open in same tab if not present; fallback to current DOM search
                await window.open(url, 'self')
            }
            const elements = document.querySelectorAll('.app-konto-finansowe')
            const konta: string[] = []
            elements.forEach((element) => {
                const adres = element.getAttribute('href') || ''
                const regex = /\/content\/InetObsKontr\/finanse\/(\d+)/
                const match = adres.match(regex)
                if (match) konta.push(match[1])
            })
            konta.sort((a, b) => b.localeCompare(a))
            return konta
        } catch (err) {
            console.error('[FinanseService] fetchKontaFinansowe failed', err)
            return []
        }
    }

    public static async fetchHistoriaRachunku(numerRachunku: string): Promise<Finanse[]> {
        try {
            const POMSessionId = localStorage.getItem('POMSessionId')
            const at = localStorage.getItem('at')
            const url = ApiUrlsService.getFinanseUrl(numerRachunku)
            const response = await axios.get<{ data: { Finanse: Finanse[] } }>(url, {
                headers: { Cookie: `POMSessionId=${POMSessionId}; at=${at}` },
            })
            return response.data?.data?.Finanse ?? []
        } catch (err) {
            console.error('[FinanseService] fetchHistoriaRachunku failed', err)
            return []
        }
    }

    public static async fetchDokument(ident: string): Promise<DocumentSzczegoly | null> {
        try {
            const POMSessionId = localStorage.getItem('POMSessionId')
            const at = localStorage.getItem('at')
            const url = ApiUrlsService.getDokumentyUrl(ident)
            const response = await axios.get<{ data: DocumentSzczegoly }>(url, {
                headers: { Cookie: `POMSessionId=${POMSessionId}; at=${at}` },
            })
            return response.data?.data ?? null
        } catch (err) {
            console.error('[FinanseService] fetchDokument failed', err)
            return null
        }
    }
}
