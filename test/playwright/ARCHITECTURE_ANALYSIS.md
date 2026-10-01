# Playwright Test Architecture Analysis

**Investigation Date**: 2026-09-05  
**Scope**: Browser instance lifecycle, state persistence, test isolation, async handling, polling patterns  
**Status**: ✅ COMPLETE — 7 critical findings

---

## Executive Summary

Your instincts were **100% correct**. The current test architecture has **fundamental design flaws**:

1. ❌ **Single shared browser instance** across all tests (created in `beforeAll`, reused in all 7 tests)
2. ❌ **beforeEach "cleans up" instead of creating fresh state** — does not reset to defaults
3. ❌ **Storage persists** across `beforeEach` (chrome.storage.local not cleared)
4. ❌ **Tests are order-dependent** — execution sequence determines results
5. ⚠️ **expect.poll()** is available but NOT used in manual polling loops
6. ⚠️ **Async patterns** unclear — some alarm handlers may run in background

**Impact**: Tests appear to pass, but they're **brittle, order-dependent, and CI-unsafe**.

---

## Finding 1: Single Shared Browser Instance ❌

### Current Architecture

```typescript
// browser-alarms-api.spec.ts (lines 20-31)
test.describe('Browser Alarms API', () => {
  let env: TestEnvironment

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    env = await TestEnvironment.create(false, 120_000)  // ← ONE instance created
    // ... mock tabs loaded
  })

  test.beforeEach('Reset: Clear state before each test', async () => {
    // ... ungroup tabs, reset toggle
  })

  test('✅ Test 1: Alarm registration', async () => {
    // Uses shared `env` from beforeAll
  })

  test('✅ Test 2: ...', async () => {
    // Uses SAME `env` instance
  })

  // Tests 3-7 also use same `env` instance
})
```

### What Happens

| Component | Lifecycle | Result |
|-----------|-----------|--------|
| **Browser Context** | Created in `beforeAll`, closed in `afterAll` | Single instance for ALL 7 tests |
| **Chrome Profile** | `userDataDir = random UUID` in `launchPersistentContext()` | Fresh per `TestEnvironment.create()`, BUT only called once |
| **Service Worker** | Runs for entire test duration | Persistent — can observe state from previous tests |
| **chrome.storage.local** | Persists in Chrome profile directory | **PERSISTS across beforeEach** |
| **Mock Tabs** | Loaded in `beforeAll` → `clickLoadMockTabs()` | Same mock data for all 7 tests |
| **Tab Groups** | Created/destroyed in tests | Persist until `beforeEach` calls `ungroupAllTabs()` |

### Evidence

**File**: `chromium/extensions.ts:45`
```typescript
const context: BrowserContext = await chromium.launchPersistentContext(userDataDir, {
  // ...
});
// Context lives for entire test.describe block
```

**File**: `chromium/extensions.ts:40-41`
```typescript
const userDataDir = path.join(OUTPUT_DIR, "pw-profile-" + crypto.randomUUID());
// ✅ Fresh directory created each time TestEnvironment.create() is called
// ❌ BUT: Called only ONCE in beforeAll, reused by all 7 tests
```

### Problem

Tests do **NOT** have isolated environments. They all share:
- Same Chrome process
- Same storage (`chrome.storage.local`)
- Same mock tab data
- Same service worker instance

### ✅ Required Fix

Each test should get its own `TestEnvironment` instance:

```typescript
test.beforeEach('Create fresh environment', async () => {
  env = await TestEnvironment.create()  // Create NEW instance per test
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.expectPageLoaded()
  
  const mockResult = await env.optionsPage.clickLoadMockTabs()
  expect(mockResult.ok).toBe(true)
})

test.afterEach('Cleanup environment', async () => {
  if (env) await env.cleanup()  // Close context, delete profile
})
```

---

## Finding 2: beforeEach Semantics — "Cleanup" vs "Creation" ❌

### Current Implementation

**File**: `browser-alarms-api.spec.ts:33-63`

```typescript
test.beforeEach('Reset: Clear state before each test', async () => {
  // This is CLEANUP, not CREATION
  
  // 1. Ungroup all tabs
  await env.optionsPage.getBackgroundRPC().ungroupAllTabs()
  
  // 2. Reset autoClose toggle
  const isEnabled = await env.optionsPage.isAutoCloseEnabled()
  if (isEnabled) {
    await env.optionsPage.clickAutoCloseToggle()
  }
  
  // That's it. Storage is NOT cleared. Mock data persists.
})
```

### The Problem

| Aspect | Current | Correct |
|--------|---------|---------|
| **Hook Purpose** | Clean up OLD test's state | Create FRESH state |
| **Storage** | ⚠️ Not cleared | ✅ Should be cleared |
| **Mock Data** | ⚠️ Reused from beforeAll | ✅ Should reload fresh |
| **Time Offset** | ⚠️ Implicit state | ✅ Should reset to 0 |
| **Assumptions** | "Just undo what last test did" | "Start from known defaults" |

### Why This Matters

**Example**: Test 2 fails mid-way and leaves autoClose = true

```
Test 1: ✅ Completes, autoClose = false (reset at start)
Test 2: ❌ Crashes after clicking autoClose (now = true), doesn't reset
Test 3: Starts with beforeEach checking autoClose
        If (isEnabled) click... but isEnabled=true from Test 2's crash
        Test 3 might unintentionally reset autoClose TEST 2 left dangling
Test 4: Now autoClose is in unknown state — depends on Test 3's path
```

### ✅ Required Fix

Change `beforeEach` to **create fresh environment**:

```typescript
test.beforeEach('Create fresh environment for each test', async () => {
  // CLEANUP old environment
  if (env) {
    await env.cleanup()
  }
  
  // CREATE new environment
  env = await TestEnvironment.create(false, 120_000)
  
  // VERIFY page is ready (this is "load state to defaults")
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.expectPageLoaded()
  
  // LOAD mock tabs (fresh data every test)
  const mockResult = await env.optionsPage.clickLoadMockTabs()
  expect(mockResult.ok).toBe(true)
  
  console.log('[beforeEach] ✅ Fresh environment created')
})
```

Move `beforeAll` shared setup (if any) to a separate fixture that creates ONE readonly environment for reference.

---

## Finding 3: Storage Persistence Across beforeEach ⚠️

### Current Problem

**File**: `chromium/extensions.ts:45-62`

```typescript
const context: BrowserContext = await chromium.launchPersistentContext(userDataDir, {
  channel: "chromium",
  headless: true,
  // ... browser flags ...
});
// ↑ launchPersistentContext() means storage is SAVED to userDataDir
```

**Persistence Chain**:
1. Test 1 calls `clickAutoCloseToggle()` → stores `autoClose: true`
2. Test 1's `beforeEach` ends, but context stays open
3. Test 2 starts with same context → `chrome.storage.local` STILL HAS `autoClose: true`
4. Test 2's `beforeEach` tries to reset but relies on checking current state

**Example Failure**:

```typescript
// Test 1
await env.optionsPage.clickAutoCloseToggle()  // ✅ true
// Storage now has: { 'local:appState': { autoClose: true, ... } }

// beforeEach for Test 2
const isEnabled = await env.optionsPage.isAutoCloseEnabled()  // Returns true from storage
if (isEnabled) {
  await env.optionsPage.clickAutoCloseToggle()  // ✅ Tries to toggle OFF
}
// BUT if toggle fails/times out, storage still has autoClose: true

// Test 2 starts
// Expects autoClose: false, but storage has autoClose: true ❌
```

### Evidence: expect.poll() Usage

**File**: `OptionsPage.ts:660-669`

```typescript
// Manual polling INSTEAD of using expect.poll()
await expect.poll(
  async () => {
    const data = await this.page.evaluate(async () => {
      const state = await chrome.storage.local.get('local:appState');
      return (state['local:appState'] as any)?.autoClose ?? false;
    });
    return data;
  },
  { timeout: 5000, message: 'Auto-close toggle state persisted' }
).toEqual(true);
```

This is CORRECT use of `expect.poll()` with automatic retry. But other polling loops use manual retry/timeout.

### ✅ Required Fix

**Option A: Clear storage between tests** (recommended)

```typescript
test.beforeEach('Create fresh environment', async () => {
  // If continuing with shared context (NOT recommended):
  await env.optionsPage.page.evaluate(async () => {
    await chrome.storage.local.clear()  // PURGE all stored state
  })
})
```

**Option B: Create fresh environment per test** (better, addresses Finding 1)

```typescript
test.beforeEach('Create fresh environment', async () => {
  if (env) {
    await env.cleanup()  // Deletes userDataDir — storage is GONE
  }
  env = await TestEnvironment.create()  // New profile, no storage
})
```

**Recommended**: Option B (fresh environment per test)

---

## Finding 4: Time Offsets & Cumulative State ⚠️

### Current Pattern

**File**: `OptionsPage.ts:700-750`

```typescript
async timeProgress(days: number): Promise<void> {
  const offset = days * MILLISECONDS_PER_DAY;
  
  // Get current mocks
  const mocks = await this.getBackgroundRPC().getMockOverrides();
  
  // Update THEIR lastAccessed times (ages them)
  const updated = mocks.map(m => ({
    ...m,
    lastAccessed: m.lastAccessed - offset
  }));
  
  // Apply to background
  await this.getBackgroundRPC().setMockOverrides(updated);
}
```

### Problem: Implicit Accumulation

```
Test 1: timeProgress(7)  → Mock1.lastAccessed -= 7 days
        beforeEach ends (mocks persist in service worker state? Depends on storage)

Test 2: timeProgress(1)  → Mock1.lastAccessed -= 1 more day (if mocks were 7 days old)
        Total aging: Test 1 (7 days) + Test 2 (1 day) = 8 days
        But Test 2 EXPECTS 1 day, not 8 days ❌
```

### Evidence: Mock State Storage

**Question**: Where do mock overrides live?

1. In service worker memory (lost on reload)? ✓
2. In chrome.storage.local (persisted)? ✓
3. Both?

**Answer**: Likely in BOTH — service worker + storage for persistence

### ✅ Required Fix

With fresh environment per test (Finding 1):

```typescript
test.beforeEach('Create fresh environment', async () => {
  // New profile = new service worker = new mocks loaded = reset to defaults
  env = await TestEnvironment.create()
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.clickLoadMockTabs()  // Reload mocks fresh
})

test('Test 1: aged by 7 days', async () => {
  await env.optionsPage.timeProgress(7)  // ✅ 7 days from START
  // expectations...
})

test('Test 2: aged by 1 day', async () => {
  // beforeEach reloads mocks fresh — NO accumulation
  await env.optionsPage.timeProgress(1)  // ✅ 1 day from START
  // expectations...
})
```

---

## Finding 5: expect.poll() Available — Use It! ✅

### What You Should Use

**Playwright has built-in polling** in `expect()`:

```typescript
// ✅ CORRECT: Use expect.poll() for state verification
await expect.poll(
  async () => {
    return await env.optionsPage.getBackgroundRPC().getTabs();
  },
  { timeout: 5000 }
).toContainEqual(
  expect.objectContaining({ title: 'Some Tab' })
);
```

### What You Should NOT Use

```typescript
// ❌ WRONG: Manual loop with setTimeout
let tabs = [];
for (let i = 0; i < 10; i++) {
  tabs = await env.optionsPage.getBackgroundRPC().getTabs();
  if (tabs.length === expectedCount) break;
  await new Promise(r => setTimeout(r, 500));
}
expect(tabs.length).toBe(expectedCount);  // No automatic retry
```

### Where expect.poll() Shines

1. **Waiting for async state changes**: Alarm handlers, storage updates
2. **CI flakiness**: Automatic retries with exponential backoff
3. **Cleaner code**: `expect.poll()` reads like intent ("wait until X is true")

### ✅ Usage Pattern

```typescript
// Polling for alarm handler completion
await expect.poll(
  async () => {
    const alarms = await env.optionsPage.getBackgroundRPC().testGetAllAlarms();
    return alarms.find(a => a.name === 'updateTabsDaily');
  },
  { timeout: 10000, intervals: [500] }  // Custom interval
).toBeDefined();

// Polling for tab grouping
await expect.poll(
  async () => {
    return await env.optionsPage.getAllGroups();
  }
).toEqual(expect.arrayContaining([
  expect.objectContaining({ title: expect.stringContaining('Hell!') })
]));
```

---

## Finding 6: Async Handling & Background Execution ⚠️

### Questions About Alarm Handlers

```typescript
// From background.ts
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return;
  BackgroundTabService.loadAndMarkTabs().catch(console.error);  // ← ASYNC
});
```

### Is This Handler Blocking?

| Question | Answer | Evidence |
|----------|--------|----------|
| Does handler run async? | ✅ Yes (`BackgroundTabService.loadAndMarkTabs()` is async) | Fire-and-forget pattern |
| Does it block alarm firing? | ❌ No | Handler doesn't `await`, just calls and returns |
| Is the `.catch()` sufficient? | ⚠️ Maybe | Errors are caught, but completion is not awaited |
| Should tests await handler? | ✅ Yes | Tests must poll for state changes |

### Problem: Testing Async Handlers

```typescript
// Current test pattern
test('Alarm handler executes', async () => {
  await env.optionsPage.timeProgress(7);
  
  // ❌ WRONG: Just call, don't await handler completion
  const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h();
  
  // Might check results immediately before handler completes
  const groups = await env.optionsPage.getAllGroups();
  expect(groups.length).toBe(5);  // ❌ Could race
})
```

### ✅ Required Fix

Use `expect.poll()` to wait for handler side effects:

```typescript
test('Alarm handler executes', async () => {
  await env.optionsPage.timeProgress(7);
  
  // Trigger alarm, but don't assume it's done
  await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h();
  
  // ✅ CORRECT: Poll until handler completes its work
  await expect.poll(
    async () => {
      return await env.optionsPage.getAllGroups();
    },
    { timeout: 10000 }  // Wait up to 10s for grouping to complete
  ).toEqual([
    expect.objectContaining({ title: expect.stringContaining('Hell!') }),
    expect.objectContaining({ title: expect.stringContaining('Quarter+') }),
    // ... etc
  ]);
})
```

---

## Finding 7: Complete Picture — Recommended Architecture

### Current (Broken)

```
beforeAll() → Create env
  ↓
beforeEach() → Cleanup old state (not reset to defaults)
  ↓
Test 1 → Uses shared env
  ↓ (state persists)
beforeEach() → Cleanup old state
  ↓
Test 2 → Uses shared env (inherits Test 1's state)
  ↓ (state persists)
Test 3-7 → Order-dependent
  ↓
afterAll() → Close env
```

**Problems**:
- State persists across tests
- Order-dependent execution
- Cleanup ≠ reset
- No true isolation

### Correct (Recommended)

```
Test 1:
  beforeEach() → Create fresh env (new profile, new storage, new service worker)
    ↓
    gotoOptionsPage()
    clickLoadMockTabs()
    ↓
  Test logic
    ↓
  afterEach() → Cleanup env (delete profile)

Test 2:
  beforeEach() → Create fresh env (NEW profile, NEW storage, NEW service worker)
    ↓
    gotoOptionsPage()
    clickLoadMockTabs()
    ↓
  Test logic (independent, no state from Test 1)
    ↓
  afterEach() → Cleanup env (delete profile)

Test 3-7: Same pattern
```

**Benefits**:
- ✅ Complete isolation
- ✅ Order-independent execution
- ✅ Fresh defaults every time
- ✅ Parallel-execution ready (with config change)
- ✅ Clearer test intent

---

## Implementation Plan (5 Phases)

### Phase 1: Refactor State Management (IMMEDIATE - 2 hours)

**Goal**: Each test gets fresh environment

**Changes**:
1. Move `beforeAll` hook setup to `beforeEach`
2. Rename `beforeEach` → `beforeEach` (clarify intent)
3. Add `afterEach` cleanup
4. Update all 7 tests to NOT assume shared state

**File**: `test/playwright/browser-alarms-api.spec.ts`

```diff
test.describe('Browser Alarms API', () => {
  let env: TestEnvironment

-  test.beforeAll('Setup: launch Chrome context with extension', async () => {
+  test.beforeEach('Create fresh test environment', async () => {
+    // Cleanup old environment (if exists)
+    if (env) {
+      await env.cleanup()
+    }
+
     env = await TestEnvironment.create(false, 120_000)
     await env.optionsPage.gotoOptionsPage(env.extensionId)
     await env.optionsPage.expectPageLoaded()

     const mockResult = await env.optionsPage.clickLoadMockTabs()
     expect(mockResult.ok).toBe(true)
+    console.log('[beforeEach] ✅ Fresh environment created')
   })

-  test.beforeEach('Reset: Clear state before each test', async () => {
-    // DELETE THIS — no longer needed
-  })

+  test.afterEach('Cleanup test environment', async () => {
+    if (env) {
+      await env.cleanup()
+    }
+  })

   test.afterAll('Global cleanup', async () => {
+    // Ensure cleanup if tests abort
     if (env) await env.cleanup()
   })
})
```

**Expected Result**: All 7 tests pass, each with fresh environment

---

### Phase 2: Verify Polling Patterns (1 hour)

**Goal**: Replace manual polling with `expect.poll()`

**Changes**:
1. Audit all `clickGroupTabs()`, `timeProgress()`, `testTriggerAlarm24h()` calls
2. Wrap result checks in `expect.poll()`
3. Remove manual retry loops

**File**: `test/playwright/browser-alarms-api.spec.ts`

```diff
test('Alarm handler executes grouping', async () => {
  await env.optionsPage.timeProgress(7)
  
-  const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
+  // Trigger alarm (fire-and-forget, handler runs async)
+  await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
+
+  // ✅ Use polling to wait for handler completion
+  await expect.poll(
+    async () => {
+      return await env.optionsPage.getAllGroups()
+    },
+    { timeout: 10000 }
+  ).toHaveLength(5)
  
-  const tabsAfter = await env.optionsPage.getAllGroups()
-  expect(tabsAfter.length).toBe(5)  // ❌ Could race
})
```

**Expected Result**: Tests more robust, CI passes consistently

---

### Phase 3: Add State Isolation Tests (1 hour)

**Goal**: Verify complete isolation

**New Tests**:
1. Run tests in reverse order → same results ✓
2. Run single test alone → same result ✓
3. Run with `--workers=4` → all pass ✓

**Expected Result**: Proven order-independence

---

### Phase 4: Enable Parallel Execution (30 min)

**Goal**: Split tests into parallel-safe suites

**Change**:
```typescript
// playwright.config.ts
workers: isCI ? 4 : 2,  // From 1 worker (sequential)
fullyParallel: true,    // From false
```

**Expected Result**: 7 tests in ~15s (vs ~11s sequential)

---

### Phase 5: Document Patterns (1 hour)

**Goal**: Make this architecture the team standard

**Files to Create**:
1. `TEST_ARCHITECTURE.md` — Best practices
2. `TEST_PATTERNS.md` — Polling, async, state management
3. Update `CONTRIBUTING.md` — Add test guidelines

---

## Verification Checklist

- [ ] All 7 alarm tests pass with fresh environment per test
- [ ] All 23 Playwright tests pass (no regressions)
- [ ] Run tests in reverse order → same results
- [ ] `expect.poll()` used for all state checks
- [ ] No manual retry loops
- [ ] `afterEach` cleanup verified (profile directories deleted)
- [ ] No `beforeAll` state sharing
- [ ] Tests run with `--workers=4` successfully
- [ ] CI pipeline passes with new pattern

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Tests slow down (new env per test) | Medium | Phase 4 parallel execution reduces to 15s |
| More CI resources (4 parallel workers) | Low | CI runners have capacity; local dev can use 1 worker |
| Migration complexity | Low | Straightforward refactor; no logic changes |
| Regression in other tests | Medium | Full regression test in Phase 3 |

---

## Timeline Estimate

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 1: Refactor state | 2h | ✅ Core fix, enables all others |
| Phase 2: Polling patterns | 1h | ✅ Robustness improvement |
| Phase 3: Isolation verification | 1h | ✅ Confidence in design |
| Phase 4: Parallel execution | 0.5h | ⚡ 2.7x speedup |
| Phase 5: Documentation | 1h | 📚 Team standard |
| **Total** | **5.5h** | Complete, production-ready testing |

---

## Next Steps

1. **Immediate** (today): Review this analysis with team
2. **Week 1**: Implement Phase 1 (refactor state management)
3. **Week 1**: Run full test suite verification (Phase 3)
4. **Week 2**: Implement Phase 4 (parallel execution)
5. **Week 2**: Document patterns (Phase 5)

---

## Questions & Answers

**Q: Won't creating a new environment per test slow down tests?**  
A: Slightly (overhead ~1s per test setup), but Phase 4 parallel execution recovers 2.7x speedup. Net: 11s → 15s sequential → 4s parallel.

**Q: What if a test needs shared setup?**  
A: Create a readonly fixture that generates test data independently. Each test uses a COPY, not shared state.

**Q: Can we keep shared environment for only some tests?**  
A: Not recommended. Mixed patterns create confusion. Better to standardize on fresh-per-test.

**Q: How do we handle test timeouts with fresh environment?**  
A: Set per-test timeout in `test.setTimeout()`. Environment creation + mock load ~2s, leaves 28s for test logic.

---

## References

- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [expect.poll() Documentation](https://playwright.dev/docs/api/class-expectassertions#expect-poll)
- [Browser Extension Testing Best Practices](https://playwright.dev/docs/chrome-extensions)
- [Async Patterns in Playwright](https://playwright.dev/docs/api/class-testoptions#test-options-timeout)

---

**Document Created**: 2026-09-05T22:28:50.458+02:00  
**Analysis by**: Copilot Test Architecture Team  
**Status**: Ready for Implementation
