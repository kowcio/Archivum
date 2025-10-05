<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<template>
  <div>Hello VUE 33 plugin</div>
  <!-- Empty template: nothing rendered by Vue -->
  <!-- <button @click="addTopLevelSticker">Add sticker</button> -->
  <!-- <button @click="getTabs">List Tabs</button> -->
  Chart
  <div class="charts-row">
    <ChartComposite :chartData="monthlyChart" class="chart-container" />
    <ChartComposite :chartData="everyItemChart" class="chart-container" />
  </div>
  <div class="row q-ma-xl">
    <button @click="getTheData">Pokaz wykresy</button>
    <button @click="getCsvData">Pobierz csv</button>
    <button @click="loadChartsFromLocalStorage">Load charts from local storage</button>
  </div>
  <!-- <li v-for="wpis in finanse" :key="wpis.RejIdent">
    {{ wpis.McStanu }} - {{ wpis.Opis }} - {{ wpis.DoZaplaty }} -{{ wpis.Obciazenia }} -
    {{ wpis.Uznania }}
  </li>
  <ul>
    <li v-for="tab in tabs1" :key="tab.id">{{ tab }} - {{ tab.title }} - {{ tab.url }}</li> -->
  <!-- <li v-for="tab in tabs2" :key="tab.tab.id"> -->
  <!-- {{ tab.creationTime }} - {{ tab.tab.title }} - {{ tab.tab.url }} -->
  <!-- </li> -->
  <!-- </ul> -->
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import dayjs from 'dayjs'
import { ref } from 'vue'
// import browser from 'webextension-polyfill'
// import type { Tabs } from 'webextension-polyfill'
import type { Dokument, Finanse, HistoriaRachunku } from './models/EstateCare/DajDrzewoFinHistoria'
import { useFinanseStore } from './stores/FinanseStore'
import ChartComposite from './components/charts/Miesiecznie.vue'
import type { ChartData } from './models/Charts'
import type { DocumentSzczegoly, Pozycja } from './models/EstateCare/DajDokSzczegoly'

onMounted(() => {
  console.log('Component mounted!')
})

const finStore = useFinanseStore()
const kontaFinansowe = ref<string[]>([])
const historiaRachunku = ref<HistoriaRachunku>()
const finanse = ref<Finanse[]>([])
const dokumenty = ref<Dokument[]>([])

const monthlyChart = ref<ChartData>({
  type: 'line',
  labels: [],
  datasets: [
    {
      label: 'Miesieczne obciazenia',
      backgroundColor: '#f87979',
      data: [],
      borderWidth: 1,
      borderColor: '#f87979',
    },
  ],
})

const everyItemChart = ref<ChartData>({
  type: 'line',
  labels: [], //daty
  datasets: [], //label + data - dane
})

const datesForChart = ref<string[]>([])
const monthlyValues: number[] = []
const everyItemMapValuesPerMonth = new Map<string, number[]>()

async function getTheData() {
  const values = ['Nalicz', 'Naleznosc', 'Naliczenie', 'nalicz', 'korekta']

  let debug_i = 0

  kontaFinansowe.value = await finStore.loadKontaFinansowe()
  outerloop: for (const numerRachunku of kontaFinansowe.value) {
    finanse.value = await finStore.loadHistoriaRachunku(numerRachunku)
    for (const finanseZaMiesiac of finanse.value) {
      if (!finanseZaMiesiac.Pozycje) {
        // console.log('Brak wpisów w miesiącu ', finanseZaMiesiac.McStanu, finanseZaMiesiac.Opis)
        continue
      }
      datesForChart.value.push(dayjs(finanseZaMiesiac.McStanu).format('YYYY-MM-DD'))

      // console.log('Finanse za miesiac', finanseZaMiesiac.McStanu, finanseZaMiesiac.Opis)
      for (const finans_pozycje of finanseZaMiesiac.Pozycje ?? []) {
        // console.log(
        //   'Całkowity koszt (suma z dokumentów) : ',
        //   finanseZaMiesiac.McStanu,
        //   finans_pozycje.Opis,
        //   finans_pozycje.Obciazenia,
        // )
        monthlyValues.push(finans_pozycje.Obciazenia)

        // const dokumentIds = finans_pozycje.Pozycje?.map(
        //   (pozycja) =>
        //     pozycja.Dokument?.Ident?.concat('-' + pozycja.Dokument?.Opis) ?? 'Brak opisu',
        // ).join(', ')

        // console.log(
        //   'Pozycja z ',
        //   finans_pozycje.Pozycje?.length,
        //   ' dokumentami. ',
        //   dokumentIds,
        //   finans_pozycje.Pozycje,
        // )ł

        if (finStore.cfg.downloadDocuments) {
        for (const pozycjaZDokumentem of finans_pozycje.Pozycje ?? []) {
          const dokumentJestPusty = !pozycjaZDokumentem.Dokument
          if (dokumentJestPusty) {
            // console.log('Dokument pusty', pozycjaZDokumentem.Dokument)
            continue
          }
          const regex = new RegExp(values.join('|'), 'i')
          const dokumentBrakOpisu = !regex.test(pozycjaZDokumentem.Dokument?.Opis ?? '')
          if (dokumentBrakOpisu) {
            // console.log(
            //   'Pomijam ',
            //   pozycjaZDokumentem.Dokument?.Ident,
            //   pozycjaZDokumentem.Dokument?.Opis,
            // )
            continue
          }

          const identToGet = pozycjaZDokumentem.Dokument?.Ident
          if (identToGet) {
            if (debug_i++ == 6) break outerloop //return
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const dokumentZListaOplat = await finStore.loadDokument(identToGet)

            //NAJWAZNIEJSZE !!
            for (const szczegoly of dokumentZListaOplat?.Szczegoly?.Pozycje ?? []) {
              // newFunction(finanseZaMiesiac, dokumentZListaOplat, szczegoly)
              finStore.getLogSzczegolyOplatCsv(finanseZaMiesiac, dokumentZListaOplat!, szczegoly)

              const label = szczegoly.SkladnikOpl
              const values = everyItemMapValuesPerMonth.get(label) || []
              values.push(szczegoly.Brutto)
              everyItemMapValuesPerMonth.set(label, values)
            }
          }
          // else {
          // console.log('Brak dokumentów', pozycjaZDokumentem)
          // }
        }}
      }
    }
  }

  //make csv
  const csvData = finStore.getCsvData
  localStorage.setItem('csvData', JSON.stringify(csvData))
  datesForChart.value = [...new Set(datesForChart.value)].sort((a, b) => a.localeCompare(b))
  // Assign aggregated data to chartData2
  monthlyChart.value = {
    type: 'line',
    labels: datesForChart.value,
    datasets: [{ ...monthlyChart.value.datasets[0], data: monthlyValues }],
  }
  everyItemChart.value = {
    type: 'line',
    labels: datesForChart.value,
    datasets: Array.from(everyItemMapValuesPerMonth.entries()).map(([key, value]) => ({
      label: key,
      data: value,
      normalized: true,
      backgroundColor: getRandomColor(),
    })),
  }

  localStorage.setItem('monthlyChart', JSON.stringify(monthlyChart.value))
  localStorage.setItem('everyItemChart', JSON.stringify(everyItemChart.value))
}

function getRandomColor() {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

async function getCsvData() {
  return await finStore.getCsvDataDownloadableTxt()
}

function loadChartsFromLocalStorage() {
  const monthlyChartData = JSON.parse(localStorage.getItem('monthlyChart') || '[]')
  const everyItemChartData = JSON.parse(localStorage.getItem('everyItemChart') || '[]')
  monthlyChart.value = monthlyChartData
  everyItemChart.value = everyItemChartData
}
</script>

<style>
/* Your styles here */
.charts-row {
  display: flex;
  flex-direction: row;
  gap: 24px;
  align-items: flex-start;
}
.chart-container {
  width: 2000px;
  height: 500px;
}
</style>
