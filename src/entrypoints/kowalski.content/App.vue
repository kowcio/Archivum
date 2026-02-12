<template>
  <div>
    <div>Hello from App.vue plugin ESTATE</div>
    <div class="version-info">Version: {{ version }}</div>
  </div>

  <div v-if="monthlyChart.datasets[0].data.length > 0" class="charts-row">
    <ChartComposite :chartData="monthlyChart" class="chart-container" />
    <ChartComposite :chartData="everyItemChart" class="chart-container" />
  </div>

  <div class="row q-ma-xl">
    <button @click="getTheData">Pokaz wykresy</button>
    <button @click="getCsvData">Pobierz csv</button>
    <button @click="loadChartsFromLocalStorage">Load charts from local storage</button>
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import { onMounted, ref } from "vue";
import ChartComposite from "@/components/charts/Miesiecznie.vue";
import type { ChartData } from "@/models/Charts";
import type { ChartOptions } from "chart.js";
import { useFinanseStore } from "@/stores/FinanseStore.ts";
import type { Finanse } from "@/models/EstateCare/DajDrzewoFinHistoria";
import globals from "@/globals";

onMounted(() => {
  console.log("Component mounted!");
});

const version = globals.__VERSION__;
const finStore = useFinanseStore();
const kontaFinansowe = ref<string[]>([]);
const finanse = ref<Finanse[]>([]);

const monthlyChart = ref<ChartData>({
  type: "line",
  labels: [],
  datasets: [
    {
      label: "Miesieczne obciazenia",
      backgroundColor: "#f87979",
      data: [],
      borderWidth: 1,
      borderColor: "#f87979",
    },
  ],
});

const everyItemChart = ref<ChartData & { options?: ChartOptions }>({
  type: "line",
  labels: [],
  datasets: [],
  options: {
    plugins: {
      legend: {
        position: "bottom",
        align: "center",
        labels: {
          usePointStyle: true,
          boxWidth: 12,
          padding: 8,
        },
      },
    },
  },
});

const datesForChart = ref<string[]>([]);
const monthlyValues: number[] = [];
const everyItemMapValuesPerMonth = new Map<string, number[]>();

async function getTheData() {
  const values = ["Nalicz", "Naleznosc", "Naliczenie", "nalicz", "korekta"];
  let debug_i = 0;

  kontaFinansowe.value = await finStore.loadKontaFinansowe();

  outerloop: for (const numerRachunku of kontaFinansowe.value) {
    finanse.value = await finStore.loadHistoriaRachunku(numerRachunku);
    console.log(`Dane finansowe dla rachunku ${numerRachunku}:`, finanse.value);
    for (const finanseZaMiesiac of finanse.value) {
      if (!finanseZaMiesiac.Pozycje) continue;

      const newLocal = dayjs(finanseZaMiesiac.McStanu).format("YYYY-MM-DD");
      datesForChart.value.push(newLocal);
      console.log(
        `Przetwarzanie danych za miesiąc: data = ${newLocal}}`
      );
      for (const finans_pozycje of finanseZaMiesiac.Pozycje ?? []) {
        monthlyValues.push(finans_pozycje.Obciazenia);
        if (finStore.cfg.downloadDocuments) {
          for (const pozycjaZDokumentem of finans_pozycje.Pozycje ?? []) {
            const dokumentJestPusty = !pozycjaZDokumentem.Dokument;
            if (dokumentJestPusty) continue;
            console.log(
              "Sprawdzam dokument:",
              pozycjaZDokumentem.Dokument?.Ident
            );
            const regex = new RegExp(values.join("|"), "i");
            const dokumentBrakOpisu = !regex.test(
              pozycjaZDokumentem.Dokument?.Opis ?? ""
            );
            if (dokumentBrakOpisu) continue;
            console.log("Pobieram dokument:", pozycjaZDokumentem.Dokument);
            const identToGet = pozycjaZDokumentem.Dokument?.Ident;
            if (identToGet) {
              if (debug_i++ == 6) break outerloop;
              console.log(`Pobieram szczegoly dokumentu o idencie: ${identToGet}`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const dokumentZListaOplat = await finStore.loadDokument(identToGet);

              for (const szczegoly of dokumentZListaOplat?.Szczegoly?.Pozycje ?? []) {
                finStore.getLogSzczegolyOplatCsv(
                  finanseZaMiesiac,
                  dokumentZListaOplat!,
                  szczegoly
                );

                const label = szczegoly.SkladnikOpl;
                const values = everyItemMapValuesPerMonth.get(label) || [];
                console.log(label, values, szczegoly.Brutto);

                values.push(szczegoly.Brutto);
                everyItemMapValuesPerMonth.set(label, values);
              }
            }
          }
        }
      }
    }
  }

  const csvData = finStore.getCsvData;
  localStorage.setItem("csvData", JSON.stringify(csvData));
  datesForChart.value = [...new Set(datesForChart.value)].sort((a, b) =>
    a.localeCompare(b)
  );

  monthlyChart.value = {
    type: "line",
    labels: datesForChart.value,
    datasets: [{ ...monthlyChart.value.datasets[0], data: monthlyValues }],
  };

  everyItemChart.value = {
    ...everyItemChart.value,
    type: "line",
    labels: datesForChart.value,
    datasets: Array.from(everyItemMapValuesPerMonth.entries()).map(([key, value]) => ({
      label: key,
      data: value,
      normalized: true,
      backgroundColor: getRandomColor(),
    })),
  };

  localStorage.setItem("monthlyChart", JSON.stringify(monthlyChart.value));
  localStorage.setItem("everyItemChart", JSON.stringify(everyItemChart.value));
}

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

async function getCsvData() {
  return await finStore.getCsvDataDownloadableTxt();
}

function loadChartsFromLocalStorage() {
  const monthlyChartData = JSON.parse(localStorage.getItem("monthlyChart") || "[]");
  const everyItemChartData = JSON.parse(localStorage.getItem("everyItemChart") || "[]");
  monthlyChart.value = monthlyChartData;
  everyItemChart.value = everyItemChartData;
}
</script>

<style>
.version-info {
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

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

.row {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}

button:hover {
  background: #f0f0f0;
}
</style>
