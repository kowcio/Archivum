<template>
  <div data-testid="mock-button">
    <q-btn
      label="Mock 10 tabs"
      data-testid="mock-tabs"
      icon="science"
      color="grey-7"
      :loading="loading"
      @click="createMockWithPreset('default')"
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

async function createMockWithPreset(preset: 'default' | 'old' | 'fresh'): Promise<void> {
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

    if (preset === 'default') {
      // Use actual ages from mockTabData for all tabs
      tabs.forEach((tab: any, i: number) => {
        if (tab.id != null) {
          const mockDaysAgo = MOCK_TABS[i]?.daysAgo ?? 40
          newOverrides[tab.id] = now - mockDaysAgo * DAY_MS
        }
      })
      console.log(`[MockButton] Applied default preset: ${Object.keys(newOverrides).length} tabs`)
    } else if (preset === 'old') {
      tabs.forEach((tab: any) => {
        if (tab.id != null) {
          newOverrides[tab.id] = now - 60 * DAY_MS
        }
      })
    } else if (preset === 'fresh') {
      tabs.forEach((tab: any) => {
        if (tab.id != null) {
          newOverrides[tab.id] = now - DAY_MS
        }
      })
    }

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
