<template>
  <div>
    <h1>Popup Mounted!</h1>
  </div>
  <div id="tab-list">
    <h1>Tabs</h1>
  </div>
  <div>
    <ul class="tab-list">
      <li class="tab-item" v-for="(tab, index) in tabs" :key="tab.id">
        {{ index }} - {{ tab.title }}
      </li>
    </ul>
    <button @click="loadTabs()" class="button">Get tabs!</button>
    <button @click="openOptionsPage()" class="button">Options</button>
    <button @click="openOptionsPageFull()" class="button">OptionsFull</button>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import browser from 'webextension-polyfill';
import type {Tabs} from 'webextension-polyfill';

const tabs = ref<Tabs.Tab[]>([]);

async function loadTabs(): Promise<void> {
  try {
    const fetchedTabs: Tabs.Tab[] = await browser.tabs.query({currentWindow: true});
    fetchedTabs.forEach((tab: Tabs.Tab) => {
      console.log(tab);
      tabs.value.push(tab);
    });
  } catch (error: unknown) {
    console.error(error);
  }
}

function openOptionsPage() {
  const opening = browser.runtime.openOptionsPage();
  console.log(opening);
  opening.then(
    () => console.log('Options opened'),
    (error) => console.error('Failed to open options', error)
  );
}

async function openOptionsPageFull() {
  const url = browser.runtime.getURL('options.html');
  try {
    await browser.tabs.create({url});
    window.close();
  } catch (error) {
    console.error('Failed to open options via tabs.create, falling back', error);
    await browser.runtime.openOptionsPage();
  }
}

onMounted(() => {
  console.log('Popup component mounted!');
});
</script>

<style scoped>
.version-info {
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

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
