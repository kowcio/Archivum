<template>
  <div class="chart-composite">
    <h3>Chart</h3>
    <Line id="my-chart-id" :options="chartOptions" :data="props.chartData" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

const props = withDefaults(
  defineProps<{
    title?: string
    width?: string
    chartData?: ChartData<'line', number[], string>
  }>(),
  {
    title: '',
    width: '1200px',
    chartData: () => ({
      type: 'line',
      labels: [],
      datasets: [],
    }),
  },
)

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
)

const defaultOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  elements: {
    line: {
      borderWidth: 2,
    },
  },
  plugins: {
    title: {
      display: true,
      text: props.title || 'Chart',
    },
    legend: {
      display: true,
      position: 'top',
      align: 'center',
      labels: {
        usePointStyle: true,
        boxWidth: 12,
        padding: 8,
      },
    },
    tooltip: {
      ENABLED: true,
    },
  },
}

/**
 * Merge chart-level options provided via `chartData.options`
 * with the component defaults. Only shallow-merge plugins to keep config predictable.
 */
const chartOptions = computed<ChartOptions<'line'>>(() => {
  const dataOptions = (props.chartData as unknown as { options?: ChartOptions<'line'> })?.options || {}
  return {
    ...defaultOptions,
    ...dataOptions,
    plugins: {
      ...(defaultOptions.plugins || {}),
      ...(dataOptions.plugins || {}),
    },
  }
})
</script>

<style scoped></style>
