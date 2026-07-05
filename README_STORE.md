# Storage & Communication Architecture

## Overview

This extension uses **`browser.storage.local`** as the single shared state between the background service worker and UI contexts (popup, options).

**Rule**: Background writes, UI reads. Never the other way.

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      background.ts                          │
│  (service worker — NO Pinia, NO Vue)                       │
│                                                             │
│  appStateStorage.setValue()  ← writes to browser.storage    │
│  mockOverrides.setValue()    ← debug/test only              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ browser.storage   │
              │   .local          │
              └────────┬──────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               UI — Popup / Options                          │
│  (Vue 3 + Pinia / useAppStore composable)                  │
│                                                             │
│  useAppStore().load()    ← reads from browser.storage       │
│  storage.onChanged       ← reactive auto-sync (watch)      │
└─────────────────────────────────────────────────────────────┘
```

## Reading State (UI → Storage)

**No message passing needed.** Vue components call `useAppStore()` which reads directly from `browser.storage.local`:

```typescript
// In any Vue component (popup, options)
const { thresholds, loading, error } = useAppStore()

// thresholds is reactive — updates automatically when storage changes
```

The store calls `appStateStorage.getValue()` to read and sets up a `watch()` listener that reactively updates the Vue refs whenever the background writes new data.

## Writing State (Background → Storage)

Background services write directly to storage using WXT's `storage.defineItem()`:

```typescript
import { appStateStorage } from '@/store/appStore'

// Background writes
await appStateStorage.setValue({
  thresholds: { levels: [...], activeLevels: 3 },
  configLastUpdated: Date.now(),
  version: '1.0.0',
})
```

## Triggering Background Actions (UI → Background Message)

The **only** case that requires `chrome.runtime.sendMessage` is when the UI needs to **trigger** the background to *do* something (group tabs, create mock tabs, etc.):

```typescript
// UI sends a message to trigger background action
const response = await browser.runtime.sendMessage({
  action: BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE,
})
```

The background handles these in `browser.runtime.onMessage.addListener()` and writes results to storage — the UI then picks them up reactively via the watch listener.

### Available Message Actions

| Action | Description |
|---|---|
| `GROUP_TABS_BY_AGE` | Run tab grouping algorithm |
| `GROUP_TABS_BY_DOMAIN` | Sort existing groups by domain |
| `UNGROUP_ALL_TABS` | Remove all tab groups |
| `CREATE_MOCK_TABS` | Create test tabs (E2E only) |
| `GET_TABS` | Get all current tabs |
| `ON_TAB_ACTIVATED` | Simulate tab activation |
| `HAS_PLUGIN_GROUPS` | Check if groups exist |
| `CLOSE_TAB` | Close a specific tab |
| `setMockOverrides` | Set age overrides for test tabs |

## Storage Items (defined via WXT `storage.defineItem`)

| Key | Type | Description |
|---|---|---|
| `local:appState` | `AppState` | Main config: thresholds, activeLevels, version |
| `local:mock_overrides` | `Record<number, number>` | Tab ID → lastAccessed timestamps (testing only) |

## Vue Composables vs Background

| Context | What to use |
|---|---|
| **Vue component** (popup, options) | `useAppStore()` — reactive, auto-syncs |
| **Background service** (background.ts, services) | `getStorageThresholds()` or direct `appStateStorage.getValue()` |

## Key Files

| File | Role |
|---|---|
| `src/store/appStore.ts` | Storage definitions + Vue `useAppStore()` composable |
| `src/entrypoints/background.ts` | Message listener + alarm handlers |
| `src/models/AppThresholds.ts` | Business logic class for thresholds |
| `src/models/ThresholdState.ts` | Plain interface for storage (WXT-compatible) |

## Reactive Sync (Watch)

When the background writes to storage, the UI picks up changes automatically:

```typescript
// Inside useAppStore() — set up once on mount
appStateStorage.watch((newState) => {
  if (newState.configLastUpdated === configLastUpdated.value) return // dedup
  thresholds.value = new AppThresholds(levels, activeLevels)
  configLastUpdated.value = newState.configLastUpdated
})
```

No polling, no messages needed — `storage.onChanged` fires automatically.