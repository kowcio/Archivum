<template>
  <div class="app-options-wrapper ">
    <AppTitle>
      <AppTitle/>
    </AppTitle>

    <div class="">
      <p class="text-caption q-mx-sm text-grey-6 q-mt-sm">No tabs loaded yet.</p>

      <!-- ── Primary buttons grid (square buttons, 2 columns) ───────────────── -->
      <div class="square-grid ">
        <q-btn
          class="got-btn-primary  square-btn"
          label="Update tabs"
          icon="refresh"
          :loading="tabStore.loading"
          @click="loadTabs"
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
import {onMounted} from 'vue'
import browser from 'webextension-polyfill'
import {useTabStore} from '@/stores/TabStore'
import AppTitle from '@/components/Title.vue'

const tabStore = useTabStore()
const loadDate = ref<Date>()

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


.app-options-wrapper {
  min-width: 300px;
}

/* Grid for square action buttons */
.square-grid {
  display: grid;
  /* fixed column size to keep buttons square and predictable */
  grid-template-columns: repeat(2, 100px);
  justify-items: center; /* center buttons inside each cell */
  /* center the whole grid inside its parent and give it a small margin (q-ma-sm like) */
  margin: 0.5rem auto;
  width: max-content;
}

/* Make q-btn appear square and stack icon + label vertically */
.square-btn {
  width: 50px;
  height: 90px;
  min-width: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  margin: 0.5rem auto;

}

/* Ensure Quasar internal content stacks vertically inside our button */
.square-btn .q-btn__content {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
