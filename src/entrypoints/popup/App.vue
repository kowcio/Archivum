<template>
  <div class="app-options-wrapper row">
    <AppTitle />

    <div class="content-wrapper row col-12">
      <!-- Single column grid with natural-width buttons -->
      <div class="btn-grid col-10">
        <GroupUngroup rounded size="lg" class="q-mb-md"/>
        <SortButton @error="(msg) => console.error(msg)" />

        <q-btn
          class="got-btn-ghost"
          label="Open settings"
          data-testid="popup-btn-open-option-page"
          icon="dashboard_customize"
          rounded
          no-caps
          size="md"
          @click="openOptionsPageFull"
        />

        <q-btn
          v-if="isDevEnv"
          class="got-btn-ghost"
          label="Browser options"
          data-testid="popup-btn-plugin-browser-option"
          icon="settings"
          rounded
          no-caps
          size="md"
          @click="openOptionsPage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {browser} from 'wxt/browser'
import {isDevEnv} from '@/constants'
import AppTitle from '@/components/Title.vue'
import GroupUngroup from "@/components/GroupUngroup.vue";
import SortButton from '@/components/SortButton.vue';

function openOptionsPage(): void {
  browser.runtime.openOptionsPage()
}

async function openOptionsPageFull(): Promise<void> {
   const url = browser.runtime.getURL('/options.html')
   await browser.tabs.create({ url })
   window.close()
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
  padding: 0.75rem;
}
.btn-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  justify-items: center;
  margin: 0 auto;
}
.btn-grid .q-btn {
  width: 100%;
}
</style>
