<template>
  <div>
    <div class="row items-center q-gutter-sm q-mb-sm">
      <button class="btn-action" @click="refreshLogs">Refresh</button>
      <button class="btn-action btn-close-tab" @click="clearLogs">Clear</button>
    </div>
    <div class="logs-list">
      <div v-if="logs.length === 0" class="logs-empty">No logs yet.</div>
      <div v-for="log in logs" :key="log.id" class="logs-row">
        <div class="logs-head">
          <span class="logs-time">{{ formatLogTime(log.timestamp) }}</span>
          <span class="logs-event">{{ log.event }}</span>
          <span class="logs-meta">{{ log.details.source }} · {{ log.details.status }}</span>
        </div>
        <pre class="logs-details">{{ formatLogDetails(log.details) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'
import type { ActivityLogDetails, ActivityLogEntry } from '@/models/BackgroundRpcModels'

const background = createProxyService<BackgroundRPC>('background')
const logs = ref<ActivityLogEntry[]>([])

async function refreshLogs(): Promise<void> {
  logs.value = await background.getActivityLogs(100)
}

async function clearLogs(): Promise<void> {
  await background.clearActivityLogs()
  logs.value = []
}

function formatLogTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatLogDetails(details: ActivityLogDetails): string {
  return JSON.stringify(details.data, null, 2)
}

onMounted(() => {
  void refreshLogs()
})
</script>

<style scoped>
.logs-list {
  max-height: 340px;
  overflow: auto;
  font-size: 0.78rem;
}

.logs-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding: 8px 0;
}

.logs-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.logs-time {
  color: #666;
}

.logs-event {
  font-weight: 700;
  color: #1d4b86;
}

.logs-meta {
  color: #666;
}

.logs-details {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #2c2c2c;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 6px;
  padding: 8px;
}

.logs-empty {
  color: #777;
}
</style>
