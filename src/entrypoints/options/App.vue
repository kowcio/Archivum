<template>
  <div id="options">
    <h1>Extension Options (Vue){{ currentDate }}</h1>

    <h1> Tabs table</h1>

    <div style="margin-top:24px; display: flex; justify-content: center;">
      <q-table
        style="width: 80%;"
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
import {computed, onMounted, ref} from 'vue';
import {useGlobalStore} from '@/stores/globalStore.ts';
import TabService from '@/services/TabService';
import type {Tabs} from 'webextension-polyfill';
import type {QTableProps} from 'quasar';
import dayjs from "dayjs";
import { TabRow } from '@/models/tabs/TabRow';


const global = useGlobalStore();
const tabService = new TabService();
const username = ref('');
const enabled = ref(false);
const saved = ref(false);
const currentDate = computed<string>(() => dayjs().format('HH:mm:ss'));
const tabs = ref<Tabs.Tab[]>([]);

const columns: QTableProps['columns'] = [
  {name: 'ordinal', label: '#', field: 'ordinal', align: 'left'},
  {name: 'close', label: '', field: 'close', align: 'left'},
  {name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true},
  {name: 'thumbnail', label: '', field: 'thumbnail', align: 'left'},
  {name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true},
  {name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true},
  {name: 'url', label: 'URL', field: 'url', align: 'left'},
  {
    name: 'openerTabId',
    label: 'Opener Tab ID',
    field: 'openerTabId',
    align: 'left',
    sortable: true
  },
  {name: 'lastAccess', label: 'Last Access', field: 'lastAccess', align: 'left', sortable: true},
];

const rows = computed(() =>
  TabRow.fromTabs(tabs.value).map((row, index) => ({
    ...row,
    ordinal: index + 1,
  }))
);

function getLastAccessMsg(row: TabRow): string {
  return `${row.lastAccessDays} days ${row.lastAccessHours} hours ago`;
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
  try {
    tabs.value = await tabService.getAllOpenedTabs();
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
</style>
