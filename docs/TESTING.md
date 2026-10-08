# Testing Guide

This project’s current Playwright suite exercises the browser extension through a real Chrome MV3 context. The test suite is intentionally small, isolated per test, and focused on features that are visible in the extension and background service worker.

## Commands

### Unit tests
```bash
npm run test:unit
```

### Playwright extension tests
```bash
npx playwright test --project=chrome-mv3
```

### Single file
```bash
npx playwright test test/playwright/24h-alarm-auto-close.spec.ts --project=chrome-mv3
```

## Test architecture

The project uses two layers:

1. Browser-level Playwright verification via `test/playwright/*.spec.ts`
2. Extension state and business logic via `src/services/BackgroundTabService.ts`, `src/services/BackgroundRPC.ts`, and `src/store/StorageRepository.ts`

The important part is that tests validate real extension behavior, not mock-only internals. Most page interactions happen through `OptionsPage`, which wraps the UI and the background RPC layer.

## Current Playwright layout

```text
test/playwright/
├── 24h-alarm-age-grouping.spec.ts
├── 24h-alarm-auto-close.spec.ts
├── browser-alarms-api.spec.ts
├── browser-alarms-updateTabByAge.spec.ts
├── closure-and-title-verification.spec.ts
├── independence-grouping.spec.ts
├── StoreTest.spec.ts
├── thresholds-change.spec.ts
├── thresholds-persist-reload.spec.ts
├── tooltip.spec.ts
├── chromium/
│   ├── OptionsTest.spec.ts
│   ├── OptionsTresholdsTest.spec.ts
│   ├── PopupTest.spec.ts
│   ├── SingleTabInGroup.spec.ts
│   └── ThresholdDayLevelChange.spec.ts
├── page-objects/
│   └── OptionsPage.ts
├── chromium/extensions.ts
└── globals.d.ts
```

## What the suite validates

The Playwright suite focuses on:

- tab grouping by age
- threshold updates and persistence
- auto-close configuration and alarm behavior
- browser alarm registration and firing contracts
- tab activation / ungrouping behavior
- state isolation between tests

## Good practices used in the suite

- keep one browser context per test file or per test environment
- avoid parallel workers for MV3 extension tests
- prefer `expect.poll()` and web-first assertions over arbitrary fixed sleeps
- verify storage state through `chrome.storage.local.get('appState')` when testing persistence
- assert business behavior, not implementation details

## Important gotchas

### 1. Storage key
The extension persists its state under `appState`, not a literal `local:appState` key in browser storage.

```ts
const data = await chrome.storage.local.get('appState')
const enabled = data.appState?.autoClose ?? false
```

### 2. Group order
The tab groups must be verified in left-to-right order, oldest to youngest:

```ts
['Hell!', 'Quarter+', 'Month+', '2 Weeks+', 'Week+']
```

### 3. Test isolation
Each test should start with a fresh extension context or state reset. The suite uses isolated Chrome contexts to avoid cross-test contamination.

## Maintenance guidance

- Prefer tests that validate user-visible behavior.
- Avoid exact tab-count assertions when the mock data or browser timing may vary.
- Keep tests focused: one scenario per file or per `test(...)` block.
- Update this document whenever new Playwright files are introduced or removed.

## Related files

- `playwright.config.ts` — global Playwright config
- `test/playwright/chromium/extensions.ts` — MV3 browser setup and cleanup
- `test/playwright/page-objects/OptionsPage.ts` — browser UI helpers and storage assertions
- `src/services/BackgroundTabService.ts` — actual tab-group logic under test
await optionsPage.setMockOverrides(overrides)
await optionsPage.page.waitForTimeout(500)  // Storage persistence
```

---

### ⚠️ Gotcha 5: Chrome Global in page.evaluate()

**Problem**: `createProxyService()` doesn't work inside `page.evaluate()` - no Proxy-Service library there.

**Solution**: Use `TestHelper` outside `page.evaluate()`:
```typescript
// ✅ CORRECT
const tabs = await TestHelper.createMockTabs()  // Outside page.evaluate
await optionsPage.page.waitForTimeout(500)

// ❌ WRONG: Can't use proxy-service inside page.evaluate
await optionsPage.page.evaluate(async () => {
  const bg = createProxyService(...)  // Not available here!
})
```

---

### ⚠️ Gotcha 6: Exact Assertion Values Only

**Problem**: Test flakiness from using comparisons like `toBeGreaterThan()` or `toBeGreaterThanOrEqual()`.

**Solution**: Always use exact values with `toBe()`:
```typescript
// ✅ CORRECT
expect(groups.length).toBe(5)
expect(groupedTabCount).toBe(12)

// ❌ WRONG: Flaky, depends on timing
expect(groups.length).toBeGreaterThanOrEqual(3)
```

---

### ⚠️ Gotcha 7: Test Isolation

**Problem**: Tests might interfere with each other if they don't clean up properly.

**Pattern**: Always use `test.beforeAll()` and `test.afterAll()`:
```typescript
test.beforeAll('Setup', async () => {
  ctx = await setupExtensionTest(false)
  options = new OptionsPage(await ctx.context.newPage())
})

test.afterAll('Cleanup', async () => {
  if (ctx) await ctx.cleanup()
})
```

---

## RPC Methods Available in Tests

| Method | Purpose | Example |
|--------|---------|---------|
| `createMockTabs()` | Load 14 backdated test tabs | `await TestHelper.createMockTabs()` |
| `setMockOverrides()` | Simulate tab aging | `await TestHelper.setMockOverrides({1: timestamp})` |
| `getMockOverrides()` | Inspect current overrides | `const o = await TestHelper.getMockOverrides()` |
| `openRandomTabInGroup()` | Create test tab in group | `await TestHelper.openRandomTabInGroup(true, 0)` |

All map directly to `BackgroundRPC` methods (production code paths) ✅

---

## Running Tests

### Unit Tests
```bash
npm run test:unit          # Run once
npm run test:unit:watch    # Watch mode
```

### E2E Tests
```bash
npm run test:playwright:chromium        # Chrome only
npm run test:playwright:firefox         # Firefox only
npm run test:playwright:debug           # Debug mode (Playwright Inspector)
npm run test:playwright:ui              # UI mode (visual test runner)
```

### Full Test Suite
```bash
npm test                   # Unit + Playwright (both browsers)
```

---

## Type Safety in Tests

```typescript
// ✅ Full TypeScript inference
import { TestHelper } from 'test/services/TestHelper'

const tabs: Browser.tabs.Tab[] = await TestHelper.createMockTabs()
const overrides: Record<number, number> = { 1: Date.now() }
await TestHelper.setMockOverrides(overrides)  // ✅ Type-checked

// ✅ Page Object Model has typed methods
const rowCount: number = await optionsPage.getTableRowCount()
const groups: Array<{ id: number; title: string; tabCount: number }> = 
  await optionsPage.getAllGroups()
```

---

## Debugging Tests

### Enable Playwright Inspector
```bash
npm run test:playwright:debug
# Launches Playwright Inspector - step through tests visually
```

### Add Console Logs
```typescript
console.log('[testName]', { groupCount, tabsGrouped, variable })
// Output visible in test runner
```

### Use Page Screenshots
```typescript
await optionsPage.page.screenshot({ path: 'debug.png' })
// Save UI state for debugging
```

---

## Key Principles

1. ✅ **Tests use same RPC as production** - No separate test code paths
2. ✅ **TestHelper for direct access** - Faster, cleaner, type-safe
3. ✅ **Page Objects encapsulate UI** - Reusable, maintainable test logic
4. ✅ **Exact assertions only** - No flaky timing-dependent tests
5. ✅ **Explicit waits** - No implicit waiting, clear intent
6. ✅ **Sort tab groups** - `getAllGroups()` returns sorted by position

---

**Result**: Type-safe, maintainable, reliable tests that catch real bugs. 🎉

