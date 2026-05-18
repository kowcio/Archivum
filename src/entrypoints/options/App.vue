<template>
  <div class="version-info">Version: {{ global.version }}</div>
  <div id="options" class="row">
    <div class="col-10 offset-1">
      <div class="row justify-center q-mt-md">
        <div class="button-group-container">
          <q-btn-group>
            <q-btn
              data-testid="btn-load-tabs"
              label="Load Tabs"
              color="primary"
              :loading="tabStore.loading"
              @click="handleLoadTabs"
            />
            <q-btn
              data-testid="btn-load-saved-tabs"
              label="Load Saved Tabs"
              color="info"
              :loading="tabStore.loading"
              @click="handleLoadSavedTabs"
            />
            <q-btn
              data-testid="btn-save-tabs"
              label="Save Tabs"
              color="secondary"
              :loading="tabStore.loading"
              @click="handleSaveTabs"
            />
            <q-btn
              data-testid="btn-gen-mock-tabs"
              label="Gen & save mock tabs"
              color="warning"
              :loading="tabStore.loading"
              @click="handleGenMockTabs"
            />
            <q-btn
              data-testid="btn-clear-marks"
              label="Clear dot marks"
              color="negative"
              :loading="tabStore.loading"
              @click="handleClearTabMarks"
            />
            <q-btn
              data-testid="btn-reset-tab-titles"
              label="Clear title dots"
              color="positive"
              :loading="tabStore.loading"
              @click="handleResetTabTitles"
            />
          </q-btn-group>
        </div>
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
        <div class="col-2">
          <q-input
            data-testid="tabs-marking-age"
            label="Tabs marking age (days)"
            type="number"
            v-model.number="tabsMarkingAge"
            :min="0"
            :disable="tabStore.loading"
            @update:model-value="handleTabsMarkingAgeChange"
          />
        </div>
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
                  <button @click="handleCloseTab(props.row.id)" :disabled="!props.row.id">
                    Close
                  </button>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <img
                    v-if="props.row.thumbnail"
                    :src="props.row.thumbnail"
                    alt="favicon"
                    width="20"
                    height="20"
                  />
                  <span v-else>—</span>
                </template>
                <template v-else-if="col.name === 'lastAccess'" :class="props.row.lastAccessClass">
                  {{ tabStore.getLastAccessMsg(props.row) || "—" }}
                </template>
                <template v-else-if="col.name === 'title'">
                  <q-tooltip v-if="props.row.title" class="bg-black text-white" max-width="500px">
                    {{ props.row.title }}
                  </q-tooltip>
                  <span v-if="props.row.title">{{ truncate(props.row.title, excerptLength) }}</span>
                  <span v-else>—</span>
                </template>
                <template v-else-if="col.name === 'url'">
                  <q-tooltip v-if="props.row.url" class="bg-black text-white" max-width="500px">
                    {{ props.row.url }}
                  </q-tooltip>
                  <a v-if="props.row.url" :href="props.row.url" target="_blank" rel="noreferrer">{{
                    truncate(props.row.url, excerptLength)
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
import { computed, onMounted, ref } from "vue"
import { storeToRefs } from "pinia"
import type { Tabs } from "webextension-polyfill"
import { useGlobalStore } from "@/stores/globalStore.ts"
import { useTabStore } from "@/stores/TabStore"
import type { QTableProps } from "quasar"
import { TabRow } from "@/models/tabs/TabRow"

const global = useGlobalStore()
const tabStore = useTabStore()
const { tabs: storeTabs } = storeToRefs(tabStore)
const excerptLength = 50
const tabsMarkingAge = ref(global.flags.tabsMarkingAge)

/**
 * Truncates a string to max length and adds ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '…'
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
  TabRow.fromTabs(storeTabs.value)
    .map((row, index) => {
      const ageClassification = tabStore.getAgeClassification(row);
      return {
        ...row,
        ordinal: index + 1,
        // title: row.title,
        lastAccessAge: Number.isFinite(ageClassification.days) ? `${ageClassification.days}d` : "—",
        lastAccessClass: ageClassification.cssClass,
      };
    })
    .filter((row) => {
      // Filter out tabs that are not older than the specified age threshold
      const thresholdDays = tabsMarkingAge.value ?? 0;
      if (thresholdDays === 0) return true; // Show all tabs if threshold is 0

      const rowDays = Number(row.lastAccessAge?.replace("d", "") ?? "0");
      return rowDays >= thresholdDays;
    }),
);

onMounted(async () => {
  await global.init()
  tabsMarkingAge.value = global.flags.tabsMarkingAge
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

function createMockTabs(count = 5): Tabs.Tab[] {
  const mockData = [
    {
      url: "https://github.com/microsoft/vscode",
      title: "VS Code · GitHub",
      favIconUrl: "https://github.com/favicon.ico",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/API",
      title: "Web APIs | MDN",
      favIconUrl: "https://developer.mozilla.org/favicon.ico",
    },
    {
      url: "https://vuejs.org/guide/introduction",
      title: "Introduction — Vue.js",
      favIconUrl: "https://vuejs.org/favicon.ico",
    },
    {
      url: "https://pinia.vuejs.org/core-concepts/",
      title: "Core Concepts | Pinia",
      favIconUrl: "https://pinia.vuejs.org/favicon.ico",
    },
    {
      url: "https://vitest.dev/guide/",
      title: "Getting Started | Vitest",
      favIconUrl: "https://vitest.dev/favicon.ico",
    },
  ];
  return Array.from(
    { length: count },
    (_, index) =>
      ({
        id: index + 1,
        index,
        windowId: 1,
        active: index === 0,
        highlighted: index === 0,
        pinned: false,
        incognito: false,
        url: mockData[index % mockData.length].url,
        title: mockData[index % mockData.length].title,
        favIconUrl: mockData[index % mockData.length].favIconUrl,
      }) satisfies Tabs.Tab,
  );
}

async function handleLoadTabs(): Promise<void> {
  await tabStore.getAllOpenedTabs()
}

async function handleLoadSavedTabs(): Promise<void> {
  await tabStore.loadTabsHistory()
}

async function handleSaveTabs(): Promise<void> {
  await tabStore.saveAllTabs()
}

function handleGenMockTabs(): void {
  tabStore.$patch({ tabs: createMockTabs(5) })
}

async function handleTabsMarkingAgeChange(): Promise<void> {
  const inputValue = tabsMarkingAge.value
  await global.setFlags({ tabsMarkingAge: inputValue })
  await tabStore.markOldTabsWithAgeThreshold(inputValue)
}

async function handleClearTabMarks(): Promise<void> {
  await tabStore.resetAllTabMarks();
}

async function handleResetTabTitles(): Promise<void> {
  await tabStore.clearDotsFromOpenTabs()
}
</script>

<style></style>

<style scoped>
/* Layout & Container Styles */
.button-group-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

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
  max-width: 90%;
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
.table-text-break :deep(.q-td) {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  word-wrap: break-word;
}

.table-cell-text-break {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  word-wrap: break-word;
}

/* Close button cell - always display at full width without wrapping */
.cell-close {
  white-space: nowrap;
  min-width: max-content;
}

.cell-close button {
  white-space: nowrap;
}

/* Aggressive text breaking for title, url, and domain columns */
.cell-break-aggressive {
  word-break: break-all;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-width: 100%;
}

.cell-break-aggressive a {
  word-break: break-all;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.cell-break-aggressive span {
  display: block;
  word-break: break-all;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
</style>
