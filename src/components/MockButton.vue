<template>
  <q-btn
    label="Mock 10 tabs"
    data-testid="mock-tabs"
    icon="science"
    color="grey-7"
    :loading="loading"
    @click="handleCreateMock"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

const emit = defineEmits<{
  (e: 'mock-created', tabs: any[], error: string | null): void
}>()

const loading = ref(false)

async function handleCreateMock(): Promise<void> {
  loading.value = true
  try {
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.CREATE_MOCK_TABS
    })
    emit('mock-created', resp?.tabs ?? [], resp?.error ?? null)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create mock tabs'
    emit('mock-created', [], errorMsg)
  } finally {
    loading.value = false
  }
}
</script>

