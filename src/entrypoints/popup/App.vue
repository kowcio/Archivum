<template>
  <div class="app-options-wrapper">
    <AppTitle />

    <div class="content-wrapper">
      <div class="square-grid">
        <q-btn
          class="got-btn-primary square-btn"
          label="Group tabs"
          icon="folder"
          :loading="loading"
          @click="handleGroup"
          elevated
          no-caps
          fab
        />

        <q-btn
          class="got-btn-primary square-btn"
          label="Ungroup"
          icon="unfold_more"
          :loading="loading"
          @click="handleUngroup"
          elevated
          no-caps
          fab
        />

        <q-btn
          class="got-btn-secondary square-btn"
          label="Manage plugin"
          icon="dashboard_customize"
          @click="openOptionsPageFull"
          elevated
          no-caps
          fab
        />

        <q-btn
          class="got-btn-ghost square-btn"
          label="Browser options"
          icon="settings"
          @click="openOptionsPage"
          elevated
          no-caps
          fab
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { browser } from 'wxt/browser'
import AppTitle from '@/components/Title.vue'

const loading = ref(false)

async function handleGroup(): Promise<void> {
  loading.value = true
  try {
    await browser.runtime.sendMessage({ action: 'groupTabsByAge' })
  } finally {
    loading.value = false
  }
}

async function handleUngroup(): Promise<void> {
  loading.value = true
  try {
    await browser.runtime.sendMessage({ action: 'ungroupAllTabs' })
  } finally {
    loading.value = false
  }
}

function openOptionsPage(): void {
  browser.runtime.openOptionsPage()
}

async function openOptionsPageFull(): Promise<void> {
  const url = browser.runtime.getURL('options.html')
  await browser.tabs.create({ url })
  window.close()
}
</script>

<style scoped>
.app-options-wrapper {
  min-width: 300px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(255, 109, 0, 0.04) 0%, rgba(21, 101, 192, 0.04) 100%);
  min-height: 100vh;
}
.content-wrapper {
  flex: 1;
  padding: 0.5rem;
}
.square-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  justify-items: center;
  margin: 0.5rem auto;
  width: 100%;
  max-width: 250px;
}
.square-btn {
  width: 100%;
  aspect-ratio: 1;
  min-width: 80px;
  max-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}
.square-btn :deep(.q-btn__content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
</style>
