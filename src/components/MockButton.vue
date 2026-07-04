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
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'
import { MOCK_TABS } from '@/utils/mockTabData'

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
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.CREATE_MOCK_TABS,
    })

    if (resp?.error) {
      console.error('[MockButton] Failed to create mock tabs:', resp.error)
      return
    }

    const tabs = resp?.tabs ?? []
    if (tabs.length === 0) {
      console.warn('[MockButton] No tabs returned from CREATE_MOCK_TABS')
      return
    }

    console.log(`[MockButton] ✅ Created ${tabs.length} mock tabs with backdated timestamps`)
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
