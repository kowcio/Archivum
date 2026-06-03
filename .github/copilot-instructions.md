---
project: "Tab Age Browser Extension"
stack: "WXT 0.20+ · Vue 3.5 · TypeScript 5.8 · Pinia 3 · Quasar 2 · Vitest 4 · Playwright 1.60"
---

# Project Instructions

## Architecture

```
background.ts (service worker — NO Pinia)
  └─ BackgroundTabService.groupTabsByAge()  ←─ daily alarm (24h)
       └─ Chrome tab groups API  ←─ creates age-based groups
            └─ browser.storage.local  ←─ single shared state
                 └─ TabStore.initStorageSync()  ←─ UI contexts react
                      └─ popup / options (Pinia + Vue)
```

**Rule**: background writes, UI reads. Never the other way.

## Tab Grouping Flow (NO L-brackets)

| Event | Action |
|---|---|
| **Daily alarm (24h)** | BackgroundTabService.groupTabsByAge() → creates Old/Middle/Young groups |
| **Tab activated in group** | BackgroundTabService.moveActivatedTabToFresh() → ungroup + move to rightmost |
| **Tab order** | Oldest (left) → Youngest (right) — natural left-to-right flow |
| **Group titles** | `Old 20d+`, `Middle 10d+`, `Young 3d+` — NO emoji dots |

## Universal Rules

| Rule | Detail |
|---|---|
| **TypeScript** | `type` (not `interface`), no `any`, no `unknown` leaks |
| **Vue** | `<script setup lang="ts">` only — no Options API |
| **Pinia** | `type State`, `loading` + `error: string \| null` in every store |
| **Browser** | `chrome.*` in background context (ESM), `browser` in UI — never mix |
| **Storage** | `chrome.storage` in background, `browser.storage` in UI via `StorageService` |
| **Tests** | Vitest (unit/jsdom) + Playwright (E2E/real Chromium) |
| **UI** | Quasar: `q-btn`, `q-table`, `q-tooltip`; project CSS: `got-*` from `global.css` |
| **No destructuring** | `const { x } = obj` ❌ → use `obj.x` (explicit, grep-safe) |
| **No docs** | NEVER generate `*.md` files unless explicitly asked — saves tokens |
| **No Pinia in background** | background.ts has no Vue context — use native `chrome.*` API |
| **No setInterval** | Use `chrome.alarms` — service workers suspend ~30s |
| **L-brackets deprecated** | LBracketService exists for future use but is NOT active — use tab groups |
| **Token economy** | Code + SHORT explanation only — no long descriptions, no helper scripts |
| **Minimalism** | Answer query directly — no "how to use" essays, no verbose summaries |

## Tab Age Management

| Concept | Implementation |
|---|---|
| **Age classification** | Fresh / Young / Middle / Old (based on lastAccessed timestamp) |
| **Storage** | ClassifiedTab.ageIndex (0-3) — computed from thresholds |
| **Visual grouping** | Chrome tab groups API — ONLY grouping, NO favicon overlays |
| **Tab activation** | Activated tab → ungrouped + moved to rightmost position (fresh) |
| **Tab sort order** | Oldest first → Youngest last (left-to-right flow) |

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
