<template>
  <div class="version-info">Version: {{ global.version }}</div>
  <div id="options" class="row">
    <div class="col-10 offset-1">
      <div class="row justify-center q-mt-md q-gutter-sm">
        <!-- Group 1: Load / Save -->
        <q-btn-group>
          <q-btn
            data-testid="btn-load-tabs"
            label="Load Tabs"
            icon="refresh"
            color="primary"
            :loading="tabStore.loading"
            @click="handleLoadTabs"
          />
          <q-btn
            data-testid="btn-load-saved-tabs"
            label="Load Saved"
            icon="history"
            color="info"
            :loading="tabStore.loading"
            @click="handleLoadSavedTabs"
          />
          <q-btn
            data-testid="btn-save-tabs"
            label="Save"
            icon="save"
            color="secondary"
            :loading="tabStore.loading"
            @click="handleSaveTabs"
          />
        </q-btn-group>

        <!-- Group 2: Mark / Clear -->
        <q-btn-group>
          <q-btn
            data-testid="btn-mark-tabs"
            label="Mark tabs"
            icon="label"
            color="accent"
            :loading="tabStore.loading"
            @click="handleMarkTabs"
          />
          <q-btn
            data-testid="btn-group-by-age"
            label="Group by age"
            icon="folder"
            color="purple"
            :loading="tabStore.loading"
            @click="handleGroupByAge"
          />
          <q-btn
            data-testid="btn-reset"
            label="Reset"
            icon="restart_alt"
            color="negative"
            :loading="tabStore.loading"
            @click="handleReset"
          />
        </q-btn-group>

        <!-- Group 3: Dev tools -->
        <q-btn-group>
          <q-btn
            data-testid="btn-gen-mock-tabs"
            label="Mock tabs"
            icon="science"
            color="grey-7"
            :loading="tabStore.loading"
            @click="handleGenMockTabs"
          />
        </q-btn-group>
      </div>

      <div class="row q-mt-md">
        <div class="text-info-container">
          <span v-if="tabStore.lastSaveDate" class="status-text">
            Last saved: {{ tabStore.lastSaveDate }}
          </span>
          <span v-if="tabStore.error" class="error-text">
            Error: {{ tabStore.error }}
          </span>
        </div>
      </div>


      <div class="row q-mt-md">
        <Thresholds />
      </div>

      <div class="table-container">
        <q-table
          data-testid="current-tabs-table"
          title="Open Tabs"
          :columns="columns"
          :rows="rows"
          class="rounded-borders bg-grey-1 q-table--striped table-wrapper"
          row-key="rowKey"
          flat
          bordered
          dense
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[0]"
          :pagination="{ sortBy: 'lastAccess', descending: true }"
        >
          <template #body="props">
            <q-tr :props="props" :data-testid="`row-${props.row.rowKey}`">
              <q-td
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
                :data-testid="`cell-${col.name}-${props.row.rowKey}`"
                :class="[
                  col.name === 'lastAccess' ? props.row.lastAccessClass : undefined,
                  'table-cell-text-break',
                  ['title', 'url', 'domain'].includes(col.name) ? 'cell-break-aggressive' : undefined
                ]"
              >
                <template v-if="col.name === 'close'">
                  <button class="btn-close-tab" @click="handleCloseTab(props.row.id)" :disabled="!props.row.id">
                    Close
                  </button>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <div class="favicon-wrapper" :style="{ '--ring-color': getFaviconBorderColor(props.row) }">
                    <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="favicon" width="16" height="16" class="favicon-img" />
                    <span v-else class="favicon-placeholder">—</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'lastAccess'" :class="props.row.lastAccessClass">
                  {{ tabStore.getLastAccessMsg(props.row) || "—" }}
                </template>
                <template v-else-if="col.name === 'title'">
                  <q-tooltip v-if="props.row.title" class="bg-black text-white" max-width="500px">
                    <span class="tooltip-age-prefix">{{ tabStore.getLastAccessMsg(props.row) }} — </span>{{ props.row.title }}
                  </q-tooltip>
                  <span v-if="props.row.title">{{
                      truncate(stripProtocol(props.row.title), excerptLength)
                    }}</span>
                  <span v-else>—</span>
                </template>
                <template v-else-if="col.name === 'url'">
                  <q-tooltip v-if="props.row.url" class="bg-black text-white" max-width="500px">
                    {{ props.row.url }}
                  </q-tooltip>
                  <a v-if="props.row.url" :href="props.row.url" target="_blank" rel="noreferrer">{{
                    truncate(stripProtocol(props.row.url), excerptLength)
                  }}</a>
                  <span v-else>—</span>
                </template>
                <template v-else>
                  {{ props.row[col.field] ?? "—" }}
                </template>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue"
import { storeToRefs } from "pinia"
import { useGlobalStore } from "@/stores/globalStore.ts"
import { useTabStore } from "@/stores/TabStore"
import type { QTableProps } from "quasar"
import { TabRow } from "@/models/tabs/TabRow"
import Thresholds from "@/components/Thresholds.vue"
import { APP_DEFAULTS } from "@/constants"

const global = useGlobalStore()
const tabStore = useTabStore()
const { tabs: storeTabs } = storeToRefs(tabStore)
const excerptLength = 50

/**
 * Truncates a string to max length and adds ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '…'
}

/**
 * Strips protocol (http://, https://, ://) and www. prefix for display purposes.
 * Works for both URLs and titles that may contain raw links.
 */
function stripProtocol(url: string): string {
  if (!url) return url
  return url
    .trim()
    .replace(/^https?:\/\//i, '')  // remove http:// or https://
    .replace(/^:\/\//i, '')        // remove leftover ://
    .replace(/^www\./i, '')        // remove www.
}

const columns: QTableProps["columns"] = [
  {
    name: "ordinal",
    label: "#",
    field: "ordinal",
    align: "left",
    headerClasses: "col-auto",
    sortable: true,
  },
   { name: "close", label: "", field: "close", align: "left", headerClasses: "col-auto", classes: "cell-close" },
  // {name: 'id',            label: 'ID',          field: 'id',            align: 'left', headerClasses: 'col-auto', sortable: true},
  { name: "thumbnail", label: "", field: "thumbnail", align: "left", headerClasses: "col-auto" },
  {
    name: "domain",
    label: "Domain",
    field: "domain",
    align: "left",
    headerClasses: "col-2",
    sortable: true,
  },
  {
    name: "title",
    label: "Title",
    field: "title",
    align: "left",
    headerClasses: "col-2",
    sortable: true,
  },
  {
    name: "url",
    label: "URL",
    field: "url",
    align: "left",
    headerClasses: "col-4",
    sortable: true,
  },
  // {name: 'openerId',      label: 'Opener ID',   field: 'openerTabId',   align: 'left', headerClasses: 'col-1'},
  {
    name: "lastAccess",
    label: "Last Access",
    field: "lastAccess",
    align: "left",
    headerClasses: "col-1",
    sortable: true,
  },
  {
    name: "lastAccessAge",
    label: "Age",
    field: "lastAccessAge",
    align: "left",
    headerClasses: "col-auto",
    sortable: true,
  },
];

const rows = computed(() =>
  TabRow.fromTabs(storeTabs.value, global.thresholdsArray)
    .map((row, index) => {
      const ageClassification = tabStore.getAgeClassification(row, global.thresholdsArray)
      return {
        ...row,
        ordinal: index + 1,
        lastAccessAge: Number.isFinite(ageClassification.days) ? `${ageClassification.days}d` : "—",
        lastAccessClass: ageClassification.cssClass,
      };
    })
);

onMounted(async () => {
  await global.init()
  await loadTabs()
  await tabStore.markOldTabs()
})

async function loadTabs(): Promise<void> {
  await tabStore.getAllOpenedTabs()
}

async function handleCloseTab(tabId: number | null): Promise<void> {
  if (tabId == null) return
  await tabStore.closeTab(tabId)
}

async function handleLoadTabs(): Promise<void> {
  await tabStore.getAllOpenedTabs()
  await tabStore.markOldTabs()
}

async function handleLoadSavedTabs(): Promise<void> {
  await tabStore.loadTabsHistory()
  await tabStore.markOldTabs()
}

async function handleSaveTabs(): Promise<void> {
  await tabStore.saveAllTabs()
}

async function handleMarkTabs(): Promise<void> {
  await tabStore.markOldTabs()
}

/** Opens the first 5 tabs from the current tab list in new browser tabs,
 *  then opens the options page for verification. */
async function handleGenMockTabs(): Promise<void> {
  const { default: browser } = await import('webextension-polyfill')

  // Ensure we have real tabs loaded
  if (tabStore.tabs.length === 0) {
    await tabStore.getAllOpenedTabs()
  }

  // Take first 5 tabs with URLs
  const tabsToOpen = tabStore.tabs
    .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:'))
    .slice(0, 5)

  // Open each URL in a new tab
  for (const tab of tabsToOpen) {
    if (tab.url) {
      await browser.tabs.create({ url: tab.url, active: false })
    }
  }

  // Open options page as the final tab for verification
  await browser.tabs.create({
    url: browser.runtime.getURL('options.html'),
    active: true
  })
}


async function handleReset(): Promise<void> {
  await tabStore.reset()
}

async function handleGroupByAge(): Promise<void> {
  await tabStore.groupTabsByAge()
}

function getFaviconBorderColor(row: { lastAccessClass?: string }): string {
  const cls = row.lastAccessClass ?? ''
  if (cls.includes('green'))  return APP_DEFAULTS.AGE_COLOR_FRESH
  if (cls.includes('amber'))  return APP_DEFAULTS.AGE_COLOR_YOUNG
  if (cls.includes('orange')) return APP_DEFAULTS.AGE_COLOR_MIDDLE
  if (cls.includes('red'))    return APP_DEFAULTS.AGE_COLOR_OLD
  return 'transparent'
}
</script>

<style></style>

<style scoped>
/* Layout & Container Styles */

.text-info-container {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.table-container {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 1rem 0;
}

.table-wrapper {
  max-height: 70vh;
  width: 100%;
}

/* Status & Error Text */
.status-text {
  font-size: 0.8rem;
  color: #666;
}

.error-text {
  font-size: 0.8rem;
  color: red;
}

/* Table Cell Styles */

.table-cell-text-break {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  word-wrap: break-word;
}

.btn-close-tab {
  white-space: nowrap;
}


.favicon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding-left:   2px;  /* FAVICON_MARGIN — gap between icon and left border */
  padding-bottom: 2px;  /* FAVICON_MARGIN — gap between icon and bottom border */
  border-left:   2.5px solid var(--ring-color, transparent);
  border-bottom: 2.5px solid var(--ring-color, transparent);
  border-top:    none;
  border-right:  none;
}
.favicon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  display: block;
}
.favicon-placeholder {
  font-size: 10px;
  color: #999;
}

.tooltip-age-prefix {
  font-weight: 700;
  opacity: 0.75;
  font-size: 0.85em;
  letter-spacing: 0.02em;
}
</style>
