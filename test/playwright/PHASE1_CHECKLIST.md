# Phase 1 Implementation Checklist

**Estimated Time**: 5 hours  
**Status**: Ready to start  
**Priority**: CRITICAL (fixes 11 broken + 12 at-risk tests)

---

## Step 1: Add RPC Methods (15 min)

**File**: `src/services/BackgroundRPC.ts`

- [ ] Add `testTriggerUpdateTabByAge()` method
- [ ] Add `testTriggerAutoClose()` method
- [ ] Verify TypeScript types match
- [ ] Test: Can access from RPC proxy

**Reference**: See PHASE1_2_IMPLEMENTATION.md section "1.1: Add updateTabByAge() RPC Method"

---

## Step 2: Create updateTabByAge() Test (1.5 hours)

**File**: `test/playwright/browser-alarms-updateTabByAge.spec.ts` (NEW)

- [ ] Create new test file
- [ ] Test 1: "moves tab to new group when it ages"
  - [ ] Load mocks
  - [ ] Group tabs
  - [ ] Age by 7 days
  - [ ] Trigger updateTabByAge
  - [ ] Verify counts changed
- [ ] Test 2: "moves ungrouped tabs to appropriate group"
  - [ ] Load mocks
  - [ ] Get fresh ungrouped tabs
  - [ ] Age by 7 days
  - [ ] Trigger updateTabByAge
  - [ ] Verify moved to Week+ group
- [ ] Test 3: "handles multiple threshold transitions"
  - [ ] Load & group mocks
  - [ ] Age by 30 days
  - [ ] Trigger updateTabByAge multiple times
  - [ ] Verify distribution changed correctly
- [ ] Run: `npm run test:e2e -- browser-alarms-updateTabByAge.spec.ts`

**Reference**: See PHASE1_2_IMPLEMENTATION.md section "1.3: Create updateTabByAge() Test File"

---

## Step 3: Fix autoCloseOldestGroupTabs() Test (1 hour)

**File**: `test/playwright/24h-alarm-auto-close.spec.ts`

- [ ] Get initial `Hell!` group tab count (line ~30)
- [ ] Add: Trigger `testTriggerAutoClose()` RPC
- [ ] Add: Verify `closeResult.closedCount > 0`
- [ ] Add: Verify `Hell!` group count decreased
- [ ] Add: Verify count matches: `before - after = closedCount`
- [ ] Run: `npm run test:e2e -- 24h-alarm-auto-close.spec.ts`

**Reference**: See PHASE1_2_IMPLEMENTATION.md section "1.4: Update 24h-alarm-auto-close Test"

---

## Step 4: Add Title Update Test (1 hour)

**File**: `test/playwright/chromium/SingleTabInGroup.spec.ts`

- [ ] Find a group with multiple tabs
- [ ] Get group title before (e.g., "Week+ (3)")
- [ ] Activate a tab from that group
- [ ] Use `expect.poll()` to wait for title update
- [ ] Verify new title is "Week+ (2)"
- [ ] Verify tab is ungrouped (groupId = -1)
- [ ] Run: `npm run test:e2e -- chromium/SingleTabInGroup.spec.ts`

**Reference**: See PHASE1_2_IMPLEMENTATION.md section "1.5: Add Group Title Update Test"

---

## Step 5: Fix Test Architecture (1.5 hours)

Fix these 5 test files to move `TestEnvironment.create()` to `beforeEach`:

### 5.1: browser-alarms-api.spec.ts
- [ ] Change `beforeAll()` → `beforeEach()`
- [ ] Change `afterAll()` → `afterEach()`
- [ ] Verify `env` is fresh per test
- [ ] Run: `npm run test:e2e -- browser-alarms-api.spec.ts`

### 5.2: 24h-alarm-age-grouping.spec.ts
- [ ] Change `beforeAll()` → `beforeEach()`
- [ ] Change `afterAll()` → `afterEach()`
- [ ] Verify `env` is fresh per test
- [ ] Run: `npm run test:e2e -- 24h-alarm-age-grouping.spec.ts`

### 5.3: 24h-alarm-auto-close.spec.ts
- [ ] Change `beforeAll()` → `beforeEach()`
- [ ] Change `afterAll()` → `afterEach()`
- [ ] Verify `env` is fresh per test
- [ ] Run: `npm run test:e2e -- 24h-alarm-auto-close.spec.ts`

### 5.4: thresholds-change.spec.ts
- [ ] Change `beforeAll()` → `beforeEach()`
- [ ] Change `afterAll()` → `afterEach()`
- [ ] Verify `env` is fresh per test
- [ ] Run: `npm run test:e2e -- thresholds-change.spec.ts`

### 5.5: test-alarm-button.spec.ts
- [ ] Change `beforeAll()` → `beforeEach()`
- [ ] Change `afterAll()` → `afterEach()`
- [ ] Verify `env` is fresh per test
- [ ] Run: `npm run test:e2e -- test-alarm-button.spec.ts`

**Reference**: See PHASE1_2_IMPLEMENTATION.md section "1.6: Fix Test Architecture"

---

## Verification: Run All Tests

After completing all steps above:

```bash
# Run all Playwright E2E tests
npm run test:e2e

# Expected result: All 23 tests PASS ✅
# Expected time: ~15-20 seconds
```

---

## Checklist Summary

### RPC Methods
- [ ] testTriggerUpdateTabByAge() added
- [ ] testTriggerAutoClose() added
- [ ] TypeScript compiles ✅

### New Test Files
- [ ] browser-alarms-updateTabByAge.spec.ts created (3 tests)
- [ ] All 3 tests pass ✅

### Updated Test Files
- [ ] 24h-alarm-auto-close.spec.ts - closure verify added
- [ ] chromium/SingleTabInGroup.spec.ts - title test added

### Fixed Test Files
- [ ] browser-alarms-api.spec.ts - beforeEach applied
- [ ] 24h-alarm-age-grouping.spec.ts - beforeEach applied
- [ ] 24h-alarm-auto-close.spec.ts - beforeEach applied
- [ ] thresholds-change.spec.ts - beforeEach applied
- [ ] test-alarm-button.spec.ts - beforeEach applied

### Final Verification
- [ ] All 23 tests pass locally ✅
- [ ] No TypeScript errors ✅
- [ ] No console errors ✅
- [ ] Tests can run independently (no order dependency) ✅

---

## Expected Results After Phase 1

| Metric | Before | After |
|--------|--------|-------|
| **Test Coverage** | 30% | 70% |
| **Broken Tests** | 7 | 0 |
| **At-Risk Tests** | 9 | 0 |
| **Untested Methods** | 2 | 0 |
| **Test Isolation** | Broken | Fixed |
| **Test Time** | 10s | 12-15s |

---

## Troubleshooting

**Tests fail with "env is undefined"**
- Make sure `env` is created in `beforeEach`, not `beforeAll`
- Check that `afterEach` calls `await env.close()`

**RPC method not found**
- Verify method added to both type definition AND registerService in background.ts
- Restart test runner if caching issue

**Storage state persists between tests**
- Confirm `beforeEach` is being called (add console.log)
- Fresh `userDataDir` should be created per test
- Check that old `userDataDir` is properly cleaned up in `afterEach`

**Timeout errors**
- May indicate async handler still running
- Try increasing timeout in expect.poll()
- Check browser console for errors (service worker logs)

---

## Reference Documents

- **PHASE1_2_IMPLEMENTATION.md** — Copy-paste code examples
- **EXECUTIVE_SUMMARY.md** — Why these changes matter
- **QUICK_REFERENCE.md** — Quick lookup patterns

---

## Next Steps After Phase 1

Once all 23 tests pass:

1. ✅ Verify Phase 1 complete
2. 📖 Review PHASE1_2_IMPLEMENTATION.md Phase 2 section
3. 🚀 Start Phase 2 (2 hours):
   - Replace manual polling with expect.poll()
   - Add tab/group ordering tests
   - Add retry logic tests
4. 🎯 Expected result: 90% coverage

---

**Status**: Ready to implement  
**Estimated Time**: 5 hours  
**Expected Outcome**: 11 broken tests fixed + coverage 30%→70%

Start with Step 1! 🚀
