<template>
  <div class="version-info">Version: {{ version }}</div>
  <div id="options" class="row">
  <div class="col-10 offset-1">

    <div class="row q-mt-md">
    <div class="q-col-gutter">
      <q-btn-group class="q-mb-sm">
        <q-btn data-testid="btn-load-tabs" label="Load Tabs" color="primary" :loading="tabStore.loading" @click="handleLoadTabs" />
        <q-btn data-testid="btn-load-saved-tabs" label="Load Saved Tabs" color="info" :loading="tabStore.loading" @click="handleLoadSavedTabs" />
        <q-btn data-testid="btn-save-tabs" label="Save Tabs" color="secondary" :loading="tabStore.loading" @click="handleSaveTabs" />
        <q-btn data-testid="btn-gen-mock-tabs" label="Gen &amp; save mock tabs" color="warning" :loading="tabStore.loading" @click="handleGenMockTabs" />
      </q-btn-group>
      <span v-if="tabStore.lastSaveDate" style="font-size: 0.8rem; color: #666;">
        Last saved: {{ tabStore.lastSaveDate }}
      </span>
      <span v-if="tabStore.error" style="font-size: 0.8rem; color: red;">
        Error: {{ tabStore.error }}
      </span>
      </div>
    </div>

    <div style="margin:24px; display: flex; ">
      <q-table
        data-testid="current-tabs-table"
        title="Open Tabs"
        :columns="columns"
        :rows="rows"
        class="rounded-borders bg-grey-1 q-table--striped"
        row-key="rowKey"
        flat
        bordered
        dense
        wrap-cells
        virtual-scroll
        style="max-height: 70vh;"
        :rows-per-page-options="[0]"
      >
        <template #body="props">
          <q-tr :props="props" :data-testid="`row-${props.row.rowKey}`">
            <q-td
              v-for="col in props.cols"
              :key="col.name"
              :props="props"
              :data-testid="`cell-${col.name}-${props.row.rowKey}`"
              :class="col.name === 'lastAccess' ? props.row.lastAccessClass : undefined"
            >
              <template v-if="col.name === 'close'">
                <button @click="handleCloseTab(props.row.id)" :disabled="!props.row.id">Close
                </button>
              </template>
              <template v-else-if="col.name === 'thumbnail'">
                <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="favicon" width="20"
                     height="20"/>
                <span v-else>—</span>
              </template>
              <template v-else-if="col.name === 'lastAccess'" :class="props.row.lastAccessClass">
                {{ getLastAccessMsg(props.row) || '—' }}
              </template>
              <template v-else-if="col.name === 'url'">
                <a v-if="props.row.url" :href="props.row.url" target="_blank"
                   rel="noreferrer">{{ props.row.url }}</a>
                <span v-else>—</span>
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
import {computed, onMounted, ref} from 'vue';
import {useGlobalStore} from '@/stores/globalStore.ts';
import {useTabStore} from '@/stores/TabStore';
import type {Tabs} from 'webextension-polyfill';
import type {QTableProps} from 'quasar';
import {TabRow} from '@/models/tabs/TabRow';
import globals from '@/globals';

const version = globals.APP_VERSION;

const global = useGlobalStore();
const tabStore = useTabStore();
const username = ref('');
const enabled = ref(false);
const saved = ref(false);
const tabs = ref<Tabs.Tab[]>([]);

const columns: QTableProps['columns'] = [
  {name: 'ordinal',       label: '#',           field: 'ordinal',       align: 'left', headerClasses: 'col-auto', sortable: true},
  {name: 'close',         label: '',            field: 'close',         align: 'left', headerClasses: 'col-auto'},
  // {name: 'id',            label: 'ID',          field: 'id',            align: 'left', headerClasses: 'col-auto', sortable: true},
  {name: 'thumbnail',     label: '',            field: 'thumbnail',     align: 'left', headerClasses: 'col-auto'},
  {name: 'domain',        label: 'Domain',      field: 'domain',        align: 'left', headerClasses: 'col-2',    sortable: true},
  {name: 'title',         label: 'Title',       field: 'title',         align: 'left', headerClasses: 'col-2',    sortable: true},
  {name: 'url',           label: 'URL',         field: 'url',           align: 'left', headerClasses: 'col-4',    sortable: true},
  // {name: 'openerId',      label: 'Opener ID',   field: 'openerTabId',   align: 'left', headerClasses: 'col-1'},
  {name: 'lastAccess',    label: 'Last Access', field: 'lastAccess',    align: 'left', headerClasses: 'col-1',    sortable: true},
  // {name: 'lastAccessAge', label: 'Age',         field: 'lastAccessAge', align: 'left', headerClasses: 'col-auto', sortable: true},
];

const rows = computed(() =>
  TabRow.fromTabs(tabs.value).map((row, index) => ({
    ...row,
    ordinal: index + 1,
    title: removeAllAfterLastDash(row.title),
    lastAccessAge: row.lastAccessDays != null ? `${row.lastAccessDays}d` : '—',
  }))
);

function removeAllAfterLastDash(text: string): string {
  if (!text) return text;
  const lastIndex = text.lastIndexOf('-');
  return lastIndex !== -1 ? text.slice(0, lastIndex).trim() : text;
}

function getLastAccessMsg(row: TabRow): string {
  return `${row.lastAccessDays} days ago`;
  // if (!row.lastAccess) return '—';
  // return dayjs(row.lastAccess).format('YYYY-MM-DD HH:mm');
}


onMounted(async () => {
  await global.init();
  username.value = global.flags.username ?? '';
  enabled.value = !!global.flags.enabled;
  await loadTabs();
});

async function loadTabs(): Promise<void> {
  tabs.value = await tabStore.getAllOpenedTabs();
}

async function handleCloseTab(tabId: number | null): Promise<void> {
  if (tabId == null) return;
  tabs.value = await tabStore.closeTab(tabId);
}

function createMockTabs(count = 5): Tabs.Tab[] {
  const mockData = [
    { url: 'https://github.com/microsoft/vscode', title: 'VS Code · GitHub', favIconUrl: 'https://github.com/favicon.ico' },
    { url: 'https://developer.mozilla.org/en-US/docs/Web/API', title: 'Web APIs | MDN', favIconUrl: 'https://developer.mozilla.org/favicon.ico' },
    { url: 'https://vuejs.org/guide/introduction', title: 'Introduction — Vue.js', favIconUrl: 'https://vuejs.org/favicon.ico' },
    { url: 'https://pinia.vuejs.org/core-concepts/', title: 'Core Concepts | Pinia', favIconUrl: 'https://pinia.vuejs.org/favicon.ico' },
    { url: 'https://vitest.dev/guide/', title: 'Getting Started | Vitest', favIconUrl: 'https://vitest.dev/favicon.ico' },
  ];
  return Array.from({ length: count }, (_, index) => ({
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
  } satisfies Tabs.Tab));
}

async function handleLoadTabs(): Promise<void> {
  tabs.value = await tabStore.getAllOpenedTabs();
}

async function handleLoadSavedTabs(): Promise<void> {
  tabs.value = (await tabStore.loadTabsHistory())?.tabs ?? [];
}

async function handleSaveTabs(): Promise<void> {
  await tabStore.saveAllTabs();
}

function handleGenMockTabs(): void {
  tabs.value = createMockTabs(5);
}


async function save() {
  global.flags = {...global.flags, username: username.value, enabled: enabled.value};
  await global.save();
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
</script>

<style>


</style>

<style scoped>

</style>
