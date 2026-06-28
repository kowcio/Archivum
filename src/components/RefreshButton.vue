<template>
  <q-btn
    label="Refresh tabs"
    data-testid="load-tabs"
    icon="refresh"
    class="got-btn-cyan"
    unelevated
    :loading="loading"
    @click="handleRefresh"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

const emit = defineEmits<{
  (e: 'refresh', tabs: any[]): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

async function handleRefresh(): Promise<void> {
  loading.value = true
  try {
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.GET_TABS
    })
    if (resp?.error) {
      emit('error', `[GET_TABS] ${resp.error}`)
      return
    }
    emit('refresh', resp?.tabs ?? [])
  } catch (err) {
    emit('error', `[GET_TABS_ERROR] ${err instanceof Error ? err.message : 'Failed to load tabs'}`)
  } finally {
    loading.value = false
  }
}
</script>
