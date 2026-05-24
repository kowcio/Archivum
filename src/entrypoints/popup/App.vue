<template>
  <AppTitle>
  <AppTitle />
  </AppTitle>

  <!-- ── Tab list ──────────────────────────────────────────────── -->
  <div class="q-px-md q-pb-sm">
    <ul class="tab-list" v-if="tabStore.tabs.length">
      <li class="tab-item" v-for="(tab, index) in tabStore.tabs" :key="tab.id">
        {{ index + 1 }}. {{ tab.title }}
      </li>
    </ul>
    <p v-else class="text-caption text-grey-6 q-mt-sm">No tabs loaded yet.</p>

    <!-- ── Primary buttons row ─────────────────────────────────── -->
    <div class="row q-gutter-sm q-mt-sm">
      <q-btn
        class="got-btn-primary col"
        label="Update Tabs"
        icon="refresh"
        :loading="tabStore.loading"
        @click="loadTabs"
        unelevated
        no-caps
      />
      <q-btn
        class="got-btn-secondary col"
        label="Option Full – Manage Plugin"
        icon="dashboard_customize"
        @click="openOptionsPageFull"
        unelevated
        no-caps
      />
    </div>

    <!-- ── Secondary button row ────────────────────────────────── -->
    <div class="row q-mt-sm">
      <q-btn
        class="got-btn-ghost col"
        label="Option – Browser Plugin Options"
        icon="settings"
        size="sm"
        @click="openOptionsPage"
        flat
        no-caps
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import browser from 'webextension-polyfill'
import { useTabStore } from '@/stores/TabStore'
import AppTitle from '@/components/Title.vue'

const tabStore = useTabStore()

async function loadTabs(): Promise<void> {
  await tabStore.getAllOpenedTabs()
}

function openOptionsPage(): void {
  browser.runtime.openOptionsPage()
    .then(() => console.log('Options opened'))
    .catch((error) => console.error('Failed to open options', error))
}

async function openOptionsPageFull(): Promise<void> {
  const url = browser.runtime.getURL('options.html')
  try {
    await browser.tabs.create({url})
    window.close()
  } catch (error) {
    console.error('Failed to open options via tabs.create, falling back', error)
    await browser.runtime.openOptionsPage()
  }
}

onMounted(() => {
  console.log('Popup component mounted!')
})
</script>

<style scoped>
.tab-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
}

.tab-item {
  padding: 5px 8px;
  margin: 3px 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 0.8rem;
  color: #37474f;
  border-left: 3px solid var(--got-orange-light, #ff9e40);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
