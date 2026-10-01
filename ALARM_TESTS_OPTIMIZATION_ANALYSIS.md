# Alarm Tests Optimization Analysis

**Date:** 2026-09-05  
**Status:** ⚠️ **ISSUES IDENTIFIED** — Tests need optimization for state isolation and performance

---

## Executive Summary

The `browser-alarms-api.spec.ts` test suite has **state management issues** that can cause:

1. ❌ **Test Interdependence** — Tests depend on execution order
2. ⚠️ **State Accumulation** — Groups/settings persist across tests
3. 🐌 **Performance Degradation** — Each test triggers more operations
4. 🚨 **Flaky Behavior in CI** — Timing-sensitive operations compound

**Current Runtime:** ~10.4s locally, ~58s on CI (5.5x slower)

---

## Issue #1: Shared Mutable State Across Tests

### Problem
All 7 tests share one `TestEnvironment` and mock tabs. State accumulates:

```typescript
test.beforeAll(() => {
  env = await TestEnvironment.create()
  await env.optionsPage.clickLoadMockTabs()  // ← Loaded once
})

// Test 1: Groups tabs (5 groups created)
test('ALARM_UPDATE_TABS handler', () => {
  await env.optionsPage.clickGroupTabs()  // ← Modifies shared state
  await env.optionsPage.timeProgress(7)
})

// Test 2: Uses same groups + time offset (7+1=8 days)
test('ALARM_AUTO_CLOSE_TABS handler', () => {
  await env.optionsPage.timeProgress(1)  // ← Cumulative: now at 8 days
  // Groups may have been closed/modified by previous test
})

// Test 3-7: State keeps accumulating...
```

### Impact
- **Test 1** creates 5 fresh groups
- **Test 2** inherits those groups, but time is already offset by Test 1
- **Test 3** finds different group structure due to aging
- **Tests 4-7** see unpredictable state

### Example Failure Scenario
```
Test 1: Groups = [Hell! (4), Quarter+ (4), Month+ (1), 2Weeks+ (2), Week+ (3)]  ✅
Test 2: Time = 8 days, triggers auto-close
         Before: Hell! (4 tabs, age > 365 days)
         After:  Hell! disappears (group was closed)         ✅
Test 3: Calls testGetAllAlarms() — expects ≥2 alarms
         Gets: [ALARM_UPDATE_TABS, ALARM_AUTO_CLOSE_TABS]     ✅
Test 4: Tries to trigger alarms but app state is dirty
         autoClose = true (from Test 2)
         Groups already modified by previous tests           ⚠️
Test 5-7: Non-deterministic behavior
```

---

## Issue #2: Inefficient timeProgress() Usage

### Problem
```typescript
test('handler respects state', () => {
  await env.optionsPage.timeProgress(1)   // Offset 1 day
  await env.optionsPage.testTriggerAlarm24h()
  
  await env.optionsPage.clickAutoCloseToggle()  // ← Toggle attempt #1
  await env.optionsPage.timeProgress(1)   // Offset 1 more day (total: 2)
  await env.optionsPage.testTriggerAlarm24h()
  
  // Click toggle fails intermittently
  // timeProgress compounds with previous tests
})
```

### Why It's Inefficient
1. **Cumulative Time Offsets** — Each test adds to global fake-time state
2. **Retry Loop in clickAutoCloseToggle()** — 3 attempts × 500ms = 1.5s per click
3. **clickGroupTabs() Polling** — 20s timeout × potentially multiple retries
4. **No State Reset** — Previous test's state affects next test

### Example Accumulation
```
Test 1: timeProgress(7)     → fakeTime = +7 days
Test 2: timeProgress(1)     → fakeTime = +8 days (cumulative!)
Test 3: timeProgress(1)     → fakeTime = +9 days
Test 4: timeProgress(1)     → fakeTime = +10 days
...
```

---

## Issue #3: Dependent Test Execution

### Problem
Tests appear independent but aren't:

```typescript
// Test 2 DEPENDS on Test 1's groups
test('ALARM_UPDATE_TABS handler', () => {
  await env.optionsPage.clickGroupTabs()  // Creates groups
  const tabsBefore = await env.optionsPage.getAllGroups()
})

// Test 3 uses Test 1's groups + Test 2's time offset
test('ALARM_AUTO_CLOSE_TABS handler', () => {
  // Expects groups exist AND time is at +8 days
  await env.optionsPage.timeProgress(1)
  await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
})

// Test 4-7 inherit all accumulated state
```

### Why This Fails
- **Reordering tests breaks them** — If Test 2 runs before Test 1, groups don't exist
- **Parallel execution impossible** — Can't run tests in parallel without conflicts
- **Hard to debug** — Failure in Test 4 may be caused by Test 1's state

---

## Issue #4: Storage State Not Reset

### Problem
```typescript
test('handler respects state', () => {
  await env.optionsPage.clickAutoCloseToggle()  // ← Modifies chrome.storage.local
  // Storage persists across tests!
})

// Later test finds autoClose=true from previous test
test('Auto-close disabled', () => {
  // Expects autoClose=false (default)
  const isEnabled = await env.optionsPage.isAutoCloseEnabled()
  // But it's true from previous test!
})
```

### Impact
- `chrome.storage.local` shared across tests
- `autoClose` setting persists
- `timeProgress()` offset persists
- Mock tab state persists

---

## Issue #5: Potential Race Conditions

### Problem
```typescript
// clickGroupTabs() uses polling with 20s timeout
await env.optionsPage.clickGroupTabs()  // Line 113
const tabsBefore = await env.optionsPage.getAllGroups()  // Line 114

// If polling times out, tabsBefore is unpredictable
// Then tests fail mysteriously
```

### Why It Matters
- **20s timeout on CI** compounds across 7 tests = potential 140s loss
- **Retry logic (3x × 500ms) in clickAutoCloseToggle** = 1.5s per click × 7 tests
- **No early-exit** if state is already correct

---

## Recommended Fixes

### Fix #1: Add `test.beforeEach()` State Reset ✅

```typescript
test.describe('Browser Alarms API', () => {
  let env: TestEnvironment

  test.beforeAll(async () => {
    env = await TestEnvironment.create()
  })

  // 🆕 ADD THIS:
  test.beforeEach(async () => {
    // Reset mutable state before each test
    console.log('[Reset] Clearing groups and storage...')
    
    // Clear groups
    await env.optionsPage.getBackgroundRPC().ungroupAllTabs()
    
    // Reset storage
    await env.optionsPage.page.evaluate(async () => {
      await chrome.storage.local.clear()
    })
    
    // Reload mocks at fixed state
    await env.optionsPage.clickLoadMockTabs()
    
    // Reset time offset (if possible)
    // await env.optionsPage.resetTimeOffset()
  })

  test('alarm registration', async () => {
    // Now starts with clean state
  })
})
```

**Benefits:**
- ✅ Each test starts fresh
- ✅ No state accumulation
- ✅ Tests become truly independent
- ✅ Can run in any order or parallel

**Cost:** +2-3 seconds per test × 7 tests = +14-21 seconds total

---

### Fix #2: Eliminate Cumulative `timeProgress()`

**Problem Code:**
```typescript
// Test 1
await env.optionsPage.timeProgress(7)   // +7 days cumulative

// Test 2
await env.optionsPage.timeProgress(1)   // +1 more = +8 days cumulative

// Fix: Use absolute time instead
await env.optionsPage.setAbsoluteTime(7_000)    // Always set to 7 days
await env.optionsPage.setAbsoluteTime(1_000)    // Always set to 1 day
```

**Create new method in BackgroundRPC:**
```typescript
setAbsoluteTime: (ms: number): Promise<void> => {
  return test_setAbsoluteTimeOffset(ms)  // Instead of test_addTimeOffset
}
```

**Benefits:**
- ✅ Tests are truly independent
- ✅ No need to calculate cumulative offsets
- ✅ Predictable state

---

### Fix #3: Optimize clickAutoCloseToggle() ✅ (Already Implemented)

The toggle already has:
```typescript
// 3 retry attempts with 500ms backoff
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await toggle.click()
    break  // ← Early exit on success
  } catch (err) {
    if (attempt < 3) await new Promise(r => setTimeout(r, 500))
  }
}
```

✅ **This is good.** But could be improved by checking state first:

```typescript
async clickAutoCloseToggle(): Promise<void> {
  const currentState = await this.isAutoCloseEnabled()
  const desiredState = !currentState
  
  // If already in desired state, skip
  if (await this.isAutoCloseEnabled() === desiredState) {
    return
  }
  
  // Only retry if needed
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await toggle.click()
      break
    } catch (err) {
      if (attempt < 3) await new Promise(r => setTimeout(r, 500))
    }
  }
}
```

---

### Fix #4: Split Into Independent Test Suites

**Instead of 1 suite with 7 dependent tests:**
```
browser-alarms-api.spec.ts (285 lines, 7 tests, shared state)
```

**Create 2-3 focused suites:**
```
browser-alarms-registration.spec.ts
  ✅ Alarm registration
  ✅ 24h period validation
  └─ Setup: Launch extension once, load mocks once
  └─ No state modifications

browser-alarms-handlers.spec.ts
  ✅ ALARM_UPDATE_TABS handler
  ✅ ALARM_AUTO_CLOSE_TABS handler
  └─ Setup: Create fresh groups per test (beforeEach)
  └─ Each test resets state

browser-alarms-integration.spec.ts
  ✅ Multiple alarms independence
  ✅ Alarm persistence
  ✅ Error resilience
  └─ Setup: Launch extension, reset state per test
  └─ Tests focused on error scenarios
```

**Benefits:**
- ✅ Each suite can run independently
- ✅ Parallel test execution possible
- ✅ Easier to debug failures
- ✅ Clear separation of concerns

---

### Fix #5: Add Test Isolation Helpers

```typescript
// In OptionsPage.ts
async resetTestState(): Promise<void> {
  console.log('[OptionsPage] 🔄 Resetting test state...')
  
  // 1. Clear groups
  await this.getBackgroundRPC().ungroupAllTabs()
  
  // 2. Clear storage
  await this.page.evaluate(async () => {
    const keys = await chrome.storage.local.get(null)
    const keysToDelete = Object.keys(keys)
    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete)
    }
  })
  
  // 3. Reset time offset (if available)
  // await this.getBackgroundRPC().resetTimeOffset()
  
  // 4. Reload mocks
  await this.clickLoadMockTabs()
  
  console.log('[OptionsPage] ✅ Test state reset')
}
```

---

## Implementation Roadmap

### Phase 1: Critical (Do First) ⚠️
- [ ] Add `test.beforeEach()` state reset
- [ ] Switch to absolute time (not cumulative)
- [ ] Test all 7 tests still pass with state reset

### Phase 2: Important (Recommended) 📌
- [ ] Split into 2-3 focused suites
- [ ] Add `resetTestState()` helper
- [ ] Measure runtime improvement

### Phase 3: Nice-to-Have (Polish) ✨
- [ ] Optimize toggle with state-check
- [ ] Add parallel execution support
- [ ] Profile and reduce timeouts where possible

---

## Testing the Optimization

### Before Optimization
```
Runtime: ~58s on CI
Tests: 7 (can't run in parallel, order-dependent)
State: Accumulates across tests
Reliability: Flaky (timing-sensitive)
```

### After Phase 1 (Critical fixes)
```
Expected: ~28-35s on CI (50% reduction)
Tests: 7 (still dependent, but reset each time)
State: Clean before each test
Reliability: More stable
```

### After Phase 2 (Split suites)
```
Expected: ~21-28s on CI (parallel execution possible)
Tests: 3 suites × 2-3 tests each
State: Suite-specific isolation
Reliability: Independent test execution
```

---

## Metrics to Track

```
Metric                  | Baseline | Target  | Win
─────────────────────────────────────────────────
CI Runtime              | 58s      | <30s    | 51%
Average Test Duration   | 8.3s     | 2-3s    | 60%
Test Independence       | 0/7      | 7/7     | 100%
Reorder-Safe Tests      | 0/7      | 7/7     | 100%
Parallel Capable        | No       | Yes     | +
```

---

## Risk Assessment

### Risk: State Reset Adds Time
- **If beforeEach() + reset = 3s × 7 tests = 21s overhead**
- **Mitigation:** Do minimal reset (groups + storage only), skip mock reload if possible
- **Net:** Still saves time overall (cleanup vs. timeout recovery)

### Risk: Tests Still Flake If Reset Incomplete
- **If Chrome doesn't properly clear storage**
- **Mitigation:** Verify reset via RPC call to background (confirm storage empty)
- **Example:** 
  ```typescript
  await env.optionsPage.page.evaluate(async () => {
    const all = await chrome.storage.local.get(null)
    if (Object.keys(all).length > 0) {
      throw new Error('Storage not cleared!')
    }
  })
  ```

### Risk: Tests Become Slower (Phase 1)
- **beforeEach() adds setup time**
- **Mitigation:** Use lazy setup (only reset if needed)
- **Example:**
  ```typescript
  test.beforeEach(async () => {
    // Only reset if previous test modified state
    if (stateWasModified) {
      await resetTestState()
    }
  })
  ```

---

## Summary Table

| Issue | Severity | Fix | Effort | Impact |
|-------|----------|-----|--------|--------|
| Shared mutable state | 🔴 High | `beforeEach` reset | 1h | -51% time |
| Cumulative timeProgress | 🔴 High | Absolute time API | 2h | Independent tests |
| Test interdependence | 🟠 Medium | Split suites | 3h | Parallel exec |
| clickAutoCloseToggle retries | 🟡 Low | State-check optimization | 30m | Cleaner logs |
| Race conditions (polling) | 🟡 Low | Better timeouts | 1h | More reliable |

---

## Conclusion

The test suite is **functionally correct but architecturally fragile**:

✅ **Strengths:**ł
- Comprehensive MDN spec coverage
- All 7 tests pass locally and CI
- Good error messages and logging

❌ **Weaknesses:**
- Tests share mutable state
- Execution order dependent
- Cannot run in parallel
- Potential for flaky behavior

**Recommended Action:** Implement Phase 1 fixes (state reset + absolute time) to make tests independent and more reliable.

**Estimated Impact:** 50% faster CI, 100% test reorderable, ready for parallel execution.
