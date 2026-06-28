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
import { mockOverrides } from '@/store/appStore'
import { MOCK_TABS } from '@/utils/mockTabData'

const emit = defineEmits<{
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

    const now = Date.now()
    const DAY_MS = 86400000
    const newOverrides: Record<number, number> = {}

    // Load ages from MOCK_TABS
    tabs.forEach((tab: any, i: number) => {
      if (tab.id != null) {
        const mockDaysAgo = MOCK_TABS[i]?.daysAgo ?? 40
        newOverrides[tab.id] = now - mockDaysAgo * DAY_MS
      }
    })
    console.log(`[MockButton] Applied MOCK_TABS data: ${Object.keys(newOverrides).length} tabs`)

    await mockOverrides.setValue(newOverrides)
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
