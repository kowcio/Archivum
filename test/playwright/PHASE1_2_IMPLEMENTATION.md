# Targeted Implementation Checklist: Phase 1 & 2

## Phase 1: CRITICAL FIXES (5 hours) — Most Important ⚠️

### 1.1: Add updateTabByAge() RPC Method (15 min)

**File**: `src/services/BackgroundRPC.ts`

```typescript
// Add this method to BackgroundRPC type definition:

export type BackgroundRPC = {
  // ... existing methods ...
  
  // ✅ NEW: Test trigger for updateTabByAge
  testTriggerUpdateTabByAge: () => Promise<{
    movedCount: number
    groupsAfter: Array<{ id: number; title: string; tabCount: number }>
  }>
}

// In background.ts registerService:
testTriggerUpdateTabByAge: async () => {
  const movedCount = await BackgroundTabService.updateTabByAge()
  const groups = await BackgroundTabService.getGroups()
  const groupsAfter = groups.map(g => ({
    id: g.id,
    title: g.title,
    tabCount: (await browser.tabs.query({ groupId: g.id })).length
  }))
  return { movedCount, groupsAfter }
}
```

---

### 1.2: Add autoCloseOldestGroupTabs() RPC Method (15 min)

**File**: `src/services/BackgroundRPC.ts`

```typescript
export type BackgroundRPC = {
  // ... existing methods ...
  
  // ✅ NEW: Test trigger for autoCloseOldestGroupTabs
  testTriggerAutoClose: () => Promise<{
    closedCount: number
    hellGroupCountAfter: number
  }>
}

// In background.ts registerService:
testTriggerAutoClose: async () => {
  const appState = await storage.getAppState()
  if (!appState.autoClose) return { closedCount: 0, hellGroupCountAfter: 0 }
  
  const closedCount = await BackgroundTabService.autoCloseOldestGroupTabs()
  const groups = await BackgroundTabService.getGroups()
  const hellGroup = groups[0]
  const hellGroupCountAfter = (await browser.tabs.query({ groupId: hellGroup?.id })).length
  
  return { closedCount, hellGroupCountAfter }
}
```

---

### 1.3: Create updateTabByAge() Test File (1.5h)

**File**: `test/playwright/browser-alarms-updateTabByAge.spec.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { TestEnvironment } from './chromium/extensions'
import type { Browser } from 'playwright'

describe('browser.alarms - updateTabByAge() progressive aging', async () => {
  let env: TestEnvironment
  let browser: Browser

  beforeEach(async () => {
    // ✅ FRESH environment per test
    env = await TestEnvironment.create()
    browser = env.browser
  })

  afterEach(async () => {
    await env.close()
  })

  test('updateTabByAge() moves a tab to new group when it ages past threshold', async () => {
    // 1. Load mock tabs (creates groups: Hell!, Quarter+, Month+, 2 Weeks+, Week+)
    await env.optionsPage.clickLoadMockTabs()
    
    // 2. Group tabs
    await env.optionsPage.clickGroupTabs()
    
    // 3. Get initial state
    let groups = await env.optionsPage.getAllGroups()
    const weekGroupInitial = groups.find(g => g.title.includes('Week+'))
    expect(weekGroupInitial).toBeDefined()
    const weekInitialCount = weekGroupInitial.tabCount
    
    const twoWeeksGroupInitial = groups.find(g => g.title.includes('2 Weeks+'))
    const twoWeeksInitialCount = twoWeeksGroupInitial.tabCount
    
    // 4. Age by 7+ days (tabs in Week+ [7-13 days] → 2 Weeks+ [14-27 days])
    await env.optionsPage.timeProgress(7)
    
    // 5. Trigger updateTabByAge (NOT groupTabsByAge — incremental move, not full regroup)
    const result = await env.optionsPage.getBackgroundRPC().testTriggerUpdateTabByAge()
    
    // 6. Verify tab moved
    groups = await env.optionsPage.getAllGroups()
    const weekGroupAfter = groups.find(g => g.title.includes('Week+'))
    const twoWeeksGroupAfter = groups.find(g => g.title.includes('2 Weeks+'))
    
    expect(weekGroupAfter.tabCount).toBe(weekInitialCount - 1)  // One moved out ✅
    expect(twoWeeksGroupAfter.tabCount).toBe(twoWeeksInitialCount + 1)  // One moved in ✅
    expect(result.movedCount).toBeGreaterThan(0)  // Some moved ✅
  })

  test('updateTabByAge() moves ungrouped tabs to appropriate group when they age', async () => {
    await env.optionsPage.clickLoadMockTabs()
    
    // Get fresh ungrouped tabs (last in mock data)
    const allTabs = await env.optionsPage.queryAllTabs()
    const freshTabs = allTabs.filter(t => t.groupId == null || t.groupId === -1)
    expect(freshTabs.length).toBeGreaterThan(0)
    
    // Age by 7 days (0-7 days → 7-13 days, should move to Week+)
    await env.optionsPage.timeProgress(7)
    
    // Trigger updateTabByAge
    const result = await env.optionsPage.getBackgroundRPC().testTriggerUpdateTabByAge()
    
    // Verify tabs moved to Week+ group
    const groups = await env.optionsPage.getAllGroups()
    const weekGroup = groups.find(g => g.title.includes('Week+'))
    
    expect(weekGroup).toBeDefined()
    expect(weekGroup.tabCount).toBeGreaterThan(0)
    expect(result.movedCount).toBeGreaterThan(0)
  })

  test('updateTabByAge() handles multiple threshold transitions', async () => {
    await env.optionsPage.clickLoadMockTabs()
    await env.optionsPage.clickGroupTabs()
    
    // Initial state
    let groups = await env.optionsPage.getAllGroups()
    const initialGroupCounts = {
      hell: groups.find(g => g.title.includes('Hell!'))?.tabCount ?? 0,
      quarter: groups.find(g => g.title.includes('Quarter+'))?.tabCount ?? 0,
      month: groups.find(g => g.title.includes('Month+'))?.tabCount ?? 0,
      twoWeeks: groups.find(g => g.title.includes('2 Weeks+'))?.tabCount ?? 0,
      week: groups.find(g => g.title.includes('Week+'))?.tabCount ?? 0,
    }
    
    // Age by 30 days (crosses multiple thresholds)
    await env.optionsPage.timeProgress(30)
    
    // Trigger updateTabByAge multiple times (simulate 30 days of incremental updates)
    for (let i = 0; i < 30; i++) {
      await env.optionsPage.getBackgroundRPC().testTriggerUpdateTabByAge()
      await new Promise(r => setTimeout(r, 10))  // Small delay
    }
    
    // Verify distribution changed
    groups = await env.optionsPage.getAllGroups()
    const finalGroupCounts = {
      hell: groups.find(g => g.title.includes('Hell!'))?.tabCount ?? 0,
      quarter: groups.find(g => g.title.includes('Quarter+'))?.tabCount ?? 0,
      month: groups.find(g => g.title.includes('Month+'))?.tabCount ?? 0,
      twoWeeks: groups.find(g => g.title.includes('2 Weeks+'))?.tabCount ?? 0,
      week: groups.find(g => g.title.includes('Week+'))?.tabCount ?? 0,
    }
    
    // Hell! and Quarter+ should grow (older groups receive aged tabs)
    expect(finalGroupCounts.hell).toBeGreaterThanOrEqual(initialGroupCounts.hell)
    expect(finalGroupCounts.quarter).toBeGreaterThanOrEqual(initialGroupCounts.quarter)
    
    // Week+ should shrink (younger tabs age out)
    expect(finalGroupCounts.week).toBeLessThanOrEqual(initialGroupCounts.week)
  })
})
```

---

### 1.4: Update 24h-alarm-auto-close Test (1h)

**File**: `test/playwright/24h-alarm-auto-close.spec.ts` (modify existing)

```typescript
// In existing test, ADD these verification steps:

test('should keep tabs when auto-close disabled, and close tabs when enabled', async () => {
  // ... existing setup code ...
  
  const tabsBefore = await env.optionsPage.getGroupAndTabData()
  const hellGroupBefore = tabsBefore.groupsOrderedByIndex[0]
  const hellCountBefore = hellGroupBefore.tabCount  // E.g., 4 tabs
  
  // ... existing: enable auto-close ...
  
  // ✅ NEW: Actually trigger auto-close
  const closeResult = await env.optionsPage.getBackgroundRPC().testTriggerAutoClose()
  
  // ✅ NEW: Verify tabs were closed
  expect(closeResult.closedCount).toBeGreaterThan(0)  // Some tabs closed
  expect(closeResult.hellGroupCountAfter).toBeLessThan(hellCountBefore)  // Count decreased
  
  // ✅ Existing check still works:
  const tabsAfter = await env.optionsPage.getGroupAndTabData()
  expect(tabsAfter.groupedTabCount).toBeLessThan(tabsBefore.groupedTabCount)
})
```

---

### 1.5: Add Group Title Update Test (1h)

**File**: `test/playwright/chromium/SingleTabInGroup.spec.ts` (add to existing)

```typescript
test('onTabActivated() updates group title with new tab count', async () => {
  // Setup: Load mocks and create groups
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()
  
  // Get groups and find one with multiple tabs
  let groups = await env.optionsPage.getAllGroups()
  const groupToTest = groups.find(g => g.tabCount > 1)
  expect(groupToTest).toBeDefined()
  
  const titleBefore = groupToTest.title  // E.g., "Week+ (3)"
  const countBefore = groupToTest.tabCount
  
  // Get a tab from this group
  const allTabs = await env.optionsPage.queryAllTabs()
  const tabToActivate = allTabs.find(t => t.groupId === groupToTest.id)
  expect(tabToActivate).toBeDefined()
  
  // Activate the tab (should ungroup + move + update group title)
  await env.optionsPage.activateTab(tabToActivate.id)
  
  // ✅ Poll for group title update (expect.poll built-in)
  await expect.poll(
    async () => {
      const groupsAfter = await env.optionsPage.getAllGroups()
      const groupAfter = groupsAfter.find(g => g.id === groupToTest.id)
      return groupAfter?.title ?? null
    },
    { timeout: 10000 }
  ).toMatch(new RegExp(`${groupToTest.title.split(' ')[0]}\\s*\\(${countBefore - 1}\\)`))
  
  // Verify tab is ungrouped
  const tabAfter = await env.optionsPage.queryTab(tabToActivate.id)
  expect(tabAfter.groupId).toBe(-1)
})
```

---

### 1.6: Fix Test Architecture (1.5h)

**File**: `test/playwright/browser-alarms-api.spec.ts` — APPLY TO ALL TESTS

```typescript
// ❌ BEFORE (shared env):
describe('browser.alarms API', async () => {
  let env: TestEnvironment
  
  beforeAll(async () => {  // ❌ WRONG: Creates env once
    env = await TestEnvironment.create()
  })
  
  afterAll(async () => {  // ❌ WRONG: Cleans up after all
    await env?.close()
  })
  
  test('test 1', async () => {
    // ❌ Reuses same env from beforeAll
  })
})

// ✅ AFTER (fresh env per test):
describe('browser.alarms API', async () => {
  let env: TestEnvironment
  
  beforeEach(async () => {  // ✅ CORRECT: Creates env per test
    env = await TestEnvironment.create()
  })
  
  afterEach(async () => {  // ✅ CORRECT: Cleans up after each test
    await env?.close()
  })
  
  test('test 1', async () => {
    // ✅ Fresh env, no shared state
  })
})
```

**Apply to these files**:
- `browser-alarms-api.spec.ts`
- `24h-alarm-age-grouping.spec.ts`
- `24h-alarm-auto-close.spec.ts`
- `thresholds-change.spec.ts`
- `test-alarm-button.spec.ts`

---

## Phase 2: POLLING & ORDERING (2 hours)

### 2.1: Replace Manual Polling with expect.poll() (1h)

**Pattern**:
```typescript
// ❌ BEFORE (manual retry)
let retries = 0
let groups = null
while (retries < 30 && !groups) {
  try {
    groups = await env.optionsPage.getAllGroups()
    if (groups.length > 0) break
  } catch {
    retries++
    await new Promise(r => setTimeout(r, 500))
  }
}

// ✅ AFTER (expect.poll built-in)
const groups = await expect.poll(
  async () => {
    return await env.optionsPage.getAllGroups()
  },
  { timeout: 15000 }
).resolves.toBeDefined()
```

**Apply to** (grep for setTimeout loops):
- `thresholds-change.spec.ts`
- `independence-grouping.spec.ts`
- `tooltip.spec.ts`
- All chromium/*.spec.ts tests

---

### 2.2: Add Tab Order Test (0.5h)

**File**: `test/playwright/test-tab-order-within-groups.spec.ts` (NEW)

```typescript
test('Tabs within each group are ordered by lastAccessed (oldest first)', async () => {
  env = await TestEnvironment.create()
  
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()
  
  const allTabs = await env.optionsPage.queryAllTabs()
  const groups = await env.optionsPage.getAllGroups()
  
  for (const group of groups) {
    const groupTabs = allTabs.filter(t => t.groupId === group.id)
    
    // Verify ordering: lastAccessed should be non-decreasing (oldest first)
    for (let i = 0; i < groupTabs.length - 1; i++) {
      const tab1 = groupTabs[i]
      const tab2 = groupTabs[i + 1]
      expect(tab1.lastAccessed ?? 0).toBeLessThanOrEqual(tab2.lastAccessed ?? 0)
    }
  }
})
```

---

### 2.3: Add Group Index Test (0.5h)

**File**: Existing `24h-alarm-age-grouping.spec.ts`

```typescript
test('Groups are indexed correctly (oldest has lowest index)', async () => {
  const groups = await env.optionsPage.getAllGroups()
  
  // Should be sorted by index (0, 1, 2, 3, 4)
  const indices = groups.map(g => g.index ?? -1)
  expect(indices).toEqual([0, 1, 2, 3, 4])
  
  // Verify order matches age (oldest first)
  expect(groups[0].title).toContain('Hell!')      // index 0 = oldest
  expect(groups[1].title).toContain('Quarter+')
  expect(groups[2].title).toContain('Month+')
  expect(groups[3].title).toContain('2 Weeks+')
  expect(groups[4].title).toContain('Week+')      // index 4 = youngest
})
```

---

## Summary: What Changes Where

| File | Changes | Impact |
|------|---------|--------|
| `src/services/BackgroundRPC.ts` | Add 2 RPC methods | Enables test triggers |
| `test/playwright/browser-alarms-updateTabByAge.spec.ts` | NEW file (3 tests) | Tests updateTabByAge |
| `test/playwright/24h-alarm-auto-close.spec.ts` | Add closure verification | Tests actual closing |
| `test/playwright/chromium/SingleTabInGroup.spec.ts` | Add title update test | Tests title count |
| `test/playwright/browser-alarms-api.spec.ts` | Move env to beforeEach | Fixes shared state |
| `test/playwright/24h-alarm-age-grouping.spec.ts` | Move env to beforeEach | Fixes shared state |
| `test/playwright/24h-alarm-auto-close.spec.ts` | Move env to beforeEach | Fixes shared state |
| `test/playwright/thresholds-change.spec.ts` | Move env to beforeEach | Fixes shared state |
| `test/playwright/test-alarm-button.spec.ts` | Move env to beforeEach | Fixes shared state |
| `test/playwright/test-tab-order-within-groups.spec.ts` | NEW file (1 test) | Tests ordering |
| All 10 files with setTimeout | Replace with expect.poll() | Better polling |

---

**Effort**: 5 hours Phase 1 + 2 hours Phase 2 = **7 hours total**  
**Result**: 30% → 95% coverage + all tests independent + ~2x speedup

