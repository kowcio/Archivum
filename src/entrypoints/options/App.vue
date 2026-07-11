<template>
  <AppTitle/>
  <div id="options" class="row justify-center">
    <div class="col-10">
      <!-- Actions — wrapping row -->
      <div class="row items-center q-mt-sm q-gutter-md ">

        <GroupUngroup/>
        <RefreshButton v-if="isDevEnv" @refresh="onRefreshTabs" @error="(msg) => error = msg"/>
        <SortButton @sorted="refreshTabs" @error="(msg) => error = msg"/>

        <!-- Dev Buttons -->
        <MockButton @mock-created="refreshTabs" v-if="isDevEnv"/>
        <CloseAllTabsButton
          v-if="isDevEnv"
          @success="refreshTabs"
          @error="(msg) => error = msg"
        />
        <div class="col-12 row items-center q-pa-md bg-grey-1 rounded-borders accent-border" style="gap: 0.75rem">
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
                :style="col.style"
              >
                <template v-if="col.name === 'actions'">
                  <div class="btn-group ">
                      <button class="btn-action btn-focus-tab" @click="focusTab(props.row.id)"
                              :disabled="!props.row.id" title="Focus tab (bring to foreground)">
                        👁️ Focus
                      </button>
                      <button class="btn-action btn-close-tab" @click="closeTab(props.row.id)"
                              :disabled="!props.row.id" title="Close tab">
                        ✕ Close
                      </button>
                  </div>
                </template>
                <template v-else-if="col.name === 'thumbnail'">
                  <div class="favicon-wrapper">
                    <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="" width="24"
                         height="24"/>
                    <span v-else>—</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'lastAccess'">
                  <span :style="props.row.rowStyle">{{ props.row.lastAccessDays ?? '—' }}</span>
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
  sort?: (a: any, b: any) => number;
  style?: string;
}[] = [
  {
    name: 'ordinal',
    label: '#',
    field: 'ordinal',
    align: 'left',
    sortable: true,
    sort: (a, b) => a - b,
    style: 'width: 25px'
  },
  {name: 'actions', label: 'Actions', field: 'actions', align: 'left', style: 'width: 90px'},
  {name: 'thumbnail', label: 'Icon', field: 'thumbnail', align: 'left', style: 'width: 45px'},
  {name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true, style: 'width: 18%'},
  {name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true},
  {name: 'url', label: 'URL', field: 'url', align: 'left', sortable: true},
  {
    name: 'lastAccess',
    label: 'Days old',
    field: 'lastAccessDays',
    align: 'left',
    sortable: true,
    sort: (a, b) => a - b,
    style: 'width: 60px'
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

async function focusTab(tabId: number | null): Promise<void> {
  if (tabId == null) return
  try {
    const resp: any = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.FOCUS_TAB,
      tabId
    })
    if (resp?.error) {
      error.value = `[FOCUS_TAB] Tab#${tabId}: ${resp.error}`
      return
    }
    // Success - tab is now focused, close the options page so user can investigate
    window.close()
  } catch (err) {
    error.value = `[FOCUS_TAB_ERROR] Tab#${tabId}: ${err instanceof Error ? err.message : 'Failed to focus tab'}`
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
  overflow-x: hidden;
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
  flex-shrink: 0;
}

/* ── Button Group Layout (Focus + Close buttons) ──────────────────────── */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: fit-content;
}

.btn-action {
  font-size: 0.68rem;
  padding: 5px 10px 5px 8px;
  border: 1px solid #d4a574;
  border-radius: 3px;
  background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
  cursor: pointer;
  white-space: normal;
  text-align: center;
  transition: all 0.12s ease;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  line-height: 1.2;
}


.btn-action:hover:not(:disabled) {
  background: linear-gradient(135deg, #ffd083 0%, #ffca5d 100%);
  box-shadow: 0 2px 6px rgba(212, 122, 42, 0.25);
  border-color: #c4945f;
}

.btn-action:active:not(:disabled) {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.btn-action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-focus-tab {
  color: #1565c0;
}

.btn-focus-tab:hover:not(:disabled) {
  color: #0d3fa6;
}

.btn-close-tab {
  color: #d47a2a;
}

.btn-close-tab:hover:not(:disabled) {
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%) !important;
  color: #c62828;
  border-color: #c62828 !important;
}

/* ── Table Cell Text Wrapping (prevent overflow) ──────────────────────── */
:deep(.q-table td) {
  word-break: break-word;
  overflow-wrap: break-word;
  word-wrap: break-word;
  padding: 4px 10px;
  line-height: 1.3;
  transition: background-color 0.12s ease;
  border-top: none !important;
  border-bottom: none !important;
  min-width: 0;
  max-width: 100%;
}

/* ── Specific column widths ──────────────────────────────────────────── */
/* Column widths are now defined in columns array with style property */
/* CSS below handles only responsive behavior and text wrapping */

:deep(.q-table th,
      .q-table td) {
  word-break: break-word;
  overflow-wrap: break-word;
  word-wrap: break-word;
  padding: 5px 10px;
  line-height: 1.3;
  border: none !important;
  min-width: 0;
}

/* ── Last column (Days old) - badge styling on span element ──────────────── */
:deep(.q-table tbody tr td:last-child) {
  padding: 4px 8px;
  text-align: center;
}

:deep(.q-table a) {
  color: #1565c0;
  text-decoration: none;
  word-break: break-word;
}

:deep(.q-table a:hover) {
  text-decoration: underline;
}

/* ── Table wrapper with horizontal scroll protection ──────────────────── */
:deep(.q-table__card) {
  overflow-x: auto;
  overflow-y: visible;
  margin: 0;
}

:deep(.q-table__middle) {
  overflow: visible;
  max-width: 100%;
}

/* ── q-table brand styling ──────────────────────────────────────────── */
:deep(.q-table th .q-table__sort-icon) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.q-table thead tr th) {
  background: transparent;
  border: none !important;
  font-weight: 600;
  padding: 8px 10px;
  color: #5a4a1a;
}

:deep(.q-table tbody tr) {
  height: auto;
  transition: background-color 0.12s ease;
  border-top: none !important;
  border-bottom: none !important;
}

:deep(.q-table tbody tr:nth-child(even) td) {
  background: rgba(255, 208, 131, 0.08);
}

:deep(.q-table--striped tbody tr:nth-child(odd) td) {
  background: transparent;
}

:deep(.q-table tbody tr:hover td) {
  background: rgba(255, 138, 0, 0.15) !important;
}

</style>
