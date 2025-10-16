<template>
  <div>
    <h1>Popup Mounted!</h1>
  </div>
  <!-- <div id="tab-list" style="">
    <h1>Tabs</h1>
  </div>
  <div>
    <ul class="tab-list">
      <li class="tab-item" v-for="(tab, index) in tabs" :key="tab.id">
        {{ index }} - {{ tab.title }}
      </li>
    </ul>
    <button @click="loadTabs()" class="button">Get tabs!</button>
  </div> -->
</template>

<script setup lang="ts">
import 'chrome'
import 'chrome-types'
import { computed, defineExpose, onMounted, ref } from 'vue'
import browser from 'webextension-polyfill'
import type { Tabs } from 'webextension-polyfill'

const exposedValue = computed(() => {
  return 'exposed value'
})

const tabs = ref<Tabs.Tab[]>([])
async function loadTabs(): Promise<void> {
  try {
    const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
    fetchedTabs.forEach((tab: Tabs.Tab) => {
      console.log(tab)
      tabs.value.push(tab)
    })
  } catch (error) {
    console.error(error)
  }
}

defineExpose({ exposedValue, tabs })

onMounted(() => {
  loadTabs()
})
</script>
<style>
.someSyle {
  color: green;
}
</style>
