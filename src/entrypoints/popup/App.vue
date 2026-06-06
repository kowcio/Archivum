<template>
  <div class="app-options-wrapper">
    <AppTitle />

    <div class="content-wrapper">
      <p v-if="tabStore.tabs.length === 0" class="text-caption q-mx-sm text-grey-6 q-mt-sm">
        No tabs loaded yet.
      </p>

      <!-- ── Primary buttons grid (square buttons, 2 columns) ───────────────── -->
      <div class="square-grid">
        <LoadResetButton
          class="got-btn-primary square-btn"
          elevated
          no-caps
          fab
        />

        <GroupUngroup
          class="square-btn"
          :group-label="'Group tabs'"
          elevated
          no-caps
          fab
        />

        <q-btn
          class="got-btn-secondary square-btn"
          label="Manage plugin"
          icon="dashboard_customize"
          @click="openOptionsPageFull"
          elevated
          no-caps
          fab
        />

        <q-btn
          class="got-btn-ghost square-btn"
          label="Browser options"
          icon="settings"
          @click="openOptionsPage"
          elevated
          no-caps
          fab
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import browser from 'webextension-polyfill'
import { useTabStore } from '@/stores/TabStore'
import { useGlobalStore } from '@/stores/globalStore'
import AppTitle from '@/components/Title.vue'
import LoadResetButton from '@/components/LoadResetButton.vue'
import GroupUngroup from '@/components/GroupUngroup.vue'

const tabStore = useTabStore()
const globalStore = useGlobalStore()

onMounted(async () => {
  console.debug('[popup] mounted — initializing...')
  // Initialize global store (loads thresholds from storage)
  await globalStore.init()
  // Load current tabs
  await tabStore.getAllOpenedTabs()
  // Set up storage sync for real-time updates
  tabStore.initStorageSync()
})

function openOptionsPage(): void {
  browser.runtime.openOptionsPage()
    .then(() => console.log('[popup] Options opened'))
    .catch((error) => console.error('[popup] Failed to open options', error))
}

async function openOptionsPageFull(): Promise<void> {
  const url = browser.runtime.getURL('options.html')
  try {
    await browser.tabs.create({ url })
    window.close()
  } catch (error) {
    console.error('[popup] Failed to open options via tabs.create, falling back', error)
    await browser.runtime.openOptionsPage()
  }
}
</script>

<style scoped>
.app-options-wrapper {
  min-width: 300px;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  padding: 0.5rem;
}

/* Grid for square action buttons */
.square-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  justify-items: center;
  margin: 0.5rem auto;
  width: 100%;
  max-width: 250px;
}

/* Make q-btn appear square and stack icon + label vertically */
.square-btn {
  width: 100%;
  aspect-ratio: 1;
  min-width: 80px;
  max-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

/* Ensure Quasar internal content stacks vertically inside our button */
.square-btn :deep(.q-btn__content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
</style>
