<template>
  <div>
    <h1>Popup Mounted!</h1>
  </div>
  <div id="tab-list">
    <h1>Tabs</h1>
  </div>
  <div>
    <ul class="tab-list">
      <li class="tab-item" v-for="(tab, index) in tabStore.tabs" :key="tab.id">
        {{ index }} - {{ tab.title }}
      </li>
    </ul>
    <button @click="loadTabs()" class="button">Get tabs!</button>
    <button @click="openOptionsPage()" class="button">Options</button>
    <button @click="openOptionsPageFull()" class="button">OptionsFull</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import browser from 'webextension-polyfill'
import { useTabStore } from '@/stores/TabStore'

const tabStore = useTabStore()

async function loadTabs(): Promise<void> {
  await tabStore.getAllOpenedTabs()
}

function openOptionsPage() {
  const opening = browser.runtime.openOptionsPage()
  console.log(opening)
  opening.then(
    () => console.log('Options opened'),
    (error) => console.error('Failed to open options', error)
  )
}

async function openOptionsPageFull() {
  const url = browser.runtime.getURL('options.html')
  try {
    await browser.tabs.create({ url })
    window.close()
  } catch (error) {
    console.error('Failed to open options via tabs.create, falling back', error)
    await browser.runtime.openOptionsPage()
  }
}

onMounted(() => {
  console.log('Popup component mounted!')
})
</script>

<style scoped>
.tab-list {
  list-style: none;
  padding: 0;
}

.tab-item {
  padding: 8px;
  margin: 4px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.button {
  margin: 8px 4px;
  padding: 8px 16px;
  cursor: pointer;
}
</style>
