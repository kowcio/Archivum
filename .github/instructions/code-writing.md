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
