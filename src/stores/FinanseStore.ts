import { defineStore } from 'pinia'
import type { Finanse } from '@/models/EstateCare/DajDrzewoFinHistoria.ts'
import type { DocumentSzczegoly, Pozycja } from '@/models/EstateCare/DajDokSzczegoly.ts'
import type { ChartData } from '@/models/Charts.ts'
import dayjs from 'dayjs'
import FinanseService from '@/services/FinanseService.ts'

export interface Configuration {
    downloadDocuments: boolean
    // Add more config options here as needed
}

export const DEFAULT_CONFIG: Configuration = { downloadDocuments: true }

export interface MyFinanseStoreState {
    cfg: Configuration
    kontaFinansowe: string[]
    finanse: Finanse[]
    dokumenty: DocumentSzczegoly[]
    loading: boolean
    error: unknown
    chartData: ChartData
    csvData: string[]
}

export const useFinanseStore = defineStore('myFinanse', {
    state: (): MyFinanseStoreState => ({
        cfg: DEFAULT_CONFIG,
        kontaFinansowe: [],
        finanse: [],
        dokumenty: [],
        loading: false,
        error: null,
        chartData: { type: 'line', labels: [], datasets: [] },
        csvData: [],
    }),
    getters: {
        // getters
        countKonta: (state) => state.kontaFinansowe.length,
        hasFinanse: (state) => state.finanse.length > 0,
        getCsvData: (state) => state.csvData,
    },

    actions: {
        async loadKontaFinansowe() {
            this.loading = true
            this.error = null
            try {
                const konta = await FinanseService.fetchKontaFinansowe()
                this.kontaFinansowe = konta
                return konta
            } catch (err) {
                this.error = err
                return []
            } finally {
                this.loading = false
            }
        },

        async loadHistoriaRachunku(numerRachunku: string) {
            this.loading = true
            this.error = null
            try {
                const finanse = await FinanseService.fetchHistoriaRachunku(numerRachunku)
                this.finanse = finanse
                return finanse
            } catch (err) {
                this.error = err
                this.finanse = []
                return []
            } finally {
                this.loading = false
            }
        },

        async loadDokument(ident: string) {
            this.loading = true
            this.error = null
            try {
                const dokument = await FinanseService.fetchDokument(ident)
                if (dokument) this.dokumenty = [dokument]
                return dokument
            } catch (err) {
                this.error = err
                return null
            } finally {
                this.loading = false
            }
        },

        saveChartDate(chartData: ChartData) {
            this.chartData = chartData
        },

        getLogSzczegolyOplatCsv(finanseZaMiesiac: Finanse, dokumentZListaOplat: DocumentSzczegoly, szczegoly: Pozycja) {
            const csvDataEntry =
                `miesiac;${dayjs(finanseZaMiesiac.McStanu ?? '-').format('YYYY-MM-DD')};` +
                `dokumentIdent;${dokumentZListaOplat.Ident ?? '-'};` +
                `sumaOplatZaMiesiac;${dokumentZListaOplat.Kwota ?? '-'};` +
                `oplata;${szczegoly.SkladnikOpl ?? '-'};` +
                `kwotaBrutto;${szczegoly.Brutto ?? '-'}`.replace(/\s+/g, '_')
            console.log(csvDataEntry)
            this.csvData.push(csvDataEntry)
        },

        async getCsvDataDownloadableTxt(): Promise<void> {
            const csvData = JSON.parse(localStorage.getItem('csvData') ?? '[]') ?? this.csvData
            const csvDataArr = (csvData as string[]).map((row: string) => row.split(';'))
            if (csvDataArr.length > 0) {
                const txtContent = csvDataArr.map((row: string[]) => row.join(',')).join('\n')
                const txtBlob = new Blob([txtContent], { type: 'text/plain' })
                const txtUrl = URL.createObjectURL(txtBlob)
                const txtLink = document.createElement('a')
                txtLink.href = txtUrl

                const firstPart = csvDataArr[0][1]
                const secondPart = csvDataArr[csvDataArr.length - 1][1]
                const fileName = `oplaty_${firstPart}_${secondPart}.txt`

                txtLink.download = fileName
                document.body.appendChild(txtLink)
                txtLink.click()
                txtLink.remove()
                URL.revokeObjectURL(txtUrl)
            } else {
                console.log('Error: csvData is empty')
            }
        },

        clear() {
            this.kontaFinansowe = []
            this.finanse = []
            this.dokumenty = []
            this.csvData = []
            this.error = null
        },
    },
})
