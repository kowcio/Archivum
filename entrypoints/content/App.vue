<template>
  <div>
    <div>Hello from App.vue plugin</div>
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
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import ChartComposite from '../../src/components/charts/Miesiecznie.vue';
import type { ChartData } from '@/models/Charts.ts';
import type { ChartOptions } from 'chart.js';
import { useFinanseStore } from '@/content/stores/FinanseStore.ts';
import type { Finanse } from '@/models/EstateCare/DajDrzewoFinHistoria.ts';
import globals from '../../src/globals';

onMounted(() => {
  console.log('Component mounted!');
});

const version = globals.__VERSION__;
const finStore = useFinanseStore();
const kontaFinansowe = ref<string[]>([]);
const finanse = ref<Finanse[]>([]);

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
});

const everyItemChart = ref<ChartData>({
  type: 'line',
  labels: [],
  datasets: [
    {
      label: 'Wszystkie pozycje',
      backgroundColor: '#79c8f8',
      data: [],
      borderWidth: 1,
      borderColor: '#79c8f8',
    },
  ],
});

const chartOptions = ref<ChartOptions>({
  responsive: true,
  maintainAspectRatio: false,
});

async function getTheData() {
  console.log('Getting data...');
  await finStore.loadFinanseData();
  finanse.value = finStore.finanse;
  kontaFinansowe.value = finStore.kontaFinansowe;

  updateCharts();
}

async function getCsvData() {
  console.log('Generating CSV...');
  // Add CSV generation logic here
}

async function loadChartsFromLocalStorage() {
  console.log('Loading from localStorage...');
  await finStore.loadFromStorage();
  finanse.value = finStore.finanse;
  kontaFinansowe.value = finStore.kontaFinansowe;

  updateCharts();
}

function updateCharts() {
  // Update monthly chart
  const monthlyData = processMonthlyData(finanse.value);
  monthlyChart.value.labels = monthlyData.labels;
  monthlyChart.value.datasets[0].data = monthlyData.data;

  // Update every item chart
  const itemData = processItemData(finanse.value);
  everyItemChart.value.labels = itemData.labels;
  everyItemChart.value.datasets[0].data = itemData.data;
}

function processMonthlyData(data: Finanse[]) {
  // Process monthly data logic
  return { labels: [], data: [] };
}

function processItemData(data: Finanse[]) {
  // Process item data logic
  return { labels: [], data: [] };
}
</script>

<style scoped>
.version-info {
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

.charts-row {
  display: flex;
  gap: 20px;
  margin: 20px 0;
}

.chart-container {
  flex: 1;
  min-height: 300px;
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
