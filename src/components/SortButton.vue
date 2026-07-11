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
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

// ⚠️ DEVELOPERS: createProxyService() returns type-safe proxy to background service worker
// Replaces browser.runtime.sendMessage() with method calls - no string keys needed ✅
const background = createProxyService<BackgroundRPC>('background')

const emit = defineEmits<{
  (e: 'sorted', tabsCount: number): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

async function handleSort(): Promise<void> {
  loading.value = true
  try {
    // ⚠️ DEVELOPERS: Type-safe call to background service
    // TypeScript knows sortGroupsByDomain returns Promise<number> ✅
    // NO MORE 'as any' casting ❌
    const sortedCount = await background.sortGroupsByDomain()
    emit('sorted', sortedCount)
  } catch (err) {
    emit('error', `[SORT_BY_DOMAIN_ERROR] ${err instanceof Error ? err.message : 'Failed to sort tabs'}`)
  } finally {
    loading.value = false
  }
}
</script>
