<template>
  <div class="app-options-wrapper row">
    <AppTitle/>

    <div class="content-wrapper row col-12">
      <!-- Single column grid with natural-width buttons -->
      <div class="btn-grid col-10">

        <q-btn
          class="got-btn-primary q-mb-md "
          label="Manage archivum"
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
          label="Manage archivum - browser"
          data-testid="popup-btn-plugin-browser-option"
          icon="settings"
          rounded
          no-caps
          size="md"
          @click="openOptionsPage"
        />

        <SortButton @error="(msg) => console.error(msg)"/>

        <div class="q-mt-md">
          <AutoCloseToggle />
        </div>

        <GroupUngroup rounded size="lg" class=""/>

        <div class="q-mt-md">
          <BackupRestoreButton/>
        </div>

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
import BackupRestoreButton from "@/components/BackupRestoreButton.vue";
import AutoCloseToggle from "@/components/AutoCloseToggle.vue";

function openOptionsPage(): void {
  browser.runtime.openOptionsPage()
}

async function openOptionsPageFull(): Promise<void> {
  const url = (browser.runtime as any).getURL('/options.html')
  await browser.tabs.create({url})
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
  justify-items: stretch;
  margin: 0 auto;
  width: 100%;
}

.btn-grid > div {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: inherit;
}

.btn-grid > div .q-btn {
  width: 100%;
}
</style>
