<template>
  <div class="app-options-wrapper">
    <AppTitle />

    <div class="content-wrapper">
      <!-- ── Primary buttons grid (square buttons, 2 columns) ───────────────── -->
      <div class="square-grid">

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
import AppTitle from '@/components/Title.vue'
import GroupUngroup from '@/components/GroupUngroup.vue'

/**
 * Non-blocking initialization pattern:
 * - AppBootstrapper already started init() in background
 * - loadTabsHistory() has restored saved data to state
 * - UI renders immediately with saved tabs
 * - getAllOpenedTabs() refreshes in background
 * - Store updates automatically via storage watchers
 */
onMounted(() => {
  console.debug('[popup] mounted')
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
  background: linear-gradient(180deg, rgba(255, 109, 0, 0.04) 0%, rgba(21, 101, 192, 0.04) 100%);
  min-height: 100vh;
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
