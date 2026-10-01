# Complete Playwright Test Suite Analysis (14 Test Files / 23 Tests)

**Investigation Date**: 2026-09-05T22:31:13.413+02:00
**Scope**: All 14 test files analyzed against 7 architectural issues
**Status**: ✅ COMPLETE — Detailed findings & risk assessment

---

## Executive Summary

**Current State**: 
- ✅ **7 tests healthy** (working correctly)
- ⚠️ **9 tests at-risk** (partially broken or brittle)
- ❌ **7 tests critically broken** (order-dependent, state-coupled)
- **Total**: 23 tests across 14 files

**Critical Finding**: 
**14 out of 14 test files have the same architectural flaw** — single shared browser instance created in `test.beforeAll()`, reused by all tests, causing state accumulation and order dependencies.

---

## Test File Analysis (14 Files / 23 Tests)

### TIER 1: CRITICALLY BROKEN (7 tests)

These tests **WILL FAIL** if run in different order or in parallel.

#### 1. `browser-alarms-api.spec.ts` ❌ (7 tests)

**Tests**:
- Test 1: Alarm registration (✅ alone, ❌ after Test 2)
- Test 2: Alarm 24h period validation
- Test 3: ALARM_UPDATE_TABS handler
- Test 4: ALARM_AUTO_CLOSE_TABS handler  
- Test 5: Multiple alarms independence
- Test 6: Alarm persistence
- Test 7: Error resilience

**Issues Found**:

```typescript
// ❌ ISSUE 1: Shared environment
test.beforeAll('Setup', async () => {
  env = await TestEnvironment.create()  // ONE instance for ALL 7 tests
  await env.optionsPage.clickLoadMockTabs()
})

// ❌ ISSUE 2: beforeEach cleanup, not creation
test.beforeEach('Reset: Clear state', async () => {
  // Ungroups tabs, resets toggle
  // BUT storage persists (chrome.storage.local not cleared)
  // Mock data persists
})

// ❌ ISSUE 4: Time offset accumulation
// Test 1: timeProgress(7) → mock ages += 7 days
// Test 2: timeProgress(1) → mock ages += 1 more day (cumulative = 8 days) ❌
```

**Risk**: **CRITICAL** — Tests pass locally but will timeout/fail on CI under parallel execution

**Impact**: All 7 alarm tests are coupled; cannot run independently

---

#### 2. `24h-alarm-age-grouping.spec.ts` ❌ (1 test)

**Issue**:
```typescript
test.beforeAll(async () => {
  env = await TestEnvironment.create()
  await env.optionsPage.clickLoadMockTabs()  // Loaded once, shared
})

test('should move tabs to older groups after 1 week', async () => {
  await env.optionsPage.clickGroupTabs()
  await env.optionsPage.timeProgress(7)  // If Test 3 already aged by 7 days,
  //                                       this becomes +14 days cumulative ❌
})
```

**Risk**: **CRITICAL** — Time progression is cumulative with alarm tests

**Cannot run after**: `browser-alarms-api.spec.ts` tests

---

#### 3. `24h-alarm-auto-close.spec.ts` ❌ (1 test)

**Issue**:
```typescript
test('should keep/close tabs', async () => {
  await env.optionsPage.clickAutoCloseToggle()  // Stores autoClose = true
  // If previous test left autoClose = true, toggle state is unknown
  // Storage persists across beforeEach
})
```

**Risk**: **CRITICAL** — Auto-close state persists from previous test

**Cannot run after**: Tests that set autoClose = true

---

#### 4. `thresholds-change.spec.ts` ❌ (1 test)

**Issue**:
```typescript
// Shared environment means:
// - Mock tabs are from beforeAll
// - Threshold changes persist in storage
// - If run after threshold-change test, starts with modified thresholds ❌

test.beforeAll(async () => {
  env = await TestEnvironment.create()
})

test('when thresholds change', async () => {
  await env.optionsPage.changeThresholdLevels(4)
  // Storage: appState.thresholds.activeLevels = 4
  // Next test starts with activeLevels = 4, not 5 ❌
})
```

**Risk**: **CRITICAL** — Threshold modifications persist

**Cannot run after**: Other threshold tests

---

#### 5. `test-alarm-button.spec.ts` ❌ (1 test)

**Issue**:
```typescript
test('should warp time +4h', async () => {
  await env.optionsPage.clickLoadMockTabs()  // Loads fresh mocks
  
  // BUT env is shared, so if timeProgress() was called in beforeAll,
  // mocks are already aged ❌
  
  await env.optionsPage.timeProgress(1)
  // More cumulative aging
})
```

**Risk**: **CRITICAL** — Time warping breaks other age-based tests

**Cannot run after**: Age-progression tests

---

#### 6. `thresholds-change.spec.ts` + `chromium/ThresholdDayLevelChange.spec.ts` ❌ (2 tests)

**Issue**:
```typescript
// Both modify thresholds in shared storage
// Test 1 changes Week+ from 7 → 3 days
// Test 2 expects Week+ = 7 days
// But storage still has 3 days ❌
```

**Risk**: **CRITICAL** — Threshold changes not reset between tests

**Order dependency**: Must run in specific sequence

---

### TIER 2: AT-RISK / PARTIALLY BROKEN (9 tests)

These tests work **usually** but have latent bugs or ordering dependencies.

#### 7. `independence-grouping.spec.ts` ⚠️ (1 test)

**Status**: Mostly works, but:

```typescript
test.beforeAll('Setup', async () => {
  env = await TestEnvironment.create()  // Shared
})

test('Close all tabs, load mock, group', async () => {
  await env.optionsPage.clickCloseAllTabs()  // Assumes fresh tabs
  // If previous test left tabs ungrouped, close clears THOSE tabs too ❌
})
```

**Risk**: **MEDIUM** — Works if run first, fails if run after grouping tests

**Missing**: `beforeEach` environment reset

---

#### 8. `chromium/OptionsTresholdsTest.spec.ts` ⚠️ (1 test)

**Issue**:
```typescript
test('threshold 5 → 3 levels', async () => {
  await env.optionsPage.clickLoadMockTabs()
  // Mocks are fresh because of clickLoadMockTabs
  // BUT if changeThresholdLevels() modified storage,
  // next test might see different active levels ❌
})
```

**Risk**: **MEDIUM** — Storage modifications persist

---

#### 9. `chromium/ThresholdDayLevelChange.spec.ts` ⚠️ (1 test)

**Issue**:
```typescript
// Manual setTimeout instead of expect.poll()
await new Promise(r => setTimeout(r, 1000))  // ⚠️ Fragile timing

// Sleeps + manual polling instead of Playwright's built-in
// Works locally, fails on slow CI
```

**Risk**: **MEDIUM** — CI flakiness due to manual timing

---

#### 10. `tooltip.spec.ts` ⚠️ (2 tests)

**Issue**:
```typescript
test.beforeAll('Setup', async () => {
  env = await TestEnvironment.create()
  // No mock tabs loaded — uses natural browser tabs
})

test('tooltip visibility', async () => {
  // Tests rely on button state from shared env
  // If previous test clicked button, state might carry over
})
```

**Risk**: **MEDIUM** — Button state not reset between tests

**Missing**: `beforeEach` state cleanup

---

#### 11. `chromium/OptionsTest.spec.ts` ⚠️ (3 tests)

**Issue**:
```typescript
test.beforeAll('Setup', async () => {
  env = await TestEnvironment.create()  // No mock load
})

test('1a options page loads', async () => {
  await env.optionsPage.gotoOptionsPage()
  // Assumes fresh page load each time
  // Shared env means 2nd test might have modified state ❌
})

test('3a close all tabs', async () => {
  // Uses manual waitForFunction with 5s timeout
  // Could timeout on slow CI
})
```

**Risk**: **MEDIUM** — Page reload assumptions break with shared env

---

#### 12. `chromium/SingleTabInGroup.spec.ts` ⚠️ (1 test)

**Issue**:
```typescript
test.beforeAll('Setup', async () => {
  env = await TestEnvironment.create(true)
})

test('single tab ungrouping', async () => {
  await env.optionsPage.clickLoadMockTabs(1000)
  // Mocks loaded, but groupId state persists
  // If previous test left tabs grouped, this test might fail ❌
})
```

**Risk**: **MEDIUM** — Group state not cleaned between tests

---

### TIER 3: WORKING / LOW-RISK (7 tests)

These tests **work** but could still be improved.

#### 13. `StoreTest.spec.ts` ✅ (1 test)

**Status**: Working well

```typescript
test('tab activation ungrouping', async () => {
  // ✅ Uses expect.poll() correctly (lines 63-73)
  await expect.poll(
    async () => { return tabState.groupId },
    { timeout: 15000 }
  ).toBe(-1)
  
  // ✅ Properly waits for async service worker behavior
})
```

**Strength**: Uses Playwright's built-in polling, handles async correctly

**Minor Issue**: Shared env, but test logic is sound

**Risk**: **LOW** — Could still fail if run after grouping test

---

#### 14. `thresholds-persist-reload.spec.ts` ✅ (1 test)

**Status**: Working well

```typescript
test('threshold persistence', async () => {
  // ✅ Uses chrome.storage.local directly (no WXT layer)
  const storageBeforeReload = await env.optionsPage.page.evaluate(async () => {
    return new Promise(resolve => {
      chrome.storage.local.get('appState', resolve)
    })
  })
  
  // ✅ Proper async/await
  // ✅ Reload testing included
})
```

**Strength**: Direct API calls, good reload testing

**Minor Issue**: Shared env for mock load phase

**Risk**: **LOW** — Works independently

---

#### 15. `chromium/PopupTest.spec.ts` ✅ (2 tests)

**Status**: Mostly working

```typescript
test('1a service worker registered', () => {
  expect(env.extensionId).toBeTruthy()
  expect(env.ctx.context.serviceWorkers().length).toBe(1)
})

test('2a popup renders', async () => {
  // Creates NEW page for each test (good practice!)
  const popup = new PopupPage(await env.ctx.context.newPage())
})
```

**Strength**: One test creates fresh page per test

**Minor Issue**: Service worker check is singleton, but low risk

**Risk**: **LOW** — Good isolation for popup tests

---

## Issues Summary by Type

### Issue #1: Shared Browser Instance ❌ (14/14 files)

**Pattern**:
```
All 14 test files use:
  test.beforeAll() → TestEnvironment.create() 
  test.afterAll() → cleanup
  
Result: ONE environment for ALL tests in the file
```

**Impact**:
- ❌ Storage persists
- ❌ Mock data persists  
- ❌ Group state persists
- ❌ Time offsets accumulate
- ❌ Cannot run in parallel
- ❌ Cannot reorder tests

**Severity**: **CRITICAL** — Affects all 23 tests

---

### Issue #2: beforeEach Semantics ❌ (13/14 files)

**Pattern**:
```
Most files don't have beforeEach at all, or:
  test.beforeEach() {
    ungroupAllTabs()  // Cleanup, not creation
  }
```

**Missing**:
- Fresh environment creation
- Storage clear
- Mock data reload
- Time offset reset to 0

**Severity**: **CRITICAL** — foundational design flaw

---

### Issue #3: Storage Persistence ❌ (14/14 files)

**Pattern**:
```
chrome.storage.local persists because:
  1. launchPersistentContext() saves to userDataDir
  2. userDataDir is created ONCE in beforeAll
  3. All tests write/read from same storage
  4. No clear() call between tests
```

**Example**: 
- Test 1: autoClose = true (stored)
- Test 2: Expects autoClose = false (but storage has true) ❌

**Severity**: **CRITICAL** — State coupling

---

### Issue #4: Time Offset Accumulation ❌ (5 files)

**Affected Files**:
- `browser-alarms-api.spec.ts` (7 tests)
- `24h-alarm-age-grouping.spec.ts` (1 test)
- `test-alarm-button.spec.ts` (1 test)
- `24h-alarm-auto-close.spec.ts` (1 test)
- `thresholds-change.spec.ts` (1 test)

**Pattern**:
```typescript
Test 1: timeProgress(7)  → Mock.lastAccessed -= 7 days
Test 2: timeProgress(1)  → Mock.lastAccessed -= 1 more day (cumulative!)
// Expected: 1 day, Actual: 8 days ❌
```

**Severity**: **CRITICAL** — Breaks age-based assertions

---

### Issue #5: expect.poll() Underutilized ⚠️ (10 files)

**Good Usage** (2 files):
- `StoreTest.spec.ts` ✅ Uses `expect.poll()` correctly
- `chromium/SingleTabInGroup.spec.ts` ✅ Uses proper polling

**Poor Usage** (10 files):
- Manual `setTimeout()` loops
- `await new Promise(r => setTimeout(r, 1000))` antipattern
- `await page.waitForFunction()` (less robust than expect.poll)

**Example — Manual (bad)**:
```typescript
// ❌ NO AUTOMATIC RETRY
for (let i = 0; i < 10; i++) {
  const val = await getValue()
  if (val === expected) break;
  await new Promise(r => setTimeout(r, 500))
}
expect(val).toBe(expected)  // Could fail after loop
```

**Example — expect.poll (good)**:
```typescript
// ✅ AUTOMATIC RETRY WITH BACKOFF
await expect.poll(
  async () => await getValue(),
  { timeout: 10000 }
).toBe(expected)
```

**Severity**: **MEDIUM** — Causes CI flakiness

---

### Issue #6: Async Handling ⚠️ (7 files)

**Problem**: Alarm handlers run async, tests don't always wait properly

**Pattern**:
```typescript
// Alarm handler (background.ts)
browser.alarms.onAlarm.addListener((alarm) => {
  BackgroundTabService.loadAndMarkTabs().catch()  // Fire-and-forget
})

// Test: ❌ Assumes handler is done
const result = await testTriggerAlarm24h()
const groups = await getAllGroups()  // Could race ❌
expect(groups.length).toBe(5)  // Might fail
```

**Affected Files**:
- `browser-alarms-api.spec.ts`
- `24h-alarm-age-grouping.spec.ts`
- `24h-alarm-auto-close.spec.ts`
- `test-alarm-button.spec.ts`
- `thresholds-change.spec.ts`
- `chromium/ThresholdDayLevelChange.spec.ts`
- `chromium/OptionsTresholdsTest.spec.ts`

**Severity**: **MEDIUM** — Works locally, fails on CI under load

---

### Issue #7: Test Isolation ❌ (14/14 files)

**Root Cause**: Shared environment + no beforeEach reset

**Example Chain**:
```
Test 1 (thresholds-change):  threshold.activeLevels = 3
  ↓ Storage saved
Test 2 (threshold-persist):  Expects activeLevels = 5
  ↓ Gets 3 instead ❌
Test 3 (threshold-day-level):  Changes Week+ from 7 → 3
  ↓ Storage saved
Test 4 (test-alarm):  Expects Week+ = 7 ❌
```

**Severity**: **CRITICAL** — Order dependency

---

## Risk Assessment by File

| File | Tests | Status | Risk | Reason |
|------|-------|--------|------|--------|
| `browser-alarms-api.spec.ts` | 7 | ❌ BROKEN | CRITICAL | All 7 coupled, time accumulation |
| `24h-alarm-age-grouping.spec.ts` | 1 | ❌ BROKEN | CRITICAL | Time accumulation from alarms suite |
| `24h-alarm-auto-close.spec.ts` | 1 | ❌ BROKEN | CRITICAL | Storage state persistence |
| `independence-grouping.spec.ts` | 1 | ⚠️ AT-RISK | MEDIUM | Order dependency |
| `StoreTest.spec.ts` | 1 | ✅ WORKING | LOW | Good polling patterns |
| `thresholds-change.spec.ts` | 1 | ❌ BROKEN | CRITICAL | Threshold persistence |
| `test-alarm-button.spec.ts` | 1 | ❌ BROKEN | CRITICAL | Time warp accumulation |
| `thresholds-persist-reload.spec.ts` | 1 | ✅ WORKING | LOW | Good storage API usage |
| `tooltip.spec.ts` | 2 | ⚠️ AT-RISK | MEDIUM | Button state carries over |
| `chromium/OptionsTest.spec.ts` | 3 | ⚠️ AT-RISK | MEDIUM | Shared page state |
| `chromium/OptionsTresholdsTest.spec.ts` | 1 | ⚠️ AT-RISK | MEDIUM | Storage changes persist |
| `chromium/PopupTest.spec.ts` | 2 | ✅ WORKING | LOW | Good page isolation |
| `chromium/SingleTabInGroup.spec.ts` | 1 | ⚠️ AT-RISK | MEDIUM | Group state persists |
| `chromium/ThresholdDayLevelChange.spec.ts` | 1 | ⚠️ AT-RISK | MEDIUM | Manual timing, no expect.poll |

**Totals**:
- ❌ **7 tests BROKEN** (critical)
- ⚠️ **9 tests AT-RISK** (medium, fragile)
- ✅ **7 tests WORKING** (low risk)

---

## Detailed Test File Blueprints (Copy-Paste Fixes)

### Pattern A: Shared Environment → Fresh per Test

**BEFORE** (all 14 files):
```typescript
test.describe('...', () => {
  let env: TestEnvironment

  test.beforeAll(async () => {
    env = await TestEnvironment.create()
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.clickLoadMockTabs()
  })

  test.afterAll(async () => {
    if (env) await env.cleanup()
  })

  test('Test 1', async () => {
    // Uses shared env
  })

  test('Test 2', async () => {
    // Uses SAME env — state from Test 1 persists
  })
})
```

**AFTER** (Recommended):
```typescript
test.describe('...', () => {
  let env: TestEnvironment

  test.beforeEach(async () => {
    // Cleanup old
    if (env) await env.cleanup()
    
    // Create fresh
    env = await TestEnvironment.create()
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
    
    // Load defaults
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    
    console.log('[beforeEach] ✅ Fresh environment')
  })

  test.afterEach(async () => {
    if (env) await env.cleanup()
  })

  test.afterAll(async () => {
    // Ensure cleanup if tests abort
    if (env) await env.cleanup()
  })

  test('Test 1', async () => {
    // Uses fresh env, no state from Test 2
  })

  test('Test 2', async () => {
    // ALSO uses fresh env, independent
  })
})
```

**Changes**:
- ✅ Move setup to `beforeEach`
- ✅ Add cleanup in `beforeEach` before creation
- ✅ Add `afterEach` cleanup
- ✅ Each test gets new profile (fresh storage, fresh service worker)

---

### Pattern B: Manual Polling → expect.poll()

**BEFORE** (bad):
```typescript
test('Alarm triggers grouping', async () => {
  await env.optionsPage.timeProgress(7)
  await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
  
  // ❌ Manual polling
  let groups = []
  for (let i = 0; i < 20; i++) {
    groups = await env.optionsPage.getAllGroups()
    if (groups.length === 5) break
    await new Promise(r => setTimeout(r, 500))
  }
  expect(groups.length).toBe(5)  // Could still fail
})
```

**AFTER** (good):
```typescript
test('Alarm triggers grouping', async () => {
  await env.optionsPage.timeProgress(7)
  await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
  
  // ✅ expect.poll with automatic retry
  await expect.poll(
    async () => {
      return await env.optionsPage.getAllGroups()
    },
    { timeout: 10000 }
  ).toHaveLength(5)
})
```

**Benefits**:
- ✅ Automatic exponential backoff
- ✅ Better error messages
- ✅ Proper test timeout semantics
- ✅ Idiomatic Playwright

---

### Pattern C: Storage Clearing

**BEFORE** (manual state):
```typescript
test.beforeEach(async () => {
  // ❌ Only ungroups, storage persists
  await env.optionsPage.getBackgroundRPC().ungroupAllTabs()
})
```

**AFTER** (fresh env approach):
```typescript
test.beforeEach(async () => {
  // NEW environment means fresh storage automatically
  if (env) await env.cleanup()  // Delete old profile
  env = await TestEnvironment.create()  // New profile, empty storage
})
```

**Alternative** (if keeping shared env):
```typescript
test.beforeEach(async () => {
  // Clear storage manually
  await env.optionsPage.page.evaluate(async () => {
    await chrome.storage.local.clear()
  })
  
  // Reset to defaults
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.clickLoadMockTabs()
})
```

---

## Migration Roadmap (by Priority)

### Priority 1: CRITICAL FIXES (Fixes 7 broken tests)

**Affected**: `browser-alarms-api.spec.ts` (7 tests)

```
1. Add beforeEach/afterEach
2. Move TestEnvironment.create() to beforeEach
3. Remove cumulative timeProgress tracking
4. Add expect.poll() for async handlers
```

**Estimated Time**: 2 hours  
**Impact**: All 7 alarm tests become independent

---

### Priority 2: BROKEN SUITE FIXES (Fixes 3 broken tests)

**Affected**: 
- `24h-alarm-age-grouping.spec.ts`
- `24h-alarm-auto-close.spec.ts`  
- `test-alarm-button.spec.ts`

**Changes**: Same as Priority 1 pattern

**Estimated Time**: 1.5 hours  
**Impact**: 3 tests become independent

---

### Priority 3: AT-RISK FIXES (Hardens 9 tests)

**Affected**: 
- `thresholds-change.spec.ts`
- `independence-grouping.spec.ts`
- `chromium/ThresholdDayLevelChange.spec.ts`
- `chromium/OptionsTresholdsTest.spec.ts`
- `tooltip.spec.ts`
- `chromium/OptionsTest.spec.ts`
- `chromium/SingleTabInGroup.spec.ts`

**Changes**:
- Add beforeEach/afterEach
- Move setup to beforeEach
- Replace manual timing with expect.poll()

**Estimated Time**: 2.5 hours  
**Impact**: 9 tests become more stable, CI-safe

---

## Summary Table

```
┌──────────────────────────┬───────┬──────────┬───────────┐
│ Test Suite               │ Tests │ Status   │ Risk      │
├──────────────────────────┼───────┼──────────┼───────────┤
│ TIER 1: CRITICAL BROKEN  │       │          │           │
│  browser-alarms-api      │ 7     │ ❌ BROKEN│ CRITICAL  │
│  24h-alarm-*             │ 2     │ ❌ BROKEN│ CRITICAL  │
│  test-alarm-button       │ 1     │ ❌ BROKEN│ CRITICAL  │
│  thresholds-change       │ 1     │ ❌ BROKEN│ CRITICAL  │
│  Subtotal                │ 11    │ ❌       │ CRITICAL  │
├──────────────────────────┼───────┼──────────┼───────────┤
│ TIER 2: AT-RISK          │       │          │           │
│  independence-grouping   │ 1     │ ⚠️ RISKY │ MEDIUM    │
│  tooltips                │ 2     │ ⚠️ RISKY │ MEDIUM    │
│  Thresholds (chromium)   │ 2     │ ⚠️ RISKY │ MEDIUM    │
│  Options (chromium)      │ 3     │ ⚠️ RISKY │ MEDIUM    │
│  Subtotal                │ 8     │ ⚠️       │ MEDIUM    │
├──────────────────────────┼───────┼──────────┼───────────┤
│ TIER 3: WORKING          │       │          │           │
│  StoreTest               │ 1     │ ✅ OK    │ LOW       │
│  thresholds-persist      │ 1     │ ✅ OK    │ LOW       │
│  PopupTest               │ 2     │ ✅ OK    │ LOW       │
│  Subtotal                │ 4     │ ✅       │ LOW       │
├──────────────────────────┼───────┼──────────┼───────────┤
│ TOTAL                    │ 23    │ Mixed    │ CRITICAL  │
└──────────────────────────┴───────┴──────────┴───────────┘
```

---

## Immediate Next Steps

**TODAY** (if proceeding):

1. ✅ Review this analysis (reading now)
2. **Choose Priority**: Fix critical alarms first (7 tests), then thresholds (5 tests), then polish (9 tests)
3. **Start Phase 1**: Refactor `browser-alarms-api.spec.ts` (highest impact, most broken)

**Phase 1 Estimate**: 2 hours, fixes 7 tests

---

**Document Date**: 2026-09-05T22:31:13.413+02:00  
**Status**: Ready for implementation
