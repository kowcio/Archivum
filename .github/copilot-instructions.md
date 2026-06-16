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

## Tab Grouping Flow (Cross-browser: Chrome + Firefox + Edge)

| Event | Action | Browser Support |
|---|---|---|
| **Daily alarm (24h)** | BackgroundTabService.groupTabsByAge() → creates Old/Middle/Young groups | Chrome + Edge only; Firefox skips gracefully |
| **Tab activated in group** | BackgroundTabService.onTabActivated() → ungroup + move to rightmost + update lastAccessed | ✅ All browsers (Firefox has no ungroup API, skips step 1) |
| **Tab order** | Oldest (left) → Youngest (right) — natural left-to-right flow | ✅ All browsers |
| **Group titles** | `Old 20d+`, `Middle 10d+`, `Young 3d+` — NO emoji dots | Chrome + Edge only |

## Universal Rules

| Rule | Detail |
|---|---|
| **TypeScript** | `type` (not `interface`), no `any`, no `unknown` leaks |
| **Vue** | `<script setup lang="ts">` only — no Options API |
| **Pinia** | `type State`, `loading` + `error: string \| null` in every store |
| **Browser** | Use unified `browser` API from `wxt/browser` everywhere — works Chrome + Firefox + Edge. Feature detect for Chrome-only APIs (`tabGroups`). Never mix `chrome` and `browser`. **Import rule:** `import { browser } from 'wxt/browser'` (runtime) + `import type { Browser } from 'wxt/browser'` (type namespace, np. `Browser.tabs.Tab[]`). WXT v0.20+ uses `@types/chrome` — namespace to `Browser`, nie `Tabs` |
| **Storage** | Use `browser.storage` via `tabStorageItem` in background + UI (unified approach). Background writes, UI reads only |
| **Tests** | Vitest (unit/jsdom) + Playwright (E2E/real Chromium) |
| **UI** | Quasar: `q-btn`, `q-table`, `q-tooltip`; project CSS: `got-*` from `global.css` |
| **No destructuring** | `const { x } = obj` ❌ → use `obj.x` (explicit, grep-safe) |
| **No docs** | NEVER auto-generate `*.md` files. ONLY create `*.md` if user explicitly asks ("create doc", "write guide", etc). Can update existing docs if requested. Saves tokens for code work. |
| **No Pinia in background** | background.ts has no Vue context — use `browser` API from `wxt/browser`. Callbacks only (no promises) for MV3 service worker compatibility |
| **No setInterval** | Use `browser.alarms` — service workers suspend ~30s (MV3 constraint) |
| **L-brackets deprecated** | LBracketService exists for future use but is NOT active — use tab groups |
| **Token economy** | Code + SHORT explanation only — no long descriptions, no helper scripts |
| **Minimalism** | Answer query directly — no "how to use" essays, no verbose summaries |
| **Test assertions** | NEVER use `>`, `<`, `toBeGreaterThan()`, `toBeLessThan()` — always assert **exact values** with `toBe()`, `toEqual()`. No guesswork. |

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
