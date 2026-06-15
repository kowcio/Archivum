---
applyTo:
  - "src/components/**/*.vue"
  - "src/stores/**/*.ts"
  - "src/services/**/*.ts"
  - "src/models/**/*.ts"
  - "src/entrypoints/**/*.ts"
---

# Code Rules (auto-applied)

## File → Pattern

| File | Pattern |
|---|---|
| `background.ts` | `defineBackground()`, sync main, `browser.alarms` only, NO Pinia |
| `entrypoints/*/App.vue` | `loadTabsHistory()` then `initStorageSync()` in `onMounted` |
| `components/*.vue` | typed props/emits, no direct store mutation |
| `stores/*.ts` | `type State`, `loading` + `error: string\|null`, `try/catch/finally` |
| `services/*.ts` | static class, no Vue/Pinia imports |
| `models/**/*.ts` | `type` (not `interface`), factory static methods |
| `content/*.ts` | `ctx.addEventListener`, `ctx.isValid`, `ctx.onInvalidated` |

## Always

```ts
// ✅
import browser from 'webextension-polyfill'
export type State = { items: T[]; loading: boolean; error: string | null }
catch (err) { this.error = err instanceof Error ? err.message : 'Unknown error' }
obj.x  // not const { x } = obj

// ❌
chrome.*  |  interface  |  any  |  setInterval  |  localStorage  |  const { x } = obj
Options API  |  Pinia in background.ts  |  inline style=""  |  uncaught promises
```

## Storage Sync Pattern (all tab-displaying components)

```ts
let unsubscribeStorageSync: (() => void) | null = null
onMounted(async () => {
  await global.init()
  await tabStore.loadTabsHistory()        // must come first (crash recovery)
  unsubscribeStorageSync = tabStore.initStorageSync()
})
onUnmounted(() => { unsubscribeStorageSync?.() })
```
