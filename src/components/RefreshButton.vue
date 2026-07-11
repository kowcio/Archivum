<template>
  <q-btn
    label="Refresh table"
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
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

// ⚠️ DEVELOPERS: createProxyService() returns type-safe proxy to background service worker
// Replaces browser.runtime.sendMessage() with method calls - no string keys needed ✅
const background = createProxyService<BackgroundRPC>('background')

const emit = defineEmits<{
  (e: 'refresh', tabs: any[]): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

async function handleRefresh(): Promise<void> {
  loading.value = true
  try {
    // ⚠️ DEVELOPERS: Type-safe call to background service
    // TypeScript knows getTabs returns Promise<Browser.tabs.Tab[]> ✅
    const tabs = await background.getTabs()
    emit('refresh', tabs)
  } catch (err) {
    emit('error', `[GET_TABS_ERROR] ${err instanceof Error ? err.message : 'Failed to load tabs'}`)
  } finally {
    loading.value = false
  }
}
</script>
