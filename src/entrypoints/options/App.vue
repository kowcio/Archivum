<template>
  <div id="options">
    <h1>Extension Options (Vue){{ currentDate}}</h1>

    <h1> Tabs table</h1>

    <div style="margin-top:24px">
      <q-table
         data-testid="current-tabs-table"
         title="Open Tabs"
         :columns="columns"
         :rows="rows"
         row-key="rowKey"
         flat
         bordered
         wrap-cells
         :pagination="{ rowsPerPage: 25 }"
       >
         <template #body-cell-close="props">
           <q-td :props="props">
             <button @click="handleCloseTab(props.row.id)" :disabled="!props.row.id">Close</button>
           </q-td>
         </template>
         <template #body-cell-thumbnail="props">
           <q-td :props="props">
             <img v-if="props.row.thumbnail" :src="props.row.thumbnail" alt="favicon" width="20" height="20" />
             <span v-else>—</span>
           </q-td>
         </template>
        <template #body-cell-lastAccessAge="props">
          <q-td :props="props" :class="ageClass(props.row.lastAccessAgeDays)">
            {{ props.row.lastAccessAge }}
          </q-td>
        </template>
          <template #body-cell-url="props">
            <q-td :props="props">
              <a v-if="props.row.url" :href="props.row.url" target="_blank"
                 rel="noreferrer">{{ props.row.url }}</a>
              <span v-else>—</span>
            </q-td>
          </template>
        </q-table>
      </div>

    <div>
      <label>
        Username
        <input v-model="username" type="text"/>
      </label>
    </div>
    <div>
      <label>
        <input v-model="enabled" type="checkbox"/> Enable feature
      </label>
    </div>
    <div style="margin-top:12px">
      <button @click="save">Save</button>
      <span style="margin-left:12px;color:green" v-if="saved">Saved</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import {computed, ref, onMounted} from 'vue';
import {useGlobalStore} from '@/stores/globalStore.ts';
import TabService from '@/services/TabService';
import type {Tabs} from 'webextension-polyfill';
import type {QTableProps} from 'quasar';
import dayjs from "dayjs";

const global = useGlobalStore();
const tabService = new TabService();
const username = ref('');
const enabled = ref(false);
const saved = ref(false);
const currentDate = computed<string>(() => dayjs().format('HH:mm:ss'));
const tabs = ref<Tabs.Tab[]>([]);

interface TabRow {
  rowKey: string;
  thumbnail: string;
  domain: string;
  title: string;
  url: string;
  id: number | null;
  openerTabId: number | null;
  lastAccess: string;
  lastAccessAge: string;
  lastAccessAgeDays: number;
  sessionId: string;
}

const columns: QTableProps['columns'] = [
  { name: 'close', label: '', field: 'close', align: 'left' },
  { name: 'thumbnail', label: '', field: 'thumbnail', align: 'left' },
  { name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true },
  { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
  { name: 'url', label: 'URL', field: 'url', align: 'left' },
  { name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true },
  { name: 'openerTabId', label: 'Opener Tab ID', field: 'openerTabId', align: 'left', sortable: true },
  { name: 'lastAccess', label: 'Last Access', field: 'lastAccess', align: 'left', sortable: true },
  { name: 'lastAccessAge', label: 'Last Access Age', field: 'lastAccessAge', align: 'left', sortable: true },
  { name: 'sessionId', label: 'Session ID', field: 'sessionId', align: 'left' },
];

const rows = computed<TabRow[]>(() =>
  tabs.value.map((tab, index) => {
     const age = calculateLastAccessAge(tab.lastAccessed);
     return {
       rowKey: String(tab.id ?? tab.sessionId ?? `idx-${index}`),
       thumbnail: tab.favIconUrl ?? '',
       domain: extractDomain(tab.url),
       title: tab.title ?? '',
       url: tab.url ?? '',
       id: tab.id ?? null,
       openerTabId: tab.openerTabId ?? null,
       lastAccess: formatLastAccessed(tab.lastAccessed),
       lastAccessAge: age.label,
       lastAccessAgeDays: age.days,
       sessionId: tab.sessionId ?? '',
    }
  }),
);

onMounted(async () => {
  await global.init();
  username.value = global.flags.username ?? '';
  enabled.value = !!global.flags.enabled;
  await loadTabs();
});

async function loadTabs(): Promise<void> {
  try {
    const fetchedTabs: Tabs.Tab[] = await tabService.getAllOpenedTabs();
    tabs.value = fetchedTabs;
  } catch (error: unknown) {
    console.error(error);
  }
}

async function handleCloseTab(tabId: number | null) {
  if (tabId == null) return;
  try {
    await tabService.closeTab(tabId);
    tabs.value = tabs.value.filter((tab) => tab.id !== tabId);
  } catch (error) {
    console.error('Failed to close tab', error);
  }
}

function extractDomain(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (err) {
    console.error('Failed to parse tab URL', err);
    return url;
  }
}

function formatLastAccessed(lastAccessed?: number): string {
  if (!lastAccessed) return '';
  return new Date(lastAccessed).toLocaleString();
}

function calculateLastAccessAge(lastAccessed?: number): { label: string; days: number } {
  if (!lastAccessed) return { label: '', days: Number.NaN };
  const diffMs = Date.now() - lastAccessed;
  if (diffMs < 0) return { label: '0d 0h', days: 0 };
  const hoursTotal = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  return { label: `${days}d ${hours}h`, days };
}

function ageClass(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '';
  if (days <= 7) return 'age-green';
  if (days <= 14) return 'age-yellow';
  if (days <= 28) return 'age-orange';
  return 'age-black';
}

async function save() {
  global.flags = {...global.flags, username: username.value, enabled: enabled.value};
  await global.save();
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
}

#options {
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}
</style>

<style scoped>
input[type='text'] {
  width: 320px;
  padding: 6px;
}

label {
  display: block;
  margin: 8px 0;
}

.age-green {
  background: #e6f4ea;
}

.age-yellow {
  background: #fff9db;
}

.age-orange {
  background: #ffe5d0;
}

.age-black {
  background: #000;
  color: #fff;
}
</style>
