<template>
  <AppTitle/>
  <div id="options" class="row justify-center">
    <div class="col-10">
      <!-- Actions — wrapping row -->
      <div class="row items-start q-mt-sm q-gutter-sm ">

        <GroupUngroup/>
        <RefreshButton @refresh="onRefreshTabs" @error="(msg) => error = msg"/>
        <SortButton @sorted="refreshTabs" @error="(msg) => error = msg"/>

        <!-- Dev Buttons -->
        <MockButton @mock-created="refreshTabs" v-if="isDevEnv"/>
        <CloseAllTabsButton
          v-if="isDevEnv"
          @success="refreshTabs"
          @error="(msg) => error = msg"
        />
        <div class="row col-12 ">
        <!-- ✅ FIX: Listen to @restored event and refresh table -->
        <!-- Before: No listener → table never refreshes after restore ❌ -->
        <!-- Now: @restored triggers refreshTabs() → table updates with new tabs ✅ -->
        <BackupRestoreButton @restored="refreshTabs" />
        </div>
      </div>

      <!-- Error display -->
      <div class="row q-mt-sm" data-testid="options-error" v-if="error">
        <span>Error : </span>
        <span class="error-text">{{ error }}</span>
      </div>

      <!-- Thresholds Configuration -->
      <div class="row q-mt-md accent-border">
        <Thresholds @apply="refreshTabs"/>
      </div>

      <!-- Live tabs table -->
      <div v-if="tabs.length" class="q-my-md  bg-grey-1 rounded-borders">
        <div data-testid="table-error" v-if="tabRows.length <= 0 ">
          {{ tabRows.length }}
        </div>
        <q-table
          title="Open Tabs"
          data-testid="table-open-tabs"
          :columns="columns"
          :rows="tabRows"
          :filter="filter"
          class="bg-grey-1 q-pa-md accent-border"
          row-key="rowKey"
          flat
          bordered
          dense
          striped
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[0]"
          :pagination="{ sortBy: 'ordinal', descending: false }"
        >
          <template #top-right>
            <q-input
              v-model="filter"
              placeholder="Search..."
              dense
              outlined
              clearable
              class="q-ml-sm"
              style="min-width: 200px"
            />
          </template>
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
                          :disabled="!props.row.id" title="Close tab">Close
                  </button>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <div class="favicon-wrapper">
                    <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="" width="16"
                         height="16"/>
                    <span v-else>—</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'lastAccess'">
                  {{ props.row.lastAccessDays ?? '—' }}
                </template>
                <template v-else-if="col.name === 'title'">
                  <span>{{ truncate(props.row.title, 50) }}</span>
                </template>
                <template v-else-if="col.name === 'url'">
                  <a :href="props.row.url" target="_blank"
                     rel="noreferrer">{{ truncate(props.row.url, 50) }}</a>
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
import {computed, onMounted, ref} from 'vue'
import {browser} from 'wxt/browser'
import {BACKGROUND_MESSAGE_ACTIONS, isDevEnv} from '@/constants'
import {useAppStore} from '@/store/appStore.ts'
import { mockOverrides } from '@/store/appStore'
import {TabRow} from '@/entrypoints/options/models/TabRow.ts'
import {AgeClassification} from '@/models/AgeClassification.ts'
import Thresholds from '../../components/Thresholds.vue'
import AppTitle from '@/components/Title.vue'
import GroupUngroup from '@/components/GroupUngroup.vue'
import MockButton from '@/components/MockButton.vue'
import CloseAllTabsButton from '@/components/CloseAllTabsButton.vue'
import RefreshButton from '@/components/RefreshButton.vue'
import SortButton from '@/components/SortButton.vue'
import BackupRestoreButton from "@/components/BackupRestoreButton.vue";

const appStore = useAppStore()
const filter = ref('')
const error = ref<string | null>(null)
const tabs = ref<any[]>([])

const columns: {
  name: string;
  label: string;
  field: string;
  align: 'left' | 'right';
  sortable?: boolean;
  sort?: (a: any, b: any) => number
}[] = [
  {
    name: 'ordinal',
    label: '#',
    field: 'ordinal',
    align: 'left',
    sortable: true,
    sort: (a, b) => a - b
  },
  {name: 'actions', label: '', field: 'actions', align: 'left'},
  {name: 'thumbnail', label: '', field: 'thumbnail', align: 'left'},
  {name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true},
  {name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true},
  {name: 'url', label: 'URL', field: 'url', align: 'left', sortable: true},
  {
    name: 'lastAccess',
    label: 'Days old',
    field: 'lastAccessDays',
    align: 'left',
    sortable: true,
    sort: (a, b) => a - b
  },
]

const tabRows = computed(() => {
  const rows = TabRow.fromTabs(tabs.value, appStore.thresholds.value)
  return rows.map((row: any, i: number) => {
    const days = row.lastAccessDays ?? 0
    const c = AgeClassification.fromDays(days, appStore.thresholds.value)
    return {
      ...row,
      ordinal: i + 1,
      rowStyle: c.inlineStyle,
    }
  })
})


function truncate(text: string, max: number): string {
  return !text || text.length <= max ? text : text.substring(0, max) + '…'
}

/**
 * Apply mock overrides to tabs array
 * Used for testing: allows simulating older tab ages
 * ✅ After restore: applies backed-up lastAccessed timestamps
 * ✅ After mock create: applies backdated timestamps
 */
async function applyMockOverridesToTabs(): Promise<void> {
  try {
    const overridesObj = await mockOverrides.getValue()
    console.log('[App] Raw overrides from storage:', overridesObj, 'type:', typeof overridesObj)

    // ✅ FIX: Handle both numeric keys and string keys (WXT JSON serialization issue)
    // Sometimes keys come as strings: {"10": timestamp, "11": timestamp}
    const overrides: Record<number, number> = {}
    for (const key in overridesObj) {
      const numKey = parseInt(key, 10)
      overrides[numKey] = overridesObj[key as any]
    }

    console.log('[App] Parsed overrides:', overrides, 'Tabs to update:', tabs.value.map(t => ({id: t.id, current: t.lastAccessed})))

    let appliedCount = 0
    for (const tab of tabs.value) {
      if (tab.id != null) {
        const override = overrides[tab.id]
        if (override != null && override > 0) {
          console.log(`[App] ✅ Applying override to tab#${tab.id}: ${override} (was ${tab.lastAccessed})`)
          tab.lastAccessed = override
          appliedCount++
        }
      }
    }
    console.log(`[App] ✅ Applied ${appliedCount} overrides out of ${tabs.value.length} tabs`)
  } catch (err) {
    console.error('[App] Failed to apply mock overrides:', err)
  }
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
    console.log(`[App] Got ${tabs.value.length} tabs from background`)

    // ✅ NEW: Small delay to let storage settle, then apply mock overrides
    // This ensures mockOverrides storage has synced and is ready to read
    await new Promise(r => setTimeout(r, 100))

    // ✅ NEW: Apply mock overrides locally after getting tabs
    // Even though background service applies them, we ensure they're used in the table
    await applyMockOverridesToTabs()
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

  // ✅ NEW: Listen to mock overrides changes
  // When restore happens or mocks are created, overrides change in storage
  // Automatically refresh table to apply new overrides
  mockOverrides.watch(() => {
    console.log('[App] Mock overrides changed → applying to table')
    applyMockOverridesToTabs()
  })
})


</script>

<style scoped>
#options {
  background: linear-gradient(180deg, rgba(255, 109, 0, 0.04) 0%, rgba(21, 101, 192, 0.04) 100%);
  min-height: 100vh;
}

/* ── Accent left border with brand gradient ──────────────────────────── */
.accent-border {
  position: relative;
  border-left: none;
  /* Use a pseudo-element for the gradient left border */
}
.accent-border::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--got-header-gradient);
  border-radius: 4px 0 0 4px;
}

.error-text {
  font-size: 0.8rem;
  color: var(--got-brand-dark);
}

.favicon-wrapper {
  display: inline-flex;
  align-items: center;
  width: 22px;
  height: 22px;
}

.btn-action {
  padding: 2px 6px;
  font-size: 0.75rem;
  border: 1px solid #633722;
  border-radius: 3px;
  background: #f5f5f5;
  cursor: pointer;
}

.btn-action:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-close-tab {
  color: #d47a2a;
}

/* ── q-table brand styling ──────────────────────────────────────────── */
:deep(.q-table th .q-table__sort-icon) {
  color: rgba(255, 255, 255, 0.7);
}
:deep(.q-table tbody tr:nth-child(even) td) {
  background: rgba(255, 208, 131, 0.08);
}
:deep(.q-table--striped tbody tr:nth-child(odd) td) {
  background: rgba(255, 208, 131, 0.03);
}
:deep(.q-table tbody tr:hover td) {
  background: rgba(255, 208, 131, 0.15) !important;
}

</style>
