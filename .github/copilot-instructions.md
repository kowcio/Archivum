---
project: "Tab Age Browser Extension"
stack: "WXT 0.20+ · Vue 3.5 · TypeScript 5.8 · Pinia 3 · Quasar 2 · Vitest 4 · Playwright 1.60"
---

# Project Instructions

## Architecture

```
background.ts (service worker — NO Pinia)
  └─ BackgroundTabService.loadAndMarkTabs()
       └─ browser.storage.local  ←─ single shared state
            └─ TabStore.initStorageSync()  ←─ UI contexts react
                 └─ popup / options / content (Pinia + Vue)
```

**Rule**: background writes, UI reads. Never the other way.

## Universal Rules

| Rule | Detail |
|---|---|
| **TypeScript** | `type` (not `interface`), no `any`, no `unknown` leaks |
| **Vue** | `<script setup lang="ts">` only — no Options API |
| **Pinia** | `type State`, `loading` + `error: string \| null` in every store |
| **Browser** | `import browser from 'webextension-polyfill'` — never `chrome.*` |
| **Storage** | `browser.storage.local` via `StorageService` — never `localStorage` |
| **Tests** | Vitest (unit/jsdom) + Playwright (E2E/real Chromium) |
| **UI** | Quasar: `q-btn`, `q-table`, `q-tooltip`; project CSS: `got-*` from `global.css` |
| **No destructuring** | `const { x } = obj` ❌ → use `obj.x` (explicit, grep-safe) |
| **No docs** | Never generate `*.md` files unless explicitly asked |
| **No Pinia in background** | background.ts has no Vue context |
| **No setInterval** | Use `browser.alarms` — service workers suspend ~30s |

## Agents

| Task | Agent | Trigger |
|---|---|---|
| Generate component / store / service / entrypoint | `agents/code.agent.md` | `@workspace generate...` |
| Write tests for a file | `agents/test.agent.md` | `@workspace write tests for...` |

## Auto-Applied Instructions

```
src/**/*.ts   src/**/*.vue  →  instructions/code-writing.md
**/*.spec.ts               →  instructions/test-writing.md
```

## Context7 Library IDs

| Tech | ID | Use for |
|---|---|---|
| WXT | `/websites/wxt_dev` | Service workers, storage, content scripts, alarms |
| Vue 3 | `/vuejs/vue` | Composition API, `<script setup>`, reactivity |
| Pinia | `/websites/pinia_vuejs` | Store typing, `$patch`, `$subscribe` |
| Vitest | `/websites/main_vitest_dev` | Mocking, timers, assertions |
| Playwright | `/microsoft/playwright` | E2E, persistent context, extension loading |
| VueUse | `/vueuse/vueuse` | Composables, `useAsyncState` |
