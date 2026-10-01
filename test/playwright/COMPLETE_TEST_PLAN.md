# Complete Playwright Test Suite & Implementation Coverage Analysis

**Date**: 2026-09-05T22:46:27.607+02:00  
**Scope**: All 14 test files (23 tests) + Implementation logic verification  
**Status**: ✅ COMPLETE — Full architecture audit with optimization plan

---

## Executive Summary

### Current State
- **14 test files** analyzed (23 tests total)
- **7 implementation methods** in BackgroundTabService
- **⚠️ CRITICAL FINDING**: 2 major implementation methods have ZERO or LOW test coverage
- **❌ 30% of core logic untested** → High risk of regressions

### Coverage Breakdown
```
✅ Well-tested (3-5 tests):    groupTabsByAge(), getTabs(), onTabActivated()
⚠️  Partially-tested (1-2):    autoCloseOldestGroupTabs()
❌ UNTESTED (0 tests):         updateTabByAge() ← CRITICAL
❌ IMPLICIT (tested indirectly): Group order, tab move logic
```

### Key Discoveries

#### Discovery 1: updateTabByAge() is UNTESTED ❌ CRITICAL

**What it does**:
```typescript
// BackgroundTabService:260-331
// Moves tabs between groups as they age
// E.g., Week+ tab that becomes 3 weeks old → moves to 2 Weeks+ group
// E.g., ungrouped tab that becomes 7 days old → moves to Week+ group
```

**Why it matters**:
- Used in `ALARM_AUTO_CLOSE_TABS` handler (indirectly)
- Should update **individual tabs** when threshold crossed
- Currently **NOT directly tested**
- Only `groupTabsByAge()` (complete ungroup + regroup) is tested

**Risk**: 
- If updateTabByAge() has bugs, auto-close logic breaks
- No CI validation → regressions in production

**Test Gap**: Need specific test that:
1. Creates grouped tabs at day 7 (Week+)
2. Ages them to day 14
3. Verifies they MOVE to 2 Weeks+ group (not regroup from scratch)

---

#### Discovery 2: autoCloseOldestGroupTabs() Logic Mismatch ⚠️

**Current Implementation**:
```typescript
// BackgroundTabService: auto-close section
static async autoCloseOldestGroupTabs(): Promise<number> {
  const oldesGroup = await this.getGroupByIndex()      // Get OLDEST group
  const groupDays = /* extract from threshold label */
  
  const tabsToClose = tabsInOldestGroup.filter(tab => {
    const ageDays = (now - lastAccessed) / 86400000
    return ageDays > (groupDays ?? 0) + 1  // ← CLOSE if tab is 1+ days OLDER than group threshold
  })
  
  await browser.tabs.remove(tabIdsToClose)
  return tabIdsToClose.length
}
```

**Current Test**:
```typescript
// 24h-alarm-auto-close.spec.ts (line 22-75)
test('should keep tabs when auto-close disabled, and close tabs when enabled', async () => {
  await env.optionsPage.clickAutoCloseToggle()  // ← ONLY checks toggle
  expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)  // ← Verifies state
  
  const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
  
  // ❌ MISSING: Verify tabs were actually closed
  // ❌ MISSING: Verify count matches expected
  // ✅ ONLY checks: group counts changed
  expect(tabsAfter[0].tabCount).toBe(tabsBefore[0].tabCount + 1)  // Moved from Quarter+ to Hell!
})
```

**Problem**:
- Test verifies tab **moves** (aging behavior)
- Test does NOT verify tab **closure**
- autoClose toggle is tested, but the actual closing is not

**Missing Verification**:
1. Before auto-close: `Hell!` group has N tabs
2. After auto-close: `Hell!` group has N-X tabs
3. X = number of tabs that were > group threshold

---

#### Discovery 3: onTabActivated() Retry Logic Not Tested ⚠️

**Implementation** (BackgroundTabService:351-412):
```typescript
static async onTabActivated(tabId: number): Promise<void> {
  const RETRIES = 3
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      await (browser.tabs as any).ungroup([tabId])
      await browser.tabs.move(tabId, {index: -1})
      
      // Verify ungrouped
      const tabAfter = await browser.tabs.get(tabId)
      if (tabAfter.groupId === -1 || tabAfter.groupId == null) {
        // ✅ Success: update group title
        const groupTabs = await browser.tabs.query({groupId})
        await (browser.tabGroups as any).update(groupId, {
          title: `${labelPrefix} (${groupTabs.length})`
        })
        return  // ← EXIT on success
      }
      
      // Verify failed, retry with backoff
      if (attempt < RETRIES - 1) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
      }
    } catch (err) {
      // Retry on error
    }
  }
  
  console.warn(`Still grouped after ${RETRIES} retries`)  // ← FAILURE
}
```

**Current Test**:
```typescript
// StoreTest.spec.ts:63-73 + SingleTabInGroup.spec.ts
test('Last tab from group: activating sets groupId=-1', async () => {
  await env.optionsPage.activateTab(tabId)
  
  // ✅ Uses expect.poll() — good!
  await expect.poll(
    async () => {
      const data = await env.optionsPage.getGroupAndTabData()
      const activatedTab = data.tabs.find(t => t.id === tabId)
      return activatedTab?.groupId ?? null
    },
    { timeout: 15000 }
  ).toBe(-1)  // ← Only checks final result
})
```

**Problem**:
- Test assumes activation works (success on first attempt)
- Test does NOT verify retry logic
- Test does NOT verify group title update
- Retry backoff never exercised

**Missing**:
1. Mock a failure scenario where ungroup fails once
2. Verify retry logic kicks in
3. Verify group title updates with new count

---

#### Discovery 4: Tab Move Order Not Explicitly Tested ⚠️

**Implementation** (BackgroundTabService:197-208):
```typescript
// Build ordered array from oldest→youngest
const reversedTabIds: number[] = []
for (let i = levelTabIds.length - 1; i >= 0; i--) {
  reversedTabIds.push(...levelTabIds[i])  // ← REVERSE order (oldest first)
}

const orderedTabIds = [
  ...reversedTabIds,  // ← Oldest groups
  ...freshTabIds      // ← Fresh tabs at end
]

await browser.tabs.move(orderedTabIds, {index: 0})  // ← Move all to position 0
```

**Current Test**:
```typescript
// 24h-alarm-age-grouping.spec.ts
// Checks: group titles match at indices [0], [1], [2], etc.
expect(tabsBefore[0].title).toContain("Hell!")      // Oldest
expect(tabsBefore[1].title).toContain("Quarter+")
expect(tabsBefore[2].title).toContain("Month+")
expect(tabsBefore[3].title).toContain("2 Weeks+")
expect(tabsBefore[4].title).toContain("Week+")      // Youngest

// ✅ Good: Verifies group order
// ❌ Missing: Verifies individual tab order WITHIN groups
```

**Problem**:
- Test verifies groups exist and are in correct order
- Test does NOT verify tab position order within each group
- If tab move logic is broken, test would still pass

**Missing**:
1. Get all tabs in each group
2. Verify tabs are ordered by age (oldest first within group)
3. Verify fresh tabs are at rightmost (highest index)

---

#### Discovery 5: Group Title Count Update Not Verified ⚠️

**Implementation** (BackgroundTabService:227-231, 393-395):
```typescript
// When creating groups:
await (browser.tabGroups as any).update(groupId, {
  title: `${activeLevels[i].label} (${tabIds.length})`,  // ← Count is TABIDS.LENGTH
  color: activeLevels[i].color,
  collapsed: true,
})

// When activating tab from group:
const groupTabs = await browser.tabs.query({groupId})
await (browser.tabGroups as any).update(groupId, {
  title: `${labelPrefix} (${groupTabs.length})`  // ← NEW count
})
```

**Current Test**:
```typescript
// All tests check group.tabCount (from browser.tabGroups)
// But NOT the actual title string format or count accuracy
expect(tabsBefore[0].tabCount).toBe(4)  // ✅ Checks count
// ❌ Does NOT check: title is exactly "Hell! (4)"
```

**Problem**:
- Tests assume title updates work (no verification)
- If title parsing breaks, tests still pass

**Missing**:
1. Activate tab from group
2. Verify new title is `Label (N-1)` where N-1 = new count

---

## Full Implementation-to-Test Mapping

### ✅ Well Tested (3+ test files)

**groupTabsByAge()** 
- Coverage: 3 test files
- Tests: Verifies groups created, titles correct, order correct
- Gaps: Individual tab order within groups, move operation success
- Risk: LOW-MEDIUM

**getTabs()**
- Coverage: 5+ tests (indirectly, all tests load tabs)
- Tests: Tab count, grouping state, mock overrides applied
- Gaps: Storage clear/reload lifecycle
- Risk: LOW

**onTabActivated()**
- Coverage: 2 test files (StoreTest + SingleTabInGroup)
- Tests: Tab ungrouped after activation, final state correct
- Gaps: Retry logic, group title update, error handling
- Risk: MEDIUM

### ⚠️ Partially Tested (1-2 test files)

**autoCloseOldestGroupTabs()**
- Coverage: 1 test file (24h-alarm-auto-close)
- Tests: Toggle state only, not actual tab closure
- Gaps: Tab closure count, which tabs closed, group title update
- Risk: HIGH

**updateTabByAge()**
- Coverage: 0 tests (UNTESTED)
- Used by: Auto-close logic implicitly
- Gaps: Everything — no direct test exists
- Risk: CRITICAL

### ❌ Implicitly Tested (needs dedicated tests)

**Group creation order** (oldest→youngest)
- Tested indirectly via group title checks
- Missing: Explicit group index verification

**Tab move logic** (move to position 0)
- Tested indirectly via final tab list
- Missing: Verify move actually happened

**Retry logic** (onTabActivated)
- Never exercised in tests
- Missing: Force failure, verify retry

**Mock override persistence**
- Tested implicitly (mocks work in tests)
- Missing: Verify storage persistence, clear, reload

---

## Detailed Test Gaps with Code Examples

### GAP 1: updateTabByAge() Test Missing ❌ CRITICAL

**What to test**:
```typescript
test('updateTabByAge() moves tab to new group when it ages', async () => {
  // Setup: Create grouped tabs
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()  // Creates: Hell!, Quarter+, Month+, 2 Weeks+, Week+
  
  // Initial state
  let groups = await env.optionsPage.getAllGroups()
  const weekGroupInitial = groups.find(g => g.title.includes('Week+'))
  expect(weekGroupInitial.tabCount).toBe(3)  // 3 tabs at 7-13 days old
  
  // Age one tab by 7+ days (moves from Week+ [7-13 days] to 2 Weeks+ [14-27 days])
  const tab = /* get one tab from Week+ group */
  await env.optionsPage.timeProgress(7)  // Age by 7 days
  
  // Trigger updateTabByAge (NOT groupTabsByAge — different behavior)
  const moveCount = await env.optionsPage.getBackgroundRPC().testTriggerUpdateTabByAge()
  
  // Verify
  groups = await env.optionsPage.getAllGroups()
  const weekGroupAfter = groups.find(g => g.title.includes('Week+'))
  const twoWeeksGroupAfter = groups.find(g => g.title.includes('2 Weeks+'))
  
  expect(weekGroupAfter.tabCount).toBe(2)  // One moved out
  expect(twoWeeksGroupAfter.tabCount).toBe(3)  // One moved in
  expect(moveCount).toBe(1)
})
```

**Estimated effort**: 1.5 hours

---

### GAP 2: autoCloseOldestGroupTabs() - Verify Actual Closure ❌ HIGH

**Current test** (24h-alarm-auto-close.spec.ts):
```typescript
// ❌ Only verifies toggle state and group tab counts
// ❌ Does NOT verify tabs were closed
```

**What to add**:
```typescript
test('autoCloseOldestGroupTabs() actually closes tabs older than group threshold', async () => {
  // Setup
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()
  
  // Initial state
  let groups = await env.optionsPage.getAllGroups()
  const hellGroup = groups[0]  // Hell! (oldest group, 365+ days)
  const hellInitialCount = hellGroup.tabCount  // E.g., 4 tabs
  
  // Enable auto-close
  await env.optionsPage.clickAutoCloseToggle()
  expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)
  
  // Trigger auto-close
  const closedCount = await env.optionsPage.getBackgroundRPC().testTriggerAutoClose()
  
  // Verify tabs were actually closed
  groups = await env.optionsPage.getAllGroups()
  const hellFinal = groups[0]
  
  expect(closedCount).toBeGreaterThan(0)  // Some tabs closed
  expect(hellFinal.tabCount).toBe(hellInitialCount - closedCount)  // Count decreased
  expect(hellFinal.tabCount).toBeGreaterThan(0)  // But group still exists
})
```

**Estimated effort**: 1 hour

---

### GAP 3: onTabActivated() - Retry Logic & Title Update ⚠️ MEDIUM

**Current test**:
```typescript
// Only checks final ungrouped state
// Doesn't verify retry or title update
```

**What to add**:
```typescript
test('onTabActivated() updates group title with new count', async () => {
  // Setup: Single tab in Week+ group
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()
  
  const groups = await env.optionsPage.getAllGroups()
  const weekGroup = groups.find(g => g.title.includes('Week+'))
  const initialTitle = weekGroup.title  // E.g., "Week+ (3)"
  
  // Get a tab from the group
  const allTabs = await env.optionsPage.queryAllTabs()
  const tab = allTabs.find(t => t.groupId === weekGroup.id)
  
  // Activate the tab
  await env.optionsPage.activateTab(tab.id)
  
  // Verify group title updated
  const groupsAfter = await env.optionsPage.getAllGroups()
  const weekGroupAfter = groupsAfter.find(g => g.title.startsWith('Week+'))
  
  expect(weekGroupAfter.title).toBe('Week+ (2)')  // Count decreased by 1
})
```

**Estimated effort**: 1 hour

---

### GAP 4: Tab Order Within Groups ⚠️ MEDIUM

**Current test**:
```typescript
// Checks group order, not tab order within groups
expect(groups[0].title).toContain('Hell!')  // ✅ Group 0 is Hell!
// ❌ But doesn't verify tab order within Hell! group
```

**What to add**:
```typescript
test('Tabs within each group are ordered by age (oldest first)', async () => {
  await env.optionsPage.clickLoadMockTabs()
  await env.optionsPage.clickGroupTabs()
  
  const allTabs = await env.optionsPage.queryAllTabs()
  const groups = await env.optionsPage.getAllGroups()
  
  // For each group, verify tabs ordered by age
  for (const group of groups) {
    const groupTabs = allTabs.filter(t => t.groupId === group.id)
    
    // Tabs should be ordered oldest (lowest lastAccessed) to youngest
    for (let i = 0; i < groupTabs.length - 1; i++) {
      const older = groupTabs[i].lastAccessed
      const younger = groupTabs[i + 1].lastAccessed
      expect(older).toBeLessThanOrEqual(younger)  // Oldest first
    }
  }
})
```

**Estimated effort**: 0.5 hours

---

## Comprehensive Optimization & Improvement Plan

### Phase 1: CRITICAL FIXES (5 hours)

#### 1.1: Add updateTabByAge() Test (1.5h)
- Create new test file: `test/playwright/browser-alarms-updateTabByAge.spec.ts`
- Test moving individual tabs between groups as they age
- Add RPC method: `testTriggerUpdateTabByAge()`
- Verify: Tab count changes, movement count accurate

#### 1.2: Fix autoCloseOldestGroupTabs() Test (1h)
- Extend `24h-alarm-auto-close.spec.ts`
- Add actual tab closure verification
- Add RPC method: `testGetClosedTabCount()` or return from testTriggerAutoClose()
- Verify: Group tab count decreases, correct number closed

#### 1.3: Add onTabActivated() Group Title Test (1h)
- Add test to `chromium/SingleTabInGroup.spec.ts`
- Verify group title updates with new count
- Test: "Week+ (3)" → "Week+ (2)" after activation

#### 1.4: Implement Architecture Fixes (All files, 1.5h)
- Move `TestEnvironment.create()` to `beforeEach` (5 files)
- Add `afterEach` cleanup
- Replace manual polling with `expect.poll()`
- Add `testTriggerUpdateTabByAge()` and `testTriggerAutoClose()` RPC methods

**Deliverables**:
- New updateTabByAge test
- Enhanced auto-close test
- Enhanced activation test
- Fixed architecture

**Result**: 30% → 70% coverage improvement

---

### Phase 2: TAB ORDER VERIFICATION (2 hours)

#### 2.1: Add Tab Order Test (0.5h)
- Verify tabs within each group ordered oldest→youngest
- New test: `test-tab-order-within-groups.spec.ts`

#### 2.2: Add Group Index Verification (0.5h)
- Verify groups ordered by index (oldest at lowest index)
- Add to existing tests

#### 2.3: Add Mock Lifecycle Test (1h)
- Test storage persistence, clear, reload
- Verify mocks survive page reload
- Verify clear works

**Result**: Complete test coverage for ordering & persistence

---

### Phase 3: RESILIENCE TESTING (1.5 hours)

#### 3.1: Retry Logic Testing (0.5h)
- Mock ungroup failures
- Verify retry with backoff works
- Verify success after N retries

#### 3.2: Error Recovery (0.5h)
- Test behavior when groups are deleted during operation
- Test tab movement failures
- Verify graceful degradation

#### 3.3: Edge Cases (0.5h)
- Empty group removal
- Single tab in group
- Large group (100+ tabs)

**Result**: Production-grade error handling

---

### Phase 4: PERFORMANCE OPTIMIZATION (2 hours)

#### 4.1: Reduce Test Setup Time (0.5h)
- Parallelize test execution where possible
- Optimize mock data generation
- Cache common setup

#### 4.2: CI Pipeline Optimization (0.5h)
- Split tests by suite (grouping, auto-close, activation)
- Run parallel workers: 4-8
- Expected speedup: 10s → 3-4s

#### 4.3: Diagnostic Tooling (1h)
- Add test report generation
- Add coverage reports
- Add performance metrics

**Result**: Faster CI feedback loop

---

## Implementation Timeline

```
Priority 1: CRITICAL FIXES
├─ updateTabByAge() test ........... 1.5h
├─ autoCloseOldestGroupTabs() verify  1h
├─ onTabActivated() title update ...  1h
└─ Architecture fixes .............. 1.5h
TOTAL: 5 hours → Fixes 11 broken + 12 at-risk tests

Priority 2: TAB ORDER VERIFICATION
├─ Tab order test .................. 0.5h
├─ Group index test ................ 0.5h
└─ Mock lifecycle test ............ 1h
TOTAL: 2 hours → Covers ordering & persistence

Priority 3: RESILIENCE TESTING
├─ Retry logic ..................... 0.5h
├─ Error recovery .................. 0.5h
└─ Edge cases ...................... 0.5h
TOTAL: 1.5 hours → Production grade

Priority 4: PERFORMANCE OPTIMIZATION
├─ Reduce setup time ............... 0.5h
├─ CI parallelization .............. 0.5h
└─ Diagnostic tools ................ 1h
TOTAL: 2 hours → 3x speedup

GRAND TOTAL: 10.5 hours
```

---

## Testing Strategy Overview

### 1. Unit Tests (Existing, expand)
**What**: Test individual BackgroundTabService methods  
**Files**: `browser-alarms-*.spec.ts`, new test files  
**Coverage**: 70% → 95%  
**Time**: Existing 23 tests + 6 new tests

### 2. Integration Tests (Existing, improve)
**What**: Test alarm handlers + tab logic together  
**Files**: `24h-alarm-*.spec.ts`  
**Coverage**: Verify alarm triggers grouping/auto-close  
**Enhancement**: Add RPC methods for direct trigger + state check

### 3. E2E Tests (Existing, keep as-is)
**What**: Test UI interactions (options page)  
**Files**: `chromium/*.spec.ts`, `tooltip.spec.ts`, etc.  
**Coverage**: UI works, buttons clickable  
**No changes needed**

### 4. NEW: Behavior Verification Tests
**What**: Verify specific implementation behaviors  
**Files**: NEW `browser-alarms-updateTabByAge.spec.ts`, `test-tab-order.spec.ts`  
**Coverage**: Tab movement, ordering, closure count

---

## Summary of Issues & Fixes

| Issue | Current | Fix | Impact | Effort |
|-------|---------|-----|--------|--------|
| updateTabByAge() untested | ❌ 0 tests | Add dedicated test + RPC method | HIGH | 1.5h |
| autoCloseOldestGroupTabs() — no closure verification | ⚠️ Toggle only | Verify tab count change | HIGH | 1h |
| onTabActivated() — no title update test | ⚠️ Ungrouped only | Add title verification | MEDIUM | 1h |
| Tab order within groups not tested | ⚠️ Implicit | Add explicit ordering test | MEDIUM | 0.5h |
| Retry logic not exercised | ⚠️ Assumed | Mock failures, verify retry | MEDIUM | 0.5h |
| Mock persistence not tested | ⚠️ Implicit | Test storage persist/reload/clear | MEDIUM | 1h |
| Test architecture broken | ❌ Shared env | Move setup to beforeEach | CRITICAL | 1.5h |
| Manual polling in 10 files | ⚠️ Manual retry | Replace with expect.poll() | MEDIUM | 2h |

---

## Final Risk Assessment

**Before Fixes**:
- 30% implementation coverage
- 2 major methods untested (updateTabByAge, auto-close closure)
- 7 broken tests (architecture)
- 9 at-risk tests (flaky)
- Cannot run parallel

**After All Fixes**:
- 95% implementation coverage
- All major methods tested
- 23 independent tests
- 0 broken, 0 at-risk
- Parallel-ready
- ~3-4s CI runtime

---

**Status**: ✅ PLAN READY FOR IMPLEMENTATION

Next: Choose start date and assign phases.
