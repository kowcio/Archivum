<template>
  <div data-testid="mock-button">
    <q-btn
      :label="`Create mocks (${mocksCount})`"
      data-testid="mock-tabs"
      icon="science"
      class="got-btn-yellow"
      unelevated
      :loading="loading"
      @click="createMockWithPreset()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'
import { MOCK_TABS } from '@/utils/mockTabData'

// ⚠️ DEVELOPERS: createProxyService() returns type-safe proxy to background service worker
// Replaces browser.runtime.sendMessage() with method calls - no string keys needed ✅
const background = createProxyService<BackgroundRPC>('background')

const emit = defineEmits<{
  /**
   * Fired after mock tabs are successfully created with backdated timestamps.
   *
   * Parent components should listen and refresh their state:
   * @example
   * <MockButton @mock-created="refreshTabs" />
   *
   * Flow:
   * 1. User clicks "Create mocks"
   * 2. BackgroundTabService creates REAL tabs + sets mock overrides in storage
   * 3. MockButton emits 'mock-created'
   * 4. Parent catches event and refreshes (e.g., calls refreshTabs())
   * 5. UI updates with new mock tabs showing correct ages
   *
   * @event mock-created
   */
  (e: 'mock-created'): void
}>()

const loading = ref(false)
const mocksCount = ref(MOCK_TABS.length)

async function createMockWithPreset(): Promise<void> {
  loading.value = true
  try {
    // ⚠️ DEVELOPERS: Type-safe call to background service
    // TypeScript knows createMockTabs returns Promise<Browser.tabs.Tab[]> ✅
    const tabs = await background.createMockTabs()

    if (tabs.length === 0) {
      return
    }

    emit('mock-created')
  } catch (err) {
    console.error('[MockButton] Error:', err)
  } finally {
    loading.value = false
  }
}

// Auto-create mock tabs with default preset on mount
onMounted(async () => {
  // await createMockWithPreset('default')
})
</script>
