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
| **Daily alarm (24h)** | BackgroundTabService.groupTabsByAge() → creates groups from youngest to oldest (left-to-right) | Chrome + Edge only; Firefox skips gracefully |
| **Tab activated in group** | BackgroundTabService.onTabActivated() → ungroup + move to rightmost + update lastAccessed | ✅ All browsers (Firefox has no ungroup API, skips step 1) |
| **Tab order** | **Groups:** Youngest (7 days, left) → Oldest (365+ days, right). **Fresh tabs:** Stay in original positions (rightmost, ungrouped) | ✅ All browsers |
| **Group titles** | `Week+`, `2 Weeks+`, `Month+`, `Quarter+`, `Are you kidding me?` — youngest to oldest | Chrome + Edge only |

## Universal Rules

| Rule | Detail |
|---|---|
| **GroupBy Age Order** | Iterate FORWARD `for (i=0; i<activeLevels.length; i++)` to create groups youngest→oldest (left-to-right). Fresh tabs stay in place, NOT moved to rightmost. |
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
| **Test assertions** | NEVER use `>`, `<`, `toBeGreaterThan()`, `toBeLessThan()`, `toBeGreaterThanOrEqual()`, `toBeLessThanOrEqual()` — always assert **exact values** with `toBe()`, `toEqual()`. No approximations. |
| **Test simplicity** | Minimize test steps: only test one core behavior per test. Use minimal clicks/setup. Focus on what you're testing, not side effects. |
| **Playwright POM** | E2E tests MUST use Page Object Models (test/playwright/page-objects/). Keep locators/waits hidden in POM. Tests read like one-liners: `await options.clickGroupTabs()` not raw Playwright. See test/playwright/README.md |

## Tab Age Management

| Concept | Implementation |
|---|---|
| **Age classification** | Fresh / Level 1 / Level 2 / ... (based on lastAccessed timestamp vs. thresholds) |
| **Storage** | AppThresholds.activeLevels (1-5) — number of active threshold levels |
| **Visual grouping** | Chrome tab groups API — ONLY grouping, NO favicon overlays |
| **Group creation order** | Youngest level first → Oldest level last (forward loop `i=0` to `i<activeLevels.length`) |
| **Visual position** | LEFT (youngest 7 days) → RIGHT (oldest 365+ days) → FAR RIGHT (fresh ungrouped tabs) |
| **Fresh tabs behavior** | Stay in original positions (rightmost) — NOT moved. Only moved when explicitly activated by user |
| **Tab sort within group** | Oldest first within each group (highest lastAccessDays first) |

## Grouping Algorithm (BackgroundTabService.groupTabsByAge)

**Input**: Browser tabs + AppThresholds (with activeLevels=N)  
**Output**: N age-based groups + fresh tabs in original positions

```
1. Query all tabs & apply mock overrides (testing)
2. Classify each tab into age categories:
   - Age index 0 (Fresh): lastAccessDays ≤ threshold[0].days
   - Age index 1: threshold[0].days < lastAccessDays ≤ threshold[1].days
   - Age index N: lastAccessDays > threshold[N-1].days
3. Build distribution: levelTabIds[i] = tabs with age index (i+1)
4. Sort within each level by lastAccessDays (oldest first)
5. Create groups from youngest→oldest (forward loop):
   ```typescript
   for (let i = 0; i < activeLevels.length; i++) {
     await createGroup(levelTabIds[i], title, color)
   }
   ```
6. Fresh tabs (index 0) → **stay in original positions, NOT moved**
```

**Result**: Visual order LEFT to RIGHT = Youngest (7 days) → Oldest (365+ days) → Fresh ungrouped tabs (rightmost)

## Storage Architecture

### ⚡ Background Service + Storage Access
- **Background services CANNOT use Vue composables** (`useAppStore()`, `onMounted`, etc.)
- Background must use **direct WXT storage access**: `appStateStorage.getValue()`
- UI components use `useAppStore()` for reactivity
- Both read from same `appStateStorage` source of truth

### 🐛 Known WXT Serialization Edge Case
- WXT storage may serialize arrays as objects during persistence
- `AppThresholds.fromObject()` must handle both formats:
  ```typescript
  const levels = Array.isArray(obj.levels) 
    ? obj.levels 
    : Object.values(obj.levels) // WXT edge case: convert object→array
  ```

### 🧪 E2E Test Pattern for Threshold Changes
1. Create mock tabs via UI
2. **Set mock overrides** (backdated ages) before grouping
3. **Change thresholds** → ApplyButton visible → click Apply → wait 1500ms
4. **Extra wait** (+1000ms) between threshold save and grouping to ensure storage sync
5. Verify threshold.activeLevels persisted to storage

### Mock Overrides Setup
- Requires background handler: `if (action === 'setMockOverrides') { await mockOverrides.setValue(...) }`
- POM method: `await options.setMockOverrides(tabIdAgeMap)` 
- Age distribution must ensure tabs span all active threshold levels

## Agents

| Task | Agent | Trigger |
|---|---|---|
| Generate component / store / service / entrypoint | `agents/code.agent.md` | `@workspace generate...` |
| Write tests for a file | `agents/test.agent.md` | `@workspace write tests for...` |

## Auto-Applied Instructions

```
src/**/*.ts   src/**/*.vue  →  instructions/code-writing.md
**/*.spec.ts               →  instructions/test-writing.md
test/playwright/**         →  Playwright POM pattern below
```

## Playwright Page Object Model (POM) Pattern

**Location**: `test/playwright/page-objects/`

**Rule**: All E2E tests MUST use Page Object Models. No raw `page.getByTestId()` in test files.

**Benefits**: 
- Tests read like plain English: `await options.clickGroupTabs()` ✅
- Locators centralized (easy to update)
- Complex logic (waits, retries) hidden
- 70% less boilerplate

**Available Models**:
- `PopupPage` - Popup UI (buttons, navigation)
- `OptionsPage` - Options page (grouping, tabs, config)

**Example (BEFORE - raw Playwright)**:
```typescript
await p.goto(`chrome-extension://${extensionId}/options.html`);
await p.getByTestId('popup-btn-group-tabs').click();
await p.waitForTimeout(1200);
const tabs = await p.evaluate(() => chrome.tabs.query({}));
expect(tabs.filter(t => t.groupId !== -1).length).toBe(12);
```

**Example (AFTER - with POM)**:
```typescript
const options = new OptionsPage(page);
await options.goto(extensionId);
await options.clickGroupTabs();
await options.expectGroupCountEqual(3);
```

**Creating POM methods**:
- **Actions** (click, fill): `async clickGroupTabs()`
- **Queries** (get state): `async getGroupCount()` → returns number
- **Expectations** (assert): `async expectGroupCountEqual(n)` → throws if fails
- **Returns**: data, not void (enables chaining)

See `test/playwright/README.md` for full guide.

## Service Worker Testing in Playwright

**Problem**: When testing background.ts in Playwright, VSCode breakpoints don't work—service workers run in separate isolated context.

**Solution**: Monitor console logs from service worker.

**Setup** (in test `beforeAll`):
```typescript
OptionsPage.setupServiceWorkerLogging(ctx.context);
```

**How it works**:
1. `page.evaluate()` sends `chrome.runtime.sendMessage({action: "groupTabsByAge"})`
2. `background.ts` listener catches message
3. `BackgroundTabService.groupTabsByAge()` executes
4. Console logs appear in test output with `[SW_LOG]` prefix
5. Results sent back to page via `sendResponse()`

**Example test with debugging**:
```typescript
const options = new OptionsPage(page);
await options.goto(extensionId);

// You'll see in console:
// ✓ [SW_LOG]: [BackgroundTabService] groupTabsByAge...
// ✓ [SW_LOG]: [BackgroundTabService] Raw tabs: 14
// ✓ [SW_LOG]: ✅ Created 3 age groups...

await options.clickGroupTabs();
await options.expectGroupCountEqual(3);
```

**Best Practices**:
- ✅ Use `page.evaluate()` + `chrome.runtime.sendMessage()` for SW calls
- ✅ Monitor `[SW_LOG]` output in test runs
- ✅ Add descriptive console.log() in background.ts and services
- ❌ Don't try VSCode breakpoints on service worker code
- ❌ Don't assume synchronous execution—always use Promises/callbacks
- ❌ Don't try to navigate to `background.html`—it's not accessible from UI

See `test/playwright/README_SERVICE_WORKER_DEBUG.md` for full debugging guide.

## Context7 Library IDs

| Tech | ID | Use for |
|---|---|---|
| WXT | `/websites/wxt_dev` | Service workers, storage, content scripts, alarms |
| Vue 3 | `/vuejs/vue` | Composition API, `<script setup>`, reactivity |
| Pinia | `/websites/pinia_vuejs` | Store typing, `$patch`, `$subscribe` |
| Vitest | `/websites/main_vitest_dev` | Mocking, timers, assertions |
| Playwright | `/microsoft/playwright` | E2E, persistent context, extension loading |
| VueUse | `/vueuse/vueuse` | Composables, `useAsyncState` |
