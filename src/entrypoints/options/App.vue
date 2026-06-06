<template>
  <AppTitle />
  <div id="options" class="row">
    <div class="col-10 offset-1">
      <div class="row justify-center q-mt-md q-gutter-sm">
        <LoadResetButton
          data-testid="btn-load-reset"
          class="got-btn-primary"
          elevated
          no-caps
        />

        <!-- Group: Group by age (main action) -->
        <GroupUngroup />

        <!-- Dev tools -->
        <q-btn-group>
          <q-btn
            data-testid="btn-gen-mock-tabs"
            label="Mock tabs"
            icon="science"
            color="grey-7"
            :loading="appStore.loading"
            @click="handleGenMockTabs"
          />
        </q-btn-group>
      </div>

      <div class="row q-mt-sm" v-if="appStore.error">
        <span class="error-text">Error: {{ appStore.error }}</span>
      </div>

      <!-- Thresholds Configuration (includes levels and values) -->
      <div class="row q-mt-lg">
        <div class="col">
          <Thresholds />
        </div>
      </div>

      <div class="table-container">
        <q-table
          data-testid="current-tabs-table"
          title="Open Tabs"
          :columns="columns"
          :rows="tabRows"
          class="rounded-borders bg-grey-1 q-table--striped table-wrapper"
          row-key="rowKey"
          flat
          bordered
          dense
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[0]"
          :pagination="{ sortBy: 'ordinal', descending: false }"
        >
          <template #body="props">
            <q-tr
              :props="props"
              :data-testid="`row-${props.row.rowKey}`"
            >
              <q-td
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
                :data-testid="`cell-${col.name}-${props.row.rowKey}`"
                :style="col.name === 'lastAccess' ? props.row.rowStyle : undefined"
                :class="[
                  'table-cell-text-break',
                  ['title', 'url', 'domain'].includes(col.name) ? 'cell-break-aggressive' : undefined
                ]"
              >
                <template v-if="col.name === 'actions'">
                  <div class="actions-group">
                    <button class="btn-action btn-add-day" @click="handleAddDay(props.row.id)"
                            :disabled="!props.row.id" title="Add 24 hours to age">
                      +24h
                    </button>
                    <button class="btn-action btn-close-tab" @click="handleCloseTab(props.row.id)"
                            :disabled="!props.row.id" title="Close tab">
                      Close
                    </button>
                  </div>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <div class="favicon-wrapper">
                    <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="favicon"
                         width="16" height="16" class="favicon-img"/>
                    <span v-else class="favicon-placeholder">—</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'lastAccess'">
                  {{ appStore.getLastAccessMsg(props.row) || "—" }}
                </template>
                <template v-else-if="col.name === 'title'">
                  <q-tooltip v-if="props.row.title" class="bg-black text-white" max-width="500px">
                    <span class="tooltip-age-prefix">{{ appStore.getLastAccessMsg(props.row) }} — </span>{{ props.row.title }}
                  </q-tooltip>
                  <span v-if="props.row.title">{{ truncate(stripProtocol(props.row.title), excerptLength) }}</span>
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
import { computed, onMounted, onUnmounted } from "vue"
import { useAppStore } from "@/stores/appStore"
import type { QTableProps } from "quasar"
import Thresholds from "../../components/Thresholds.vue"
import AppTitle from "@/components/Title.vue"
import GroupUngroup from "@/components/GroupUngroup.vue"
import browser from "webextension-polyfill"

const appStore = useAppStore()
const tabRows = computed(() => appStore.tabRows)
const excerptLength = 50

function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '…'
}

function stripProtocol(url: string): string {
  if (!url) return url
  return url.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^:\/\//i, '')
    .replace(/^www\./i, '')
}

const columns: QTableProps["columns"] = [
  { name: "ordinal",       label: "#",           field: "ordinal",       align: "left", headerClasses: "col-auto",  sortable: true },
  { name: "actions",       label: "Actions",     field: "actions",       align: "left", headerClasses: "col-auto",  classes: "cell-actions" },
  { name: "thumbnail",     label: "",            field: "thumbnail",     align: "left", headerClasses: "col-auto" },
  { name: "domain",        label: "Domain",      field: "domain",        align: "left", headerClasses: "col-2",     sortable: true },
  { name: "title",         label: "Title",       field: "title",         align: "left", headerClasses: "col-2",     sortable: true },
  { name: "url",           label: "URL",         field: "url",           align: "left", headerClasses: "col-4",     sortable: true },
  { name: "lastAccess",    label: "Last Access", field: "lastAccess",    align: "left", headerClasses: "col-1",     sortable: true },
  { name: "lastAccessAge", label: "Age",         field: "lastAccessAge", align: "left", headerClasses: "col-auto",  sortable: true },
]

onMounted(async () => {
  console.debug('[options] mounted — initializing...')

  try {
    // Initialize unified app store (loads config + tabs from storage)
    await appStore.init()
  } catch (err) {
    console.error('[options] Init error:', err)
    // Store will have defaults if initialization fails
  }

  // Add tab activation listener
  browser.tabs.onActivated.addListener(onTabActivated)

  console.debug('[options] initialized')
})

onUnmounted(() => {
  browser.tabs.onActivated.removeListener(onTabActivated)
})

async function onTabActivated({ tabId }: { tabId: number }): Promise<void> {
  const tab = appStore.tabs.find(t => t.id === tabId)
  if (!tab?.isMarked) return

  const [freshTab] = await browser.tabs.query({ currentWindow: true })
    .then(tabs => tabs.filter(t => t.id === tabId))
  const freshLastAccessed = freshTab?.lastAccessed ?? Date.now()

  appStore.$patch(state => {
    const idx = state.tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    state.tabs[idx] = {
      ...state.tabs[idx],
      lastAccessed:         freshLastAccessed,
      isMarked:             false,
      markedFaviconDataUrl: undefined,
      ageIndex:             0,
    }
  })
  // Persist so popup and background also see the updated state
  await appStore.persistTabs()
}

async function handleCloseTab(tabId: number | null): Promise<void> {
  if (tabId == null) return
  await appStore.closeTab(tabId)
}

async function handleAddDay(tabId: number | null): Promise<void> {
  if (tabId == null) return
  const DAY_MS = 24 * 60 * 60 * 1000

  appStore.$patch(state => {
    const idx = state.tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    const currentLastAccessed = state.tabs[idx].lastAccessed ?? Date.now()
    state.tabs[idx] = {
      ...state.tabs[idx],
      lastAccessed: currentLastAccessed - DAY_MS, // Subtract to make it older
    }
  })

  // Persist so all contexts see the updated state
  await appStore.persistTabs()
}


async function handleGenMockTabs(): Promise<void> {
  await appStore.loadMockTabs()
}
</script>

<style scoped>
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

.error-text {
  font-size: 0.8rem;
  color: red;
}

.config-header {
  margin: 0.5rem 0 0.8rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #1976d2;
  padding-bottom: 0.4rem;
}

.table-cell-text-break {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

:deep(.actions-group) {
  display: flex;
  gap: 4px;
  align-items: center;
}

:deep(.btn-action) {
  white-space: nowrap;
  padding: 2px 6px;
  font-size: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

:deep(.btn-action:hover:not(:disabled)) {
  background: #e0e0e0;
  border-color: #999;
}

:deep(.btn-action:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.btn-add-day) {
  color: #1976d2;
  font-weight: 600;
}

:deep(.btn-close-tab) {
  color: #d32f2f;
}

.favicon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
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
}
</style>
