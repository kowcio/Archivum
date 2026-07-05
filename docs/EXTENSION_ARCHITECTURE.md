# Browser Extension Architecture Guide — WXT Native Approach

## Overview

This document explains how the Czynsz Firefox/Chrome extension loads, initializes services, and manages the lifecycle of tab tracking, marking, and cleanup operations using **WXT Framework native patterns**.

**Key Principles**:
1. **Distributed initialization** — each entry point independently initializes Pinia
2. **Synchronous main()** — background service worker main() MUST be synchronous per WXT/MV3 requirements
3. **browser.alarms** — used for persistent periodic tasks (survives service worker suspension)
4. **Event-driven** — listeners registered inside main() for MV3 compliance

---

## Entry Points & Initialization Flow

```
Browser Launch with Extension Enabled
    │
    ├─ [BACKGROUND SERVICE WORKER] background.ts → defineBackground() main
    │  ├─ ✅ SYNCHRONOUS main() function
    │  │  ├─ AppBootstrapper.initBackground() [async in background, chained]
    │  │  │  └─ Creates Pinia store
    │  │  │  └─ useGlobalStore() initializes (loads thresholds)
    │  │  ├─ ExtensionCleanupService.registerLifecycleListeners()
    │  │  │  └─ browser.runtime.onInstalled listener
    │  │  └─ browser.alarms.create('daily-tab-update') [WXT NATIVE]
    │  │
    │  └─ 📡 EVENT LISTENERS (inside main)
    │     ├─ browser.alarms.onAlarm → Triggers daily tab update
    │     ├─ browser.runtime.onMessage → Inter-context messaging
    │     └─ [ExtensionCleanupService internal listeners]
    │
    ├─ [POPUP] popup/main.ts → AppBootstrapper.initUI()
    │  └─ Vue + Pinia + Quasar initialized when user clicks popup icon
    │
    ├─ [OPTIONS PAGE] options/main.ts → AppBootstrapper.initUI()
    │  └─ Vue + Pinia + Quasar initialized when user opens settings
    │
    └─ [CONTENT SCRIPT] content/index.ts → defineContentScript() with ctx
       └─ Vue + Pinia on every page matching manifest content_scripts patterns
```

---

## Detailed Lifecycle: Native WXT Patterns

### 1. Extension Installation / Enable — Background.ts

**When**: User installs extension or enables it in browser settings

**Entry Point**: `background.ts` (defineBackground)

**Key Constraint**: ⚠️ **main() MUST be SYNCHRONOUS**

```typescript
export default defineBackground(() => {
  // ✅ Synchronous code here runs immediately

  // ❌ CANNOT do: await something here
  // ✅ CAN do: start async work with .then().catch()
  
  AppBootstrapper.initBackground()  // Returns Promise
    .then(() => console.log('Ready'))
    .catch(err => console.error('Failed', err))
  
  // ✅ Event listeners MUST be registered inside main()
  browser.alarms.onAlarm.addListener(async (alarm) => {
    // Async work is OK inside listener
  })
})
```

**What Happens**:

1. **WXT builds manifest automatically** from `defineBackground()` entry point
2. **Service worker loads** (MV3 background type)
3. **main() executes synchronously**:
   - ✅ AppBootstrapper.initBackground() [async chain starts]
   - ✅ ExtensionCleanupService.registerLifecycleListeners() [sync]
   - ✅ browser.alarms.create() [sync, persists across SW suspension]
   - ✅ Event listener registrations [sync]
4. **Pinia store initializes asynchronously** (in background of async chain)
5. **Everything ready** for subsequent events/alarms/messages

---

### 2. Daily Tab Update — WXT browser.alarms (Native)

**Problem with setInterval**:
- ❌ Service Worker can suspend (freeze) when unused
- ❌ setInterval is paused when SW suspends
- ❌ Periodic task becomes unreliable

**Solution: browser.alarms (WXT native)**:
- ✅ Registered with browser OS, not JS runtime
- ✅ Persists across service worker suspend/resume
- ✅ Browser automatically wakes up on alarm
- ✅ Simple, reliable, performance-efficient

**Implementation** (in background.ts):

```typescript
// Register alarm (synchronous, call once at startup)
browser.alarms.create('daily-tab-update', {
  periodInMinutes: 24 * 60,  // Every 24 hours
})

// Listen for alarm (async handler)
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-tab-update') {
    const tabStore = useTabStore()
    await tabStore.getAllOpenedTabs()  // Load fresh tabs
    await tabStore.markOldTabs()        // Auto-mark old tabs
  }
})
```

**Alarm Lifecycle**:

```
Initial Setup (background.ts main)
    ↓
browser.alarms.create() [Persistent with browser]
    ↓
[24 hours pass]
    ↓
Browser fires onAlarm event
    ↓
Service Worker wakes up + executes async listener
    ↓
tabStore.getAllOpenedTabs() + markOldTabs()
    ↓
Completes, Service Worker suspends
    ↓
[24 hours pass]
    ↓
[Repeat]
```

**Why No TabUpdateService.startDailyUpdate()?**

The old `TabUpdateService` used `setInterval()`:
```typescript
// ❌ OLD PATTERN (unreliable)
const intervalId = setInterval(async () => {
  await tabStore.getAllOpenedTabs()  // Paused when SW suspends
}, 24 * 60 * 60 * 1000)
```

**✅ NEW WAY (WXT native)**: Use `browser.alarms` directly in background.ts

---

### 3. Extension Cleanup Service Lifecycle

**Purpose**: Cleans up L-bracket overlays and grouped tabs when extension is disabled or uninstalled

**When It Runs**:
```
On Extension Install (optional cleanup)
    ↓
Extension Updated
    ↓
Manual Reset → "Reset" button click in Options page
```

**How It Works** (`ExtensionCleanupService.registerLifecycleListeners()`):

```typescript
// Registered inside background.ts main()
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // New install — no cleanup needed
  } else if (details.reason === 'update') {
    // Extension updated — run compatibility cleanup
    clearMarkedTabsRegistry()
  }
})
```

**Key Implementation Detail**:

```typescript
async reset(): Promise<void> {
  // CRITICAL: Query ALL current browser tabs (not just store.tabs)
  // This ensures stale/replaced tabs are also cleaned up
  const allTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
  
  // Remove L-bracket from EVERY tab
  await Promise.all(
    allTabs.map(async (tab) => {
      if (tab.id == null) return
      await this.removeLBracket(tab.id)
    }),
  )
  
  // Restore store state
  this.tabs = ClassifiedTabFactory.fromTabs(allTabs)
  this.isGrouped = false
}
```

---

## AppBootstrapper: Centralized Initialization

**Location**: `src/entrypoints/shared/AppBootstrapper.ts`

**Purpose**: Factory for initializing Vue + Pinia consistently across contexts

### `AppBootstrapper.initUI(options)` — For UI contexts

- **Used by**: `popup/main.ts`, `options/main.ts`, `content/index.ts`
- **Creates**: Vue + Pinia + Quasar
- **Returns**: `{ app: VueApp, pinia: Pinia }`
- **Flow**:
  1. Create Vue app instance
  2. Register Quasar components
  3. Create Pinia store
  4. Initialize GlobalStore (load thresholds)
  5. Mount to DOM

### `AppBootstrapper.initBackground()` — For background worker

- **Used by**: `background.ts`
- **Creates**: Pinia only (no Vue, no DOM)
- **Returns**: `{ pinia: Pinia }`
- **Flow**:
  1. Create Pinia store
  2. Initialize GlobalStore async (loads thresholds from storage)
  3. Return pinia (ready for services to use)

---

## State Management: Pinia Stores

### `useGlobalStore()`
- **Responsibility**: Global thresholds (Young/Middle/Old boundaries)
- **Load Trigger**: On `AppBootstrapper.init()`
- **Persistence**: `browser.storage.local`

### `useTabStore()`
- **Responsibility**: Open tabs, marking state, grouping state
- **State**:
  ```typescript
  tabs: ClassifiedTab[]              // Current tabs with marking/age
  loading: boolean                   // Is update in progress?
  error: string | null               // Error message if any
  isGrouped: boolean                 // Are tabs currently grouped?
  ```
- **Key Actions**:
  - `getAllOpenedTabs()` — Load from browser + auto-mark old
  - `markOldTabs()` — Apply L-bracket to aged tabs
  - `markTabWithLBracket(tabId)` — Mark single tab
  - `groupTabsByAge()` — Create Chrome tab groups
  - `reset()` — Clean up all overlays

---

## Services Lifecycle

### `ExtensionCleanupService` (Event-driven)
- **Registered**: Once in `background.ts` main
- **Listens to**:
  - `browser.runtime.onInstalled` → Compatibility cleanup
  - (Uninstall/disable handled by browser automatically)
- **Not continuously running** — Only reacts to events

### Tab Update (browser.alarms — WXT native)
- **Registered**: Once via `browser.alarms.create()` in background.ts
- **Trigger**: `browser.alarms.onAlarm` listener
- **Interval**: 24 hours (periodInMinutes)
- **Action**: `tabStore.getAllOpenedTabs()` + `markOldTabs()`
- **Survives**: Service worker suspension (browser OS manages it)

### `TabDots` (Favicon Overlay Service)
- **Purpose**: Apply/remove L-bracket SVG overlays on favicons
- **Methods**:
  - `fetchFaviconDataUrl(tabId)` — Pre-fetch favicon as data URL
  - `applyLBracketPageScript` — Inject script to modify DOM
  - `removeLBracketPageScript` — Inject script to restore favicon
- **Execution**: Inside `browser.scripting.executeScript({ func: ... })`
- **When Used**:
  - Applied: `TabStore.markTabWithLBracket()` calls this
  - Removed: `TabStore.removeLBracket()` calls this

---

## Data Flow Example: "Load Tabs" Button Click

1. **User** clicks "Load Tabs" in Options page
2. **Options.vue** calls `tabStore.getAllOpenedTabs()`
3. **TabStore** executes:
   ```typescript
   async getAllOpenedTabs() {
     this.loading = true
     
     // 1. Load fresh tabs from browser
     const fetchedTabs = await browser.tabs.query({ currentWindow: true })
     
     // 2. Preserve previous marking state
     const previouslyMarkedIds = new Set(
       this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id!)
     )
     
     // 3. Create ClassifiedTab instances
     this.tabs = ClassifiedTabFactory.fromTabs(fetchedTabs, previouslyMarkedIds)
     
     // 4. Wait for favicons to populate
     await this.waitForFaviconsLoaded(3000)
     
     // 5. Auto-mark old tabs (≥7 days)
     await this.markOldTabs()
     
     this.loading = false
     return this.tabs
   }
   ```
4. **Options.vue** computed `rows` transforms and sorts tabs
5. **Table** renders with L-bracket overlays visible on favicons

---

## WXT Build System

**Automatic Manifest Generation**:

```typescript
// src/entrypoints/background.ts
export default defineBackground(() => { ... })

// ↓ WXT generates in dist/manifest.json:
{
  "background": {
    "service_worker": "background-xxxxx.js",
    "type": "module"
  }
}
```

**No Manual manifest.json Editing** — WXT auto-generates from entrypoints

---

## Storage Persistence

### `browser.storage.local` Keys

| Key | Value | Set By | Read By |
|-----|-------|--------|---------|
| `TAB_HISTORY` | `TabsSnapshot{ tabs: [], savedAt: string }` | Options "Save" button | Options "Load Saved" button |
| `APP_THRESHOLDS` | `{ young: 7, middle: 14, old: 21 }` | Thresholds.vue | GlobalStore |

---

## Error Handling

```typescript
// background.ts async chains
AppBootstrapper.initBackground()
  .then(() => console.log('✅ Ready'))
  .catch((err) => console.error('❌ Failed:', err))

// Alarm listeners
browser.alarms.onAlarm.addListener(async (alarm) => {
  try {
    await tabStore.getAllOpenedTabs()
  } catch (err) {
    console.error('[alarm] Update failed:', err)
  }
})
```

---

## Summary: WXT Native vs Old Patterns

| Aspect | Old Pattern | WXT Native | Benefit |
|--------|-----------|-----------|---------|
| **Periodic Tasks** | `setInterval()` via TabUpdateService | `browser.alarms` | ✅ Survives SW suspension |
| **main() Async** | ❌ Not allowed in MV3 | ✅ main() sync, async via .then().catch() | ✅ MV3 compliant |
| **Event Listeners** | Outside main() | Inside main() | ✅ MV3 compliant, correctly scoped |
| **Manifest** | Manual JSON | Auto-generated from entrypoints | ✅ Less error-prone |
| **Service Import** | TabUpdateService in background | Inline alarm listener | ✅ Simpler, native |

---

## References

- **WXT Framework**: https://wxt.dev/ (Entrypoints, background, content scripts)
- **browser.alarms API**: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms
- **Pinia**: https://pinia.vuejs.org/ (Store pattern, reactive state)
- **WebExtension API**: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API
- **MV3 Requirements**: https://developer.chrome.com/docs/extensions/mv3/service_workers/

