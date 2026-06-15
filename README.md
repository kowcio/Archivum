# 🕰️ Tab Age Tracker

> A browser extension that tracks how long your tabs have been open, marks stale ones with a visual L-bracket favicon overlay, and groups them by age — so you finally close the 47 tabs you opened "just for a second".

Built with **WXT 0.20+** · **Vue 3 + Pinia** · **Quasar** · **TypeScript** · **Playwright** · **Vitest**  
Targets **Chrome MV3** and **Firefox MV3**.

---

## Why Does This Exist?

Modern browsers give you zero visibility into tab age. You open a tab to read later, forget it exists, and six months later you have 200 tabs and a 4GB RAM bill.

Tab Age Tracker solves this by:

- **Visually marking** stale tabs with a colour-coded L-bracket overlay rendered directly on the favicon
- **Grouping** tabs by age category (🟡 Young / 🟠 Middle / 🔴 Old) using Chrome's native tab groups API
- **Running silently** via a 24h background alarm — marks tabs even if you never open the extension
- **One-click control** from the popup or full management via the options page

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   browser.storage.local                       │
│   "local:tab_history"   → TabsSnapshot { tabs, isGrouped }  │
│   "local:global_store"  → thresholds, version               │
└────────────────────────┬─────────────────────────────────────┘
                         │  WXT tabStorageItem.watch()
            ┌────────────┼──────────────┬──────────────────┐
            ▼            ▼              ▼                  ▼
        [popup]      [options]      [content]        [background]
        Vue+Pinia    Vue+Pinia      Vue+Pinia         NO Pinia
            │            │              │           browser.alarms
            └────────────┴──────────────┘                 │
             appStoreSyncPlugin (auto-wired once)          │
             ├── loadTabsHistory()  on first use           │
             ├── initStorageSync()  →  $patch()     loadAndMarkTabs()
             └── $dispose()         →  unwatch()    → tabStorageItem
                                                       .setValue()
```

**The rule: `browser.storage.local` is the only shared memory between isolated VMs.  
Background writes → `storage.onChanged` fires in every open context → Pinia `$patch()` → Vue reactivity.**

---

## Why MV3 Makes Cross-Context State Hard

In Manifest V3 every browser extension context runs in a **completely separate JavaScript VM**:

| Context | Pinia instance | Lifetime |
|---|---|---|
| Background service worker | ❌ none | Suspends after ~**30s idle** |
| Popup | ✅ fresh on each open | Lives while popup window is open |
| Options page | ✅ fresh on each open | Lives while the tab is open |
| Content script | ✅ fresh per page | Lives with the hosting page |

This means **you cannot share a Pinia store between popup and options**. They are different processes. If the popup calls `tabStore.groupTabsByAge()` and the options page is open simultaneously, options has no idea — unless the change is persisted to `browser.storage.local` and options is listening.

The background service worker is even more restrictive: **it suspends automatically after ~30 seconds of inactivity** (MV3 spec). `setInterval` is unreliable — the timer simply stops running when the worker suspends.

> **WXT official docs on background workers:**
> *"Service workers can be suspended at any time. Use `browser.alarms` for periodic work instead of `setInterval`."*  
> — [wxt.dev](https://wxt.dev)

This extension uses `browser.alarms` exclusively for periodic work:

```typescript
// background.ts
browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, {
    periodInMinutes: 24 * 60,   // 24h — survives service worker suspension
})
browser.alarms.onAlarm.addListener((alarm) => {
    BackgroundTabService.loadAndMarkTabs()
})
```

---

## The WXT Storage Pattern

Instead of trying to share in-memory state (impossible), we treat `browser.storage.local` as the **message bus**. Any write triggers `storage.onChanged` in every open context instantly.

### `storage.defineItem` — typed, per-key, zero boilerplate

WXT wraps raw `browser.storage` with TypeScript types and a clean per-key `watch()` API:

> **WXT official docs:**
> *"Writing the key and type parameter for the same key over and over again can be annoying. As an alternative, you can use `storage.defineItem` to create a 'storage item'. Storage items contain the same APIs as the `storage` variable, but you can configure its type, default value, and more in a single place."*  
> — [wxt.dev/storage.html](https://wxt.dev/storage.html)

```typescript
// src/utils/tabStorage.ts
import { storage } from '#imports'
import type { TabsSnapshot } from '@/models/tabs/TabsSnapshot'

export const tabStorageItem = storage.defineItem<TabsSnapshot | null>(
    'local:tab_history',
    { fallback: null },
)
```

One file. One key string. Fully typed everywhere:

```typescript
// Write from any context (popup, options, background)
await tabStorageItem.setValue(snapshot)

// Read once (hydration on startup)
const snapshot = await tabStorageItem.getValue()

// React to changes from any other context
const unwatch = tabStorageItem.watch((newSnapshot) => {
    store.$patch({ tabs: newSnapshot.tabs, isGrouped: newSnapshot.isGrouped })
})
unwatch()  // call to stop watching
```

> **WXT official docs on watchers:**
> *"To listen for storage changes, use the `storage.watch` function. It lets you set up a listener for a single key... To remove the listener, call the returned `unwatch` function."*  
> — [wxt.dev/storage.html](https://wxt.dev/storage.html)

---

## Pinia Plugin — Szczegółowy Lifecycle

### Rejestracja (raz per kontekst, sync przed mount)

```
AppBootstrapper.initUI()
  ├── const pinia = createPinia()
  ├── pinia.use(appStoreSyncPlugin)   ← rejestruje plugin w mapie pluginów Pini
  └── app.use(pinia)                  ← instaluje Pinię w Vue app

  Plugin NIE odpala w tym momencie. Czeka na pierwszy useTabStore().
```

### Pierwsze useTabStore() (raz per instancja Pini — singleton)

```
Komponent wywołuje useTabStore()
  └── Pinia sprawdza: czy store 'tabStore' już istnieje?
       ├── TAK → zwraca istniejącą instancję (zero overhead)
       └── NIE → tworzy nową instancję, wywołuje WSZYSTKIE zarejestrowane pluginy

  appStoreSyncPlugin({ store, app, pinia, options }) {
      // store.$id === 'tabStore' → dalej

      // KROK A: Hydratacja
      store.loadTabsHistory()           // async, non-blocking
        tabStorageItem.getValue()       // czyta 'local:tab_history'
        → this.tabs = restoredTabs      // ClassifiedTab[] z zachowaniem ageIndex itp.
        → this.isGrouped = ...          // odtwarza stan grupowania

      // KROK B: Watcher
      const unwatch = store.initStorageSync()
        tabStorageItem.watch(snapshot => {
            this.$patch({ tabs, isGrouped })
        })
        // Każdy setValue() z DOWOLNEGO kontekstu → ten callback

      // KROK C: Dispose override
      store.$dispose = () => {
          unwatch()        // ← odrejestruje storage.onChanged listener
          originalDispose()
      }
  }
```

### ⚡ Kluczowy flow — każda mutacja propaguje do wszystkich kontekstów

```
np. user klika "Group tabs" w popup:

  this.isGrouped = true                 ← sync, lokalna Vue reactivity (instant)
  tabStorageItem.setValue(snapshot)     ← async write to storage
    ↓
  storage.onChanged fires w WSZYSTKICH otwartych kontekstach jednocześnie
    ↓
  tabStorageItem.watch callback w każdym kontekście (popup, options, content)
    ↓
  this.$patch({ isGrouped: true })
    ↓
  Vue re-renders wszędzie jednocześnie ✅
  options: "Group by age" → "Ungroup"
  popup:   "Group tabs"   → "Ungroup"
```

> **To jest serce architektury.** Nie ma żadnej "komunikacji" między kontekstami —
> każdy kontekst pisze do storage i każdy kontekst reaguje na zapisy.
> `browser.storage.local` jest jedynym shared memory między izolowanymi VM-ami MV3.

### Kiedy `$dispose` jest wywoływane?

| Kontekst | Co się dzieje | `$dispose` potrzebny? |
|---|---|---|
| **popup zamknięty** | Cała VM JS niszczona przez przeglądarkę → GC | ❌ nie |
| **options tab zamknięty** | j.w. | ❌ nie |
| **content script invalidated** (extension update/disable) | Strona żyje, script martwy | ✅ TAK — bez tego `storage.onChanged` listener żyje dalej (memory leak) |

**`$dispose` ≠ odinstalowanie rozszerzenia.** Uninstall/disable obsługuje `ExtensionCleanupService` w `background.ts` (usuwa L-brackety, rozgrupowuje, czyści storage).

---

## The Pinia Plugin — Auto-Sync Every Context

Every Vue context boots a fresh Pinia instance. Without centralisation, every `App.vue` had to manually wire storage sync:

```typescript
// ❌ Old: duplicated identically in popup, options, content — fragile
onMounted(async () => {
    await tabStore.loadTabsHistory()         // hydrate from storage
    unsubscribe = tabStore.initStorageSync() // start watching
})
onUnmounted(() => unsubscribe?.())           // stop watching
```

Forget it once → that context is permanently desync'd.

**Solution: a Pinia plugin, registered once in `AppBootstrapper`.** Pinia plugins run automatically when a store with the matching `$id` is first instantiated — in any context, with zero component-level code.

```typescript
// src/stores/appStoreSyncPlugin.ts
export const appStoreSyncPlugin: PiniaPlugin = (context) => {
    if (context.store.$id !== 'tabStore') return

    const store = context.store as TabStore

    // 1. Hydrate from storage — non-blocking so UI renders immediately
    store.loadTabsHistory().catch(console.warn)

    // 2. Watch for writes from any other context (background, popup, options)
    const unwatch = store.initStorageSync()

    // 3. Clean up the watcher on store disposal
    //    Critical for content scripts — the page lives on but the script can be removed
    const originalDispose = store.$dispose.bind(store)
    store.$dispose = () => { unwatch(); originalDispose() }
}
```

Registered once in the shared bootstrapper:

```typescript
// src/entrypoints/shared/AppBootstrapper.ts
const pinia = createPinia()
pinia.use(appStoreSyncPlugin)   // ← one line. covers popup + options + content.
app.use(pinia)
```

**Result**: no component ever calls `loadTabsHistory()` or `initStorageSync()`. They just use the store. Adding a new UI context in the future costs zero sync boilerplate.

---

## Tab Age Classification

| Category | Default threshold | Overlay colour |
|---|---|---|
| 🟢 Fresh | < 7 days | none |
| 🟡 Young | 7–13 days | `#ffd740` saturated yellow |
| 🟠 Middle | 14–20 days | `#ff6d00` deep orange |
| 🔴 Old | 21+ days | `#ff1744` alarm red |

Thresholds are configurable live in the Options page and persisted to storage.

The **L-bracket favicon** is rendered via `OffscreenCanvas` (available in MV3 service workers), injected via `browser.scripting.executeScript`, and automatically reverts when you click the tab.

---

## Persisted State Shape

```typescript
// src/models/tabs/TabsSnapshot.ts
class TabsSnapshot {
    readonly tabs: Tabs.Tab[]      // ClassifiedTab[] with isMarked, ageIndex, markedFaviconDataUrl
    readonly isGrouped: boolean    // whether Chrome tab groups are active
    readonly savedAt: string       // ISO timestamp
}
```

Every mutation in `TabStore` calls `_persist()`:

```typescript
async _persist(): Promise<void> {
    const snapshot = new TabsSnapshot(this.tabs, this.isGrouped, new Date().toISOString())
    await tabStorageItem.setValue(snapshot)   // → fires storage.onChanged → $patch in all contexts
}
```

---

## Full Data Flows

### User clicks "Group Tabs" in Popup

```
click → tabStore.groupTabsByAge()
      → chrome.tabs.group({ tabIds })  ×3 age groups in the browser
      → this.isGrouped = true
      → this._persist()
          → tabStorageItem.setValue({ tabs, isGrouped: true })
              → storage.onChanged fires in ALL open contexts
                  → appStoreSyncPlugin watch callback
                      → store.$patch({ isGrouped: true })
                          → Vue re-renders
                              options page btn: "Group by age" → "Ungroup" ✅
                              popup btn label:  "Group tabs"   → "Ungroup" ✅
```

### Background alarm fires (every 24h)

```
browser.alarms → BackgroundTabService.loadAndMarkTabs()
    → browser.tabs.query()                         # all current-window tabs
    → AgeClassification.fromDays() per tab
    → TabDots.renderLBracketDataUrl() OffscreenCanvas
    → browser.scripting.executeScript()            # injects overlay into page DOM
    → preserve existing isGrouped from storage
    → tabStorageItem.setValue(snapshot)
        → storage.onChanged
            → appStoreSyncPlugin.watch
                → $patch(fresh tabs)               # popup + options + content update ✅
```

---

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts           # Service worker — alarms + tab events. NO Pinia.
│   ├── popup/                  # Quick controls: Load & Mark, Group tabs
│   ├── options/                # Full management: table, thresholds, mock tabs
│   ├── content/                # Per-page overlay (future: age badge on page)
│   └── shared/
│       └── AppBootstrapper.ts  # Vue + Pinia (with appStoreSyncPlugin) + Quasar
├── stores/
│   ├── TabStore.ts             # All tab mutations, _persist() on every write
│   ├── appStoreSyncPlugin.ts   # Pinia plugin — auto hydrate + watch per context
│   └── globalStore.ts          # Thresholds, version, persisted settings
├── utils/
│   └── tabStorage.ts           # WXT defineItem — single typed key 'local:tab_history'
├── services/
│   ├── BackgroundTabService.ts # Background-only tab logic (no Pinia)
│   ├── TabDots.ts              # OffscreenCanvas L-bracket favicon renderer
│   └── StorageService.ts       # Low-level storage wrapper (globalStore uses this)
└── models/
    ├── tabs/
    │   ├── ClassifiedTab.ts    # Tabs.Tab + isMarked, ageIndex, markedFaviconDataUrl
    │   ├── TabsSnapshot.ts     # Persisted shape: { tabs, isGrouped, savedAt }
    │   ├── TabRow.ts           # Display model for q-table rows
    │   └── AgeClassification.ts # fromDays() → color/cssClass/isFresh/isOld
    └── AppThresholds.ts        # Value object: young/middle/old day thresholds

test/
├── unit/                       # Vitest + jsdom — fast, mocked browser APIs
└── playwright/                 # Playwright + real Chromium — real extension, no mocks
```

---

## Development

```bash
# Install + download Playwright Chromium
npm install

# Dev server (Chromium with HMR)
npm run dev

# Dev server (Firefox)
npm run dev:firefox

# Production build (Chrome MV3 + Firefox MV3)
npm run build

# Package for publishing
npm run zip
```

**Requirements:** Node.js ≥ 22

### Generate mock tabs for testing

Options page → **Mock tabs** button.

Creates 8 real browser tabs with spoofed `lastAccessed` timestamps spanning all age categories (1d → 25d). Calling it multiple times **adds** tabs — existing ones are untouched. This lets you build up a realistic dataset including intentional URL duplicates (e.g. multiple YouTube tabs at different ages).

---

## Testing

```bash
npm run test:unit              # Vitest, jsdom, mocked browser
npm run test:unit:watch        # watch mode
npm run test:playwright:chromium  # real Chromium + real extension
npm run test                   # both suites
npm run ci                     # type-check + unit + build
```

| | Vitest (unit) | Playwright (E2E) |
|---|---|---|
| Speed | ⚡ ~3s | 🐢 30–60s |
| Browser | jsdom (simulated) | **Real Chromium** |
| `browser.*` APIs | `vi.mock` | Real browser APIs |
| Use for | Logic, stores, components | Extension lifecycle, real behaviour |

> Playwright with a real extension load is the only way to verify `browser.storage.onChanged`, `executeScript` favicon injection, and service worker startup actually work end-to-end.

---

## Key Architectural Rules

| Rule | Reason |
|---|---|
| **Background has no Pinia** | Isolated VM — any store created there is invisible to popup/options |
| **No `setInterval`** | MV3 service workers suspend after ~30s; use `browser.alarms` |
| **Every mutation calls `_persist()`** | The only cross-VM communication channel is storage writes |
| **`appStoreSyncPlugin` owns hydration + watch** | Components never call `loadTabsHistory()` or `initStorageSync()` directly |
| **`tabStorageItem` owns the key string** | `'local:tab_history'` exists in exactly one file — zero magic strings |
| **`type` not `interface`** | Interfaces leak structural subtyping surprises; `type` is explicit |
| **No destructuring** | `const { x } = obj` → `obj.x` — explicit, grep-safe, refactor-safe |

---

## Browser Compatibility

| Browser | Support | Notes |
|---|---|---|
| Chrome / Chromium | ✅ Primary | MV3, full Playwright E2E |
| Firefox | ✅ Secondary | MV3 (Gecko), `chrome.tabGroups` API not available → grouping disabled gracefully |
| Edge | ✅ | Chromium-based, same as Chrome |
