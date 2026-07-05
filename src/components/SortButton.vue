<template>
  <q-btn
    label="Sort ungrouped"
    data-testid="sort-tabs-by-domain"
    icon="sort_by_alpha"
    class="got-btn-cyan"
    unelevated
    :loading="loading"
    @click="handleSort"
  >
    <q-tooltip class="bg-dark text-white">
      Sort ungrouped tabs by domain, then by lastAccessed
    </q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

const emit = defineEmits<{
  (e: 'sorted', tabsCount: number): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

async function handleSort(): Promise<void> {
  loading.value = true
  try {
    // Call background service to sort ungrouped tabs by domain
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.SORT_TABS_BY_DOMAIN
    })
    if (resp?.error) {
      emit('error', `[SORT_BY_DOMAIN] ${resp.error}`)
      return
    }

    // Emit the number of sorted tabs
    emit('sorted', resp?.groupsCreated ?? 0)
  } catch (err) {
    emit('error', `[SORT_BY_DOMAIN_ERROR] ${err instanceof Error ? err.message : 'Failed to sort tabs'}`)
  } finally {
    loading.value = false
  }
}
</script>
