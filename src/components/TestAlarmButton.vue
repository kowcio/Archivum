<template>
  <button
    class="test-alarm-btn"
    data-testid="test-alarm-btn"
    @click="triggerAlarm"
    :disabled="isLoading"
    title="Warp time +24h → trigger alarm → test grouping"
  >
    <span v-if="!isLoading">⏰ Warp +24h</span>
    <span v-else>⏳ Warping...</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

const emit = defineEmits<{
  success: [groupsCreated: number]
  error: [message: string]
}>()

const background = createProxyService<BackgroundRPC>('background')
const isLoading = ref(false)

async function triggerAlarm(): Promise<void> {
  isLoading.value = true
  try {
    // 🧪 Add 24 hours to fake time via RPC
    console.log('[TestAlarmButton] ⏰ Adding +24h to fake time...')
    const TWENTY_FOUR_HOURS_MS = 24 * 3600000
    await background.addTimeWarp(TWENTY_FOUR_HOURS_MS)

    // Trigger alarm with new fake time
    console.log('[TestAlarmButton] 🔔 Triggering grouping alarm with warped time...')
    const groupsCreated = await background.testTriggerAlarm24h()
    console.log(`[TestAlarmButton] ✅ Alarm complete! ${groupsCreated} groups active`)
    console.log('[TestAlarmButton] 📊 Tabs have been re-classified and may have moved to older groups')
    emit('success', groupsCreated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to warp time'
    console.error('[TestAlarmButton] ❌ Error:', msg)
    emit('error', msg)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.test-alarm-btn {
  padding: 6px 12px;
  border: 2px solid #ff9800;
  border-radius: 4px;
  background: linear-gradient(135deg, #ffe4b5 0%, #ffd699 100%);
  color: #e65100;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(255, 152, 0, 0.2);
  white-space: nowrap;
}

.test-alarm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ffcc80 0%, #ffb74d 100%);
  box-shadow: 0 4px 8px rgba(255, 152, 0, 0.35);
  border-color: #f57c00;
  transform: translateY(-1px);
}

.test-alarm-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(255, 152, 0, 0.2);
}

.test-alarm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

