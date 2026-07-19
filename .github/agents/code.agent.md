---
role: code-generator
skill: browser-extension-developer
context7: [/websites/wxt_dev, /vuejs/vue, /websites/pinia_vuejs, /vueuse/vueuse]
---

# Code Agent

**Prime directive**: Read target file + all its imports first. Generate complete, typed, architecture-consistent code.

## Decision Tree

```
background.ts        → defineBackground(), sync main(), browser.alarms only (NO Pinia)
entrypoints/*/App.vue → <script setup lang="ts">, Quasar, loadTabsHistory() + initStorageSync()
components/*.vue     → typed props + emits, no direct store mutation
stores/*.ts          → defineStore(), type State, loading + error: string|null always present
services/*.ts        → static class, pure methods, NO Vue/Pinia imports
models/**/*.ts       → type (not interface), factory static methods
```

## Templates

### Background Entrypoint

```ts
import { defineBackground } from 'wxt/sandbox';
import browser from 'webextension-polyfill';
import { BackgroundTabService } from '@/services/BackgroundTabService';
import { APP_DEFAULTS } from '@/constants';

export default defineBackground(() => {
  browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, { periodInMinutes: 1440 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return;
    BackgroundTabService.loadAndMarkTabs().catch(console.error);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    browser.tabs
      .get(tabId)
      .then((tab) => {
        if (!tab.favIconUrl?.startsWith('data:')) return;
      })
      .catch(console.debug);
  });
});
```

### Vue Component (UI entrypoint)

```vue
<template><!-- Quasar: q-btn q-table q-tooltip; CSS: got-* from global.css --></template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import browser from 'webextension-polyfill';
import { useTabStore } from '@/stores/TabStore';
import { useGlobalStore } from '@/stores/globalStore';

type Props = { required: string; optional?: number };
const props = withDefaults(defineProps<Props>(), { optional: 0 });
const emit = defineEmits<{ changed: [value: string] }>();

const tabStore = useTabStore();
const global = useGlobalStore();
const { tabRows } = storeToRefs(tabStore);
let unsubscribeStorageSync: (() => void) | null = null;

onMounted(async () => {
  await global.init();
  await tabStore.loadTabsHistory();
  unsubscribeStorageSync = tabStore.initStorageSync();
});
onUnmounted(() => {
  unsubscribeStorageSync?.();
});

async function handleAction(): Promise<void> {
  try {
    await tabStore.someAction();
  } catch (err) {
    console.error('[ComponentName]', err);
  }
}
</script>
```

### Pinia Store

```ts
import { defineStore } from 'pinia';
import browser from 'webextension-polyfill';
import type { SomeModel } from '@/models/SomeModel';

type State = { items: SomeModel[]; loading: boolean; error: string | null };

export const useStoreName = defineStore('storeName', {
  state: (): State => ({ items: [], loading: false, error: null }),
  getters: {
    count: (state): number => state.items.length,
  },
  actions: {
    async fetchItems(): Promise<SomeModel[]> {
      this.loading = true;
      this.error = null;
      try {
        const raw = await browser.storage.local.get('key');
        this.items = raw['key'] ?? [];
        return this.items;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Unknown error';
        return [];
      } finally {
        this.loading = false;
      }
    },
  },
});
```

### Static Service (background-safe)

```ts
import browser from 'webextension-polyfill';
import { APP_DEFAULTS } from '@/constants';

export class ServiceName {
  static async getData(): Promise<string | null> {
    try {
      const r = await browser.storage.local.get(APP_DEFAULTS.KEY);
      return (r[APP_DEFAULTS.KEY] as string) ?? null;
    } catch {
      return null;
    }
  }
}
```

## Checklist

- [ ] `type` used (not `interface`) for all shapes
- [ ] No `any`, no `unknown` leaking
- [ ] No `const { x } = obj` — use `obj.x`
- [ ] `loading` + `error: string | null` in every store
- [ ] `try/catch/finally` in every async action
- [ ] `browser` from `webextension-polyfill` (never `chrome.*`)
- [ ] Quasar components in template (`q-btn`, not `<button>`)
- [ ] `onUnmounted` cleanup for listeners + storage sync
- [ ] `loadTabsHistory()` before `initStorageSync()` in `onMounted`
- [ ] No `setInterval` — use `browser.alarms`
- [ ] No Pinia in `background.ts`
