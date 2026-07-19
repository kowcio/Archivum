# Testing Guide

## Overview

This project uses **type-safe RPC** for all test-to-background communication. Tests bypass message APIs and call RPC methods directly via `TestHelper`, ensuring tests use the same code paths as production.

---

## Test Architecture

### The TestHelper Pattern

Instead of tests using `chrome.runtime.sendMessage()`, they use `TestHelper` which provides direct access to RPC methods:

```typescript
// ✅ NEW: Direct, type-safe, fast
import { TestHelper } from 'test/services/TestHelper'
const tabs = await TestHelper.createMockTabs()

// ❌ OLD: Message API, not type-safe, serialization overhead  
chrome.runtime.sendMessage({ action: 'createMockTabs' }, callback)
```

### Why TestHelper?

| Aspect | Benefit |
|--------|---------|
| **Speed** | Direct calls, no message serialization |
| **Type Safety** | Full TypeScript inference |
| **Clarity** | Explicit import shows this is test code |
| **Single Source** | Tests use exact same RPC methods as production |
| **Clean Code** | No message passing boilerplate |

---

## TestHelper Methods

### Test Data Creation
```typescript
// Create 14 mock tabs with backdated lastAccessed times
const tabs = await TestHelper.createMockTabs()
// Returns: Browser.tabs.Tab[] with 14 tabs spread across age ranges
```

### Mock Age Overrides
```typescript
// Simulate tabs aging by changing their lastAccessed timestamps
const overrides = {
  tabId1: Date.now() - (7 * 24 * 60 * 60 * 1000),  // 7 days ago
  tabId2: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
}
await TestHelper.setMockOverrides(overrides)

// Retrieve current overrides (for debugging)
const current = await TestHelper.getMockOverrides()
```

### Tab Operations
```typescript
// Create a tab in a specific group (or new group) with random URL
const result = await TestHelper.openRandomTabInGroup(newTabGroup, groupIndex)
// Returns: Generated alphanumeric ID (single char: 0-9 or A-Z)
```

---

## Test Organization

### File Structure
```
test/
├── services/
│   └── TestHelper.ts           🧪 Direct RPC method access
├── playwright/
│   ├── page-objects/
│   │   ├── OptionsPage.ts      Page Object Model for Options UI
│   │   └── PopupPage.ts        Page Object Model for Popup UI
│   ├── chromium/
│   │   ├── OptionsTest.spec.ts
│   │   ├── PopupTest.spec.ts
│   │   └── ...                 Individual test scenarios
│   ├── StoreTest.spec.ts       Cross-tab state synchronization
│   ├── 24h-alarm-age-grouping.spec.ts  Time-based aging simulation
│   └── backup-restore.spec.ts  Backup/restore functionality
└── unit/
    ├── services/
    ├── models/
    └── integration/
```

### Test Types

#### Unit Tests (Vitest)
```bash
npm run test:unit
# Tests individual services and models in isolation
# 110 tests pass ✅
```

#### E2E Tests (Playwright)
```bash
npm run test:playwright:chromium   # Chrome only
npm run test:playwright:firefox    # Firefox only
npm run test:playwright            # Both browsers
```

---

## Common Testing Patterns

### Pattern 1: Load Mock Tabs, Group, and Verify

```typescript
// 1. Load mock tabs with backdated ages
const mockResult = await optionsPage.clickLoadMockTabs(2000)
expect(mockResult.ok).toBe(true)
expect(mockResult.count).toBe(14)

// 2. Group tabs by age
await optionsPage.clickGroupTabs(1500)

// 3. Query groups and verify state
const groups = await optionsPage.getAllGroups()
expect(groups.length).toBe(5)  // Should have 5 age-based groups
expect(groups[0].title).toContain('Eat that frog!')
```

### Pattern 2: Simulate Tab Aging

```typescript
// Get current tabs with their IDs
const data = await optionsPage.getGroupAndTabData()

// Create overrides to age tabs (e.g., 7 days older)
const weekMs = 7 * 24 * 60 * 60 * 1000
const overrides: Record<number, number> = {}
for (const tab of data.tabs) {
  if (tab.lastAccessed) {
    overrides[tab.id!] = tab.lastAccessed - weekMs
  }
}

// Apply overrides
await optionsPage.setMockOverrides(overrides)

// Regroup and verify new age classifications
await optionsPage.clickGroupTabs(1500)
const newData = await optionsPage.getGroupAndTabData()
// Now tabs should be in different groups based on new ages
```

### Pattern 3: Page Object Model Usage

```typescript
// Page objects encapsulate UI interactions
const optionsPage = new OptionsPage(page)
await optionsPage.goto(extensionId)

// Query table data
const rowCount = await optionsPage.getTableRowCount()

// Verify element visibility
await optionsPage.expectTableVisible()
await optionsPage.expectUngroupButtonVisible()

// Perform actions
await optionsPage.clickGroupTabs()
await optionsPage.clickSortTabs()
```

---

## Testing Gotchas & Quirks

### ⚠️ Gotcha 1: Group Index System

**Problem**: `browser.tabGroups.query()` returns arbitrary order, not sorted.

**Solution**: Always sort by `.index`:
```typescript
const groups = await browser.tabGroups.query({ windowId })
const sorted = groups.sort((a, b) => (a.index ?? -1) - (b.index ?? -1))
```

**In tests**: Use `OptionsPage.getAllGroups()` - already sorted ✅

---

### ⚠️ Gotcha 2: Mock Overrides Are Global State

**Problem**: Mock overrides persist across tests and affect subsequent runs.

**Solution**: Always reset between tests:
```typescript
test.beforeEach(async () => {
  // Clear mock overrides before each test
  await TestHelper.setMockOverrides({})
})
```

---

### ⚠️ Gotcha 3: Tab Creation Race Condition

**Problem**: `createMockTabs()` creates tabs asynchronously. Querying too soon may return incomplete results.

**Solution**: Wait for tabs to fully load:
```typescript
const tabs = await optionsPage.clickLoadMockTabs(2500)  // Extra wait time
await optionsPage.page.waitForLoadState('networkidle')  // Ensure complete
```

---

### ⚠️ Gotcha 4: Storage Sync Delay

**Problem**: WXT storage changes don't immediately sync across contexts.

**Solution**: Add explicit wait time:
```typescript
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

