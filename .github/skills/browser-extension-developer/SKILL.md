---
name: browser-extension-developer
description: WXT 0.20+ patterns for browser extension entrypoints, background service worker, content scripts, storage, Vue 3 UI contexts, and cross-browser compatibility (Chrome/Firefox MV3).
---

# Browser Extension — WXT + Vue 3

Stack: WXT 0.20+ · MV3 · Chrome/Firefox · Vue 3.5 · Pinia 3 · Quasar 2 · webextension-polyfill

## Architecture

```
background.ts     ← service worker, NO Pinia, writes browser.storage.local
popup / options   ← Vue 3 + Pinia + Quasar, reads via initStorageSync()
content/          ← Vue 3, ctx lifecycle, mounts overlay
services/         ← static classes, no Vue/Pinia, background-safe
models/           ← type (not interface), factory static methods
```

**Data flow**: background writes → `browser.storage.local` → `storage.onChanged` → Pinia (UI).  
**Rule**: background writes, UI reads. Never reverse.

## WXT Entrypoints

```ts
// ✅ background.ts — synchronous main() REQUIRED
export default defineBackground(() => {
  browser.alarms.create('scan', { periodInMinutes: 1440 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'scan') return;
    BackgroundTabService.loadAndMarkTabs().catch(console.error);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    /* update favicon */
  });
  // ❌ setInterval — service workers suspend ~30s idle
  // ❌ async main() — listeners must register synchronously
  // ❌ listeners outside defineBackground() — broken in MV3
});

// ✅ content script — ctx for lifecycle safety
export default defineContentScript({
  matches: ['*://*/*'],
  main(ctx) {
    if (!ctx.isValid) return;
    ctx.addEventListener(window, 'focus', handler); // auto-removed on invalidation
    ctx.onInvalidated(() => app.unmount());
    createApp(App).mount('#root');
  },
});
```

## Storage

```ts
// Write (background context only)
await browser.storage.local.set({ [KEY]: data });

// Read (any context)
const result = await browser.storage.local.get(KEY);
const value = (result[KEY] as MyType) ?? defaultValue;

// Reactive sync (UI — subscribe in onMounted, unsubscribe in onUnmounted)
const off = browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[KEY]) return;
  store.items = changes[KEY].newValue;
});
```

## Vue Component (Extension UI)

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import browser from 'webextension-polyfill';
import { useTabStore } from '@/stores/TabStore';
import { useGlobalStore } from '@/stores/globalStore';

// Props — type (not interface), withDefaults always
type Props = { title: string; count?: number };
const props = withDefaults(defineProps<Props>(), { count: 0 });
// ❌ const { count } = props — project rule: no destructuring, use props.count

// Emits — always typed
const emit = defineEmits<{ changed: [value: string] }>();

const tabStore = useTabStore();
const global = useGlobalStore();

let unsubscribeStorageSync: (() => void) | null = null;

onMounted(async () => {
  await global.init();
  await tabStore.loadTabsHistory(); // crash recovery from last snapshot
  unsubscribeStorageSync = tabStore.initStorageSync(); // reactive from now on
  browser.tabs.onActivated.addListener(handler);
});

onUnmounted(() => {
  unsubscribeStorageSync?.();
  browser.tabs.onActivated.removeListener(handler);
});
</script>
```

## Pinia Store (UI context only)

```ts
type State = {
  items: SomeModel[];
  loading: boolean;
  error: string | null; // always string | null
};

export const useStoreName = defineStore('storeName', {
  state: (): State => ({ items: [], loading: false, error: null }),
  getters: {
    count: (state): number => state.items.length, // pure only
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

## Static Service (background-safe)

```ts
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

## TypeScript Rules

```ts
// ✅ type for all shapes
export type TabState = { tabs: ClassifiedTab[]; loading: boolean; error: string | null };
type Nullable<T> = T | null;

// ❌ interface (only for declaration merging)
// ❌ any — use generics or proper types
// ❌ const { x } = obj — use obj.x (grep-friendly, refactor-safe)
// ❌ unknown leaking to callers
```

## MV3 Restrictions

- No `eval`, no CDN scripts (CSP)
- `browser.action` (not `browserAction`)
- `browser.scripting.executeScript` (not `tabs.executeScript`)
- Service worker: no DOM, no `localStorage`, suspends ~30s idle
- Favicon `data:` URLs unreliable in `onUpdated` → use `onActivated`
- Manifest auto-generated by WXT — never edit `manifest.json`

## Commands

```bash
npm run dev               # Chrome HMR
npm run dev:firefox       # Firefox HMR
npm run build-only        # → .output/chrome-mv3/
npm run test:unit         # Vitest (jsdom, ~2s)
npm run test:playwright   # E2E real Chromium (~60s)
SKIP_BUILD=1 npm run test:playwright  # skip rebuild
```

## Cross-Browser

- Always `import browser from 'webextension-polyfill'` — never `chrome.*`
- Firefox MV2 still supported; WXT handles `browser_specific_settings` automatically
- `scripting` permission required in `wxt.config.ts` for `executeScript`
