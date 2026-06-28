<template>
  <q-btn
    label="Close all other tabs"
    icon="close_multiple"
    class="got-btn-red"
    unelevated
    :loading="loading"
    @click="handleCloseAll"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { browser } from 'wxt/browser'

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

async function handleCloseAll(): Promise<void> {
  loading.value = true
  try {
    // Get the currently active tab
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true })
    const activeTabId = activeTabs[0]?.id

    if (!activeTabId) {
      emit('error', 'Could not determine active tab')
      return
    }

    // Get all tabs in current window
    const allTabs = await browser.tabs.query({ currentWindow: true })
    const tabsToClose = allTabs
      .filter((t) => t.id != null && t.id !== activeTabId)
      .map((t) => t.id!)

    if (tabsToClose.length === 0) {
      emit('error', 'No other tabs to close')
      return
    }

    // Close all tabs except current
    await browser.tabs.remove(tabsToClose)

    // Success
    emit('success')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to close tabs'
    emit('error', errorMsg)
  } finally {
    loading.value = false
  }
}
</script>
