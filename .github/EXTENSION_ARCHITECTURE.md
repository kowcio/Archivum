# Browser Extension Architecture Guide

## Overview

This document explains how the Czynsz Firefox/Chrome extension loads, initializes services, and manages the lifecycle of tab tracking, marking, and cleanup operations.

**Key Principle**: Distributed initialization — each entry point (background, popup, options, content) independently initializes its own Pinia store via `AppBootstrapper`, ensuring no global singleton state.

---

## Entry Points & Initialization Flow

```
Browser Event (Install/Enable/Open)
    ├─ background.ts [ALWAYS RUNS]
    │  ├─ AppBootstrapper.initBackground() → Creates Pinia store
    │  ├─ ExtensionCleanupService.registerLifecycleListeners()
    │  └─ TabUpdateService.startDailyUpdate(24h)
    │
    ├─ popup/main.ts [RUNS when extension popup opened]
    │  └─ AppBootstrapper.initUI(App, '#app') → Vue + Pinia + Quasar
    │
    ├─ options/main.ts [RUNS when options page opened]
    │  └─ AppBootstrapper.initUI(AppOptions, '#app') → Vue + Pinia + Quasar
    │
    └─ content/main.ts [RUNS on every page matching manifests content_scripts]
       └─ AppBootstrapper.initUI(App, container) → Vue + Pinia (no Quasar)
```

---

## Detailed Lifecycle

### 1. Extension Installation / Enable

**When**: User installs extension or enables it in browser settings

**What Runs**:
1. **`background.ts`** entry point executes `defineBackground()` main function
   - ⏱️ **Timing**: Synchronous (main() cannot be async)
   -  **Actions**:
     ```typescript
     // Initialize Pinia store for background context (non-UI)
     AppBootstrapper.initBackground()
     
     // Register lifecycle listeners (cleanup on disable/uninstall)
     ExtensionCleanupService.registerLifecycleListeners()
     
     // Start background task: refresh tabs every 24 hours
     TabUpdateService.startDailyUpdate(24 * 60 * 60 * 1000)
     ```

2. **`AppBootstrapper.initBackground()`**
   - Creates Pinia store instance
   - Initializes `useGlobalStore()` (loads thresholds from storage)
   - Starts async `global.init()` (loads user settings)
   - Returns `{ pinia }` (no Vue app — background has no DOM)

---

### 2. Extension Cleanup Service Lifecycle

**Purpose**: Cleans up L-bracket overlays and grouped tabs when extension is disabled or uninstalled

**When It Runs**:
```
On Extension Disable
    ↓
On Extension Uninstall
    ↓
Manual Reset → button click in Options page
```

**How It Works** (`ExtensionCleanupService.registerLifecycleListeners()`):

```typescript
// Called once during background.ts initialization
browser.runtime.onDisabled.addListener(async () => {
  // 1. Remove all L-bracket overlays from ALL tabs
  await tabStore.reset()
  
  // 2. Ungroup all tab groups (Chrome-only)
  // 3. Restore original favicons
  // 4. Clear all storage
})

browser.runtime.onUninstalled.addListener(async () => {
  // Same cleanup as onDisabled
  await tabStore.reset()
  await browser.storage.local.clear()
})
```

**Flow**:
1. User disables/uninstalls extension
2. Browser fires `browser.runtime.onDisabled` / `browser.runtime.onUninstalled`
3. `TabStore.reset()` is called:
   - Queries ALL current browser tabs: `browser.tabs.query({ currentWindow: true })`
   - Removes L-bracket overlay from each tab via `TabStore.removeLBracket(tabId)`
   - Executes `TabDots.removeLBracketPageScript` via `browser.scripting.executeScript`
   - Restores tab to original favicon
   - Clears `isMarked: true` flag in store
4. Ungroups any tab groups (Chrome-only, Firefox fails silently)
5. Clears all extension storage

**Key Implementation Detail**:
```typescript
async reset(): Promise<void> {
  // CRITICAL: Always query current browser tabs, not just store.tabs
  // This ensures stale/replaced tabs are also cleaned up
  const allTabs: Tabs.Tab[] = await browser.tabs.query({ currentWindow: true })
  
  // Remove L-bracket from EVERY tab (not just store.tabs)
  await Promise.all(
    allTabs.map(async (tab) => {
      if (tab.id == null) return
      await this.removeLBracket(tab.id)
    }),
  )
  
  // Reload store with fresh tab list (no stale marks)
  const freshTabs = await browser.tabs.query({ currentWindow: true })
  this.tabs = ClassifiedTabFactory.fromTabs(freshTabs)
  this.isGrouped = false
}
```

---

### 3. Tab Update Service — Daily Background Refresh

**Purpose**: Automatically refresh tab list and update age-based markings every 24 hours without user interaction

**When It Runs**:
```
Background.ts init (one-time)
    ↓
Immediately: TabUpdateService.startDailyUpdate(24h)
    ↓
[Waits 24 hours]
    ↓
Minute 1 of Cycle: Calls TabStore.getAllOpenedTabs()
    ├─ Queries browser.tabs.query({currentWindow: true})
    ├─ Preserves `isMarked` state for previously marked tabs (by ID)
    ├─ Waits for favicons to load (~3 seconds timeout)
    └─ Auto-marks old tabs (≥Young threshold)
    ↓
[Waits 24 hours again]
```

**Implementation** (`TabUpdateService.ts`):

```typescript
export default class TabUpdateService {
  private static readonly UPDATE_INTERVAL_KEY = 'tab-update-interval-id'
  
  public static startDailyUpdate(intervalMs: number): void {
    // Create interval that calls TabStore.getAllOpenedTabs() every 24h
    // This method:
    // 1. Loads all open tabs from browser
    // 2. Preserves marking state for tabs that were already marked
    // 3. Waits for favicons to load
    // 4. Auto-marks tabs older than YOUNG threshold
    
    const intervalId = setInterval(async () => {
      try {
        const tabStore = useTabStore()
        await tabStore.getAllOpenedTabs()
        console.log('[TabUpdateService] ✅ Daily update completed')
      } catch (err) {
        console.error('[TabUpdateService] Update failed:', err)
      }
    }, intervalMs)
    
    // Store interval ID for potential cleanup
    browser.storage.local.set({ [this.UPDATE_INTERVAL_KEY]: intervalId })
  }
}
```

**Flow Details**:

1. **Interval Setup**: Runs **immediately** after `background.ts` loads
2. **Trigger**: Every 24 hours (24 × 60 × 60 × 1000 ms)
3. **Action**: `tabStore.getAllOpenedTabs()` which:
   - Loads fresh tab list from browser API
   - Merges with previous state (preserves `isMarked` flags for same tab IDs)
   - Waits up to 3 seconds for favicons to populate
   - Calls `markOldTabs()` which:
     - Skips Fresh tabs (index 0 — age 0→Young days)
     - Skips Already marked tabs (prevents L-bracket stacking)
     - Applies L-bracket overlay to newly aged tabs
     - Updates color/classification based on age

4. **Preserve Marking Logic**:
```typescript
// Before reloading tabs, capture which ones are marked
const previouslyMarkedIds = new Set(
  this.tabs.filter(t => t.isMarked && t.id != null).map(t => t.id!)
)

// New tabs preserve their marking state across refresh
this.tabs = ClassifiedTabFactory.fromTabs(freshTabs, previouslyMarkedIds)
```

---

## AppBootstrapper: The Initialization Factory

**Location**: `src/entrypoints/shared/AppBootstrapper.ts`

**Purpose**: Centralized factory for initializing Vue + Pinia in UI contexts, or just Pinia in background

**Two Static Methods**:

### `AppBootstrapper.initUI(options)`
- **Used by**: `popup/main.ts`, `options/main.ts`, `content/main.ts`
- **Creates**: Full Vue + Pinia + Quasar setup
- **Returns**: `{ app: VueApp, pinia: Pinia }`
- **Flow**:
  1. Create Vue app instance
  2. Register Quasar UI components (QTable, QBtn, etc.)
  3. Create Pinia store
  4. Initialize GlobalStore (loads thresholds from storage)
  5. Mount Vue app to DOM element
  
### `AppBootstrapper.initBackground()`
- **Used by**: `background.ts`
- **Creates**: Pinia only (no Vue, no DOM)
- **Returns**: `{ pinia: Pinia }`
- **Flow**:
  1. Create Pinia store
  2. Initialize GlobalStore (async in background)
  3. Services (TabUpdateService, ExtensionCleanupService) use this store

---

## State Management: Pinia Stores

### `useGlobalStore()`
- **Responsibility**: Global thresholds (Young/Middle/Old boundaries)
- **Load Trigger**: On `AppBootstrapper.init()` 
- **Persistence**: Stored in `browser.storage.local`
- **Shared**: All entrypoints create their own instance (no sharing)

### `useTabStore()`
- **Responsibility**: Open tabs, marking state, grouping state
- **State**:
  ```typescript
  tabs: ClassifiedTab[]              // Current open tabs with marking/age
  lastSaveDate: string | null        // When tabs were last saved
  loading: boolean                   // Loading/saving in progress
  error: string | null               // Error message if any
  isGrouped: boolean                 // Are tabs currently grouped by age?
  ```
- **Key Actions**:
  - `getAllOpenedTabs()` — Refresh from browser, mark old tabs
  - `markOldTabs()` — Apply L-bracket to aged tabs
  - `markTabWithLBracket(tabId)` — Mark single tab
  - `groupTabsByAge()` — Create Chrome tab groups
  - `reset()` — Clean up all overlays + groups

---

## Services Lifecycle

### `ExtensionCleanupService`
- **Registered**: Once in `background.ts` main
- **Listeners**:
  - `browser.runtime.onDisabled` → Cleanup
  - `browser.runtime.onUninstalled` → Cleanup
- **Not continuously running** — Only reacts to events

### `TabUpdateService`
- **Started**: Once in `background.ts` main
- **Runs**: Background worker indefinitely
- **Interval**: 24 hours
- **Action**: Calls `tabStore.getAllOpenedTabs()`
- **Continuously running** — Starts interval immediately

### `TabDots` (Favicon Overlay Service)
- **Purpose**: Apply/remove L-bracket SVG overlays on favicons
- **Methods**:
  - `fetchFaviconDataUrl(tabId)` — Pre-fetch favicon as data URL
  - `applyLBracketPageScript` — Inject script to modify DOM (draws L-bracket)
  - `removeLBracketPageScript` — Inject script to restore original favicon
- **Execution**: Inside `browser.scripting.executeScript({ func: ... })`
- **When Used**:
  - Applied: `TabStore.markTabWithLBracket()` calls this
  - Removed: `TabStore.removeLBracket()` calls this

---

## Data Flow Example: "Click Load Tabs" Button

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
     
     // 3. Create ClassifiedTab instances (extends Tabs.Tab with age data)
     this.tabs = ClassifiedTabFactory.fromTabs(fetchedTabs, previouslyMarkedIds)
     
     // 4. Wait for favicons to populate
     await this.waitForFaviconsLoaded(3000)
     
     // 5. Auto-mark tabs older than YOUNG threshold
     await this.markOldTabs()
     
     this.loading = false
     return this.tabs
   }
   ```
4. **Options.vue** computed `rows` transforms tabs into table rows (with sorting)
5. **Table** renders with L-bracket overlays visible on favicons

---

## Dependency Graph

```
browser.ts (WXT Framework)
    ↓
AppBootstrapper.initBackground()
    ├─ Creates Pinia
    ├─ useGlobalStore() initialized
    ├─ ExtensionCleanupService.registerLifecycleListeners()
    └─ TabUpdateService.startDailyUpdate()
         ↓
         useTabStore (lazy init on first use)
         ├─ TabDots service (injected favicons)
         └─ browser.tabs API calls

popup/main.ts OR options/main.ts OR content/main.ts
    ↓
AppBootstrapper.initUI()
    ├─ Creates Vue app
    ├─ Creates Pinia
    ├─ useGlobalStore() initialized
    └─ Mounts Vue component (uses useTabStore, useGlobalStore in composables)
```

---

## Storage Persistence

### `browser.storage.local` Keys

| Key | Value | Set By | Read By |
|-----|-------|--------|---------|
| `TAB_HISTORY` | `TabsSnapshot{ tabs: [], savedAt: string }` | Options "Save" button | Options "Load Saved" button |
| `APP_THRESHOLDS` | `{ young: 7, middle: 14, old: 21 }` | Thresholds.vue slider | GlobalStore |
| `tab-update-interval-id` | `number` (interval ID) | TabUpdateService | (cleanup if needed) |

---

## Error Handling

All services wrap async operations in try/catch:

```typescript
// Background.ts
AppBootstrapper.initBackground()
  .then(() => console.log('[background] ✅ Stores initialized'))
  .catch((err) => console.error('[background] ❌ Store init failed:', err))

// TabUpdateService (inside interval)
try {
  const tabStore = useTabStore()
  await tabStore.getAllOpenedTabs()
} catch (err) {
  console.error('[TabUpdateService] Update failed:', err)
}

// TabStore.reset()
catch (err) {
  this.error = err instanceof Error ? err.message : 'Unknown error'
}
```

---

## Summary Table

| Component | Type | Initializes | Runs | Purpose |
|-----------|------|-------------|------|---------|
| `background.ts` | Entry Point | Services | Continuously | System coordinator |
| `AppBootstrapper` | Factory | Pinia ± Vue | On-demand | Centralized init |
| `ExtensionCleanupService` | Service | Listeners | On disable/uninstall | Cleanup |
| `TabUpdateService` | Service | 24h interval | Every 24h | Auto-refresh tabs |
| `TabStore` | Pinia Store | Via AppBootstrapper | On demand | Tab state mgmt |
| `GlobalStore` | Pinia Store | Via AppBootstrapper | On demand | Thresholds mgmt |

---

## Debugging Tips

### Check if Background is Working
```javascript
// In Extension DevTools Console (background context)
localStorage.getItem('tab-update-interval-id')  // Should exist
```

### Check if Daily Update Triggered
```bash
# Console logs should show:
[TabUpdateService] ✅ Daily update completed  # Every 24h
```

### Check Cleanup Service
```javascript
// Uninstall/disable extension → should see:
[reset] ✅ Clean slate — tabs: <count>
```

### Check Pinia Store State
```javascript
// Options page DevTools → Vue tab → Pinia
// Shows current tabs[], marking state, grouping state
```

---

## References

- **WXT Framework**: https://wxt.dev/ (Entry points, background, content scripts)
- **Pinia**: https://pinia.vuejs.org/ (Store pattern, reactive state)
- **WebExtension API**: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API
- **Chrome Tab Groups**: https://developer.chrome.com/docs/extensions/reference/api/tabGroups (Chrome-only)
