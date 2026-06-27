<template>
  <AppTitle />
  <div id="options" class="row">
    <div class="col-10 offset-1">
      <!-- Actions — wrapping row, max col-3 per button -->
      <div class="row items-start q-mt-md q-gutter-sm">

          <GroupUngroup />
          <MockButton @mock-created="refreshTabs" v-if="isDevEnv" />

          <RefreshButton @refresh="onRefreshTabs" @error="(msg) => error = msg" />

          <CloseAllTabsButton
            @success="refreshTabs"
            @error="(msg) => error = msg"
          />
      </div>

      <!-- Error display -->
      <div class="row q-mt-sm" data-testid="options-error" v-if="error">
        <span>Error : </span>
        <span class="error-text">{{ error }}</span>
      </div>

      <!-- Thresholds Configuration -->
      <div v-if="isDevEnv" class="row q-mt-lg">
        <div class="col">
          <Thresholds @apply="refreshTabs" />
        </div>
      </div>

      <!-- Live tabs table -->
      <div class="table-container" v-if="tabs.length">
        <div data-testid="table-error" v-if="tabRows.length <= 0 ">{{tabRows.length}}</div>
        <q-table
          title="Open Tabs"
          data-testid="table-open-tabs"
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
            <q-tr :props="props">
              <q-td
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
                :style="col.name === 'lastAccess' ? props.row.rowStyle : undefined"
              >
                <template v-if="col.name === 'actions'">
                  <button class="btn-action btn-close-tab" @click="closeTab(props.row.id)"
                          :disabled="!props.row.id" title="Close tab">Close</button>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <div class="favicon-wrapper">
                    <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="" width="16" height="16"/>
                    <span v-else>—</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'lastAccess'">
                  {{ lastAccessMsg(props.row) }}
                </template>
                <template v-else-if="col.name === 'title'">
                  <span>{{ truncate(props.row.title, 50) }}</span>
                </template>
                <template v-else-if="col.name === 'url'">
                  <a :href="props.row.url" target="_blank" rel="noreferrer">{{ truncate(props.row.url, 50) }}</a>
                </template>
                <template v-else>
                  {{ props.row[col.field] ?? '—' }}
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
import { ref, computed, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS, isDevEnv } from '@/constants'
import { useAppStore } from '@/store/appStore.ts'
import { TabRow } from '@/entrypoints/options/models/TabRow.ts'
import { AgeClassification } from '@/models/AgeClassification.ts'
import Thresholds from '../../components/Thresholds.vue'
import AppTitle from '@/components/Title.vue'
import GroupUngroup from '@/components/GroupUngroup.vue'
import MockButton from '@/components/MockButton.vue'
import CloseAllTabsButton from '@/components/CloseAllTabsButton.vue'
import RefreshButton from '@/components/RefreshButton.vue'

const appStore = useAppStore()
const error = ref<string | null>(null)
const tabs = ref<any[]>([])

const columns: { name: string; label: string; field: string; align: 'left' | 'right'; sortable?: boolean }[] = [
  { name: 'ordinal', label: '#', field: 'ordinal', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'actions', align: 'left' },
  { name: 'thumbnail', label: '', field: 'thumbnail', align: 'left' },
  { name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true },
  { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
  { name: 'url', label: 'URL', field: 'url', align: 'left' },
  { name: 'lastAccess', label: 'Access', field: 'lastAccess', align: 'left', sortable: true },
  { name: 'lastAccessAge', label: 'Age', field: 'lastAccessAge', align: 'left', sortable: true },
]

const tabRows = computed(() => {
  const rows = TabRow.fromTabs(tabs.value, appStore.thresholds.value)
  return rows.map((row: any, i: number) => {
    const days = row.lastAccessDays ?? 0
    const c = AgeClassification.fromDays(days, appStore.thresholds.value)
    return {
      ...row,
      ordinal: i + 1,
      lastAccessAge: `${days}d`,
      rowStyle: c.inlineStyle,
    }
  })
})

function lastAccessMsg(row: TabRow): string {
  const d = row.lastAccessDays
  if (d == null || !Number.isFinite(d)) return '—'
  return d === 0 ? 'Today' : `${d}d ago`
}

function truncate(text: string, max: number): string {
  return !text || text.length <= max ? text : text.substring(0, max) + '…'
}


async function refreshTabs(): Promise<void> {
  error.value = null
  try {
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.GET_TABS
    })
    if (resp?.error) {
      error.value = `[GET_TABS] ${resp.error}`
      return
    }
    tabs.value = resp?.tabs ?? []
  } catch (err) {
    error.value = `[GET_TABS_ERROR] ${err instanceof Error ? err.message : 'Failed to load tabs'}`
  }
}

/** Called by RefreshButton component — receives tabs from its internal sendMessage */
function onRefreshTabs(newTabs: any[]): void {
  tabs.value = newTabs
}

async function closeTab(tabId: number | null): Promise<void> {
  if (tabId == null) return
  try {
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.CLOSE_TAB,
      tabId
    })
    if (resp?.error) {
      error.value = `[CLOSE_TAB] Tab#${tabId}: ${resp.error}`
      return
    }
    tabs.value = tabs.value.filter((t: any) => t.id !== tabId)
  } catch (err) {
    error.value = `[CLOSE_TAB_ERROR] Tab#${tabId}: ${err instanceof Error ? err.message : 'Failed to close tab'}`
  }
}

onMounted(() => {
  refreshTabs()
})


</script>

<style scoped>
#options {
  background: linear-gradient(180deg, rgba(255, 109, 0, 0.04) 0%, rgba(21, 101, 192, 0.04) 100%);
  min-height: 100vh;
  padding: 1rem 0;
}
.table-container { display: flex; justify-content: center; width: 100%; margin: 1rem 0; }
.table-wrapper { max-height: 70vh; width: 100%; }
.error-text { font-size: 0.8rem; color: red; }
.favicon-wrapper { display: inline-flex; align-items: center; width: 22px; height: 22px; }
.btn-action { padding: 2px 6px; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; }
.btn-action:hover:not(:disabled) { background: #e0e0e0; }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-close-tab { color: #d32f2f; }
</style>
