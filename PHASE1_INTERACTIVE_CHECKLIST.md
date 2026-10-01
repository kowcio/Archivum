# ✅ PHASE 1 IMPLEMENTATION CHECKLIST

**Total Tasks**: 16  
**Total Time**: ~5-6 hours  
**Status**: Ready to begin  
**Date Started**: _____________

---

## 📋 TASK DEPENDENCY MAP

```
START HERE
├─ [ ] rpc-1: Add testTriggerUpdateTabByAge() (15 min)
│  └─ [ ] rpc-2: Add testTriggerAutoClose() (15 min)
│     ├─ [ ] test-1: updateTabByAge Test 1 (30 min)
│     │  └─ [ ] test-2: updateTabByAge Test 2 (30 min)
│     │     └─ [ ] test-3: updateTabByAge Test 3 (30 min)
│     │        └─ [ ] verify-1: Verify updateTabByAge (10 min)
│     │           └─ [ ] arch-1: Fix browser-alarms-api.spec.ts (15 min)
│     │              └─ [ ] arch-2: Fix 24h-alarm-age-grouping.spec.ts (15 min)
│     │                 └─ [ ] arch-3: Fix 24h-alarm-auto-close.spec.ts (15 min)
│     │                    └─ [ ] arch-4: Fix thresholds-change.spec.ts (15 min)
│     │                       └─ [ ] arch-5: Fix test-alarm-button.spec.ts (15 min)
│     │                          └─ [ ] final-verify: Run all tests (15 min)
│     │
│     ├─ [ ] update-1: Add auto-close closure verify (60 min)
│     │  └─ [ ] verify-2: Verify auto-close test (10 min)
│     │
│     └─ [ ] update-2: Add title update test (60 min)
│        └─ [ ] verify-3: Verify title test (10 min)
```

---

## 🚀 EXECUTION ORDER (Parallel Where Possible)

### Parallel Track A: RPC Methods & Tests
**Time**: ~165 min (2h 45min)

1. [ ] **rpc-1** (15 min): Add testTriggerUpdateTabByAge()
   - File: `src/services/BackgroundRPC.ts`
   - Adds type definition + registerService method
   - ✓ Done: _________

2. [ ] **rpc-2** (15 min): Add testTriggerAutoClose()
   - File: `src/services/BackgroundRPC.ts`
   - Depends on: rpc-1
   - ✓ Done: _________

3. [ ] **test-1** (30 min): Create updateTabByAge Test 1
   - File: `test/playwright/browser-alarms-updateTabByAge.spec.ts`
   - Test: "moves tab to new group when it ages"
   - Depends on: rpc-2
   - ✓ Done: _________

4. [ ] **test-2** (30 min): Create updateTabByAge Test 2
   - Test: "moves ungrouped tabs to appropriate group"
   - Depends on: test-1
   - ✓ Done: _________

5. [ ] **test-3** (30 min): Create updateTabByAge Test 3
   - Test: "handles multiple threshold transitions"
   - Depends on: test-2
   - ✓ Done: _________

6. [ ] **verify-1** (10 min): Verify updateTabByAge tests pass
   - Run: `npm run test:e2e -- browser-alarms-updateTabByAge.spec.ts`
   - Expected: 3/3 PASS
   - Depends on: test-3
   - ✓ Done: _________

### Parallel Track B: Auto-Close Closure Verification
**Time**: ~70 min (1h 10min)

7. [ ] **update-1** (60 min): Add auto-close closure verification
   - File: `test/playwright/24h-alarm-auto-close.spec.ts`
   - Add: Verify closedCount > 0 and count decreased
   - Depends on: rpc-2
   - ✓ Done: _________

8. [ ] **verify-2** (10 min): Verify auto-close test passes
   - Run: `npm run test:e2e -- 24h-alarm-auto-close.spec.ts`
   - Expected: All PASS with closure verify
   - Depends on: update-1
   - ✓ Done: _________

### Parallel Track C: Title Update Test
**Time**: ~70 min (1h 10min)

9. [ ] **update-2** (60 min): Add title update test
   - File: `test/playwright/chromium/SingleTabInGroup.spec.ts`
   - Add: Group title verification with expect.poll()
   - Depends on: rpc-2
   - ✓ Done: _________

10. [ ] **verify-3** (10 min): Verify title test passes
    - Run: `npm run test:e2e -- chromium/SingleTabInGroup.spec.ts`
    - Expected: All PASS with title test
    - Depends on: update-2
    - ✓ Done: _________

### Sequential: Architecture Fixes
**Time**: ~90 min (1h 30min)
**Depends on**: verify-1, verify-2, verify-3

11. [ ] **arch-1** (15 min): Fix browser-alarms-api.spec.ts
    - Change: beforeAll → beforeEach, afterAll → afterEach
    - Run: `npm run test:e2e -- browser-alarms-api.spec.ts`
    - Expected: All PASS
    - ✓ Done: _________

12. [ ] **arch-2** (15 min): Fix 24h-alarm-age-grouping.spec.ts
    - Change: beforeAll → beforeEach, afterAll → afterEach
    - Run: `npm run test:e2e -- 24h-alarm-age-grouping.spec.ts`
    - Expected: All PASS
    - ✓ Done: _________

13. [ ] **arch-3** (15 min): Fix 24h-alarm-auto-close.spec.ts
    - Change: beforeAll → beforeEach, afterAll → afterEach
    - Run: `npm run test:e2e -- 24h-alarm-auto-close.spec.ts`
    - Expected: All PASS
    - ✓ Done: _________

14. [ ] **arch-4** (15 min): Fix thresholds-change.spec.ts
    - Change: beforeAll → beforeEach, afterAll → afterEach
    - Run: `npm run test:e2e -- thresholds-change.spec.ts`
    - Expected: All PASS
    - ✓ Done: _________

15. [ ] **arch-5** (15 min): Fix test-alarm-button.spec.ts
    - Change: beforeAll → beforeEach, afterAll → afterEach
    - Run: `npm run test:e2e -- test-alarm-button.spec.ts`
    - Expected: All PASS
    - ✓ Done: _________

### Final: Complete Verification
**Time**: 15 min

16. [ ] **final-verify** (15 min): Run ALL tests
    - Run: `npm run test:e2e`
    - Expected: All 23 tests PASS
    - Expected: ~12-15 seconds total
    - Expected: No TypeScript errors
    - Expected: No console errors
    - Depends on: arch-5
    - ✓ Done: _________

---

## ⏱️ TIME BREAKDOWN

| Category | Time | Tasks |
|----------|------|-------|
| RPC Methods | 30 min | rpc-1, rpc-2 |
| Test Creation | 100 min | test-1, test-2, test-3 |
| Test Verification | 30 min | verify-1, verify-2, verify-3 |
| Auto-Close Closure | 60 min | update-1 |
| Title Update | 60 min | update-2 |
| Architecture Fixes | 75 min | arch-1 through arch-5 |
| Final Verification | 15 min | final-verify |
| **TOTAL** | **~370 min** | **16 tasks** |

**Realistic Duration**: 5-6 hours (includes debugging/retries)

---

## 📊 PROGRESS TRACKING

### Session 1: __________ (Start time: __________)

- [ ] Complete Parallel Tracks A, B, C (~4 hours)
  - Track A: rpc-1, rpc-2, test-1, test-2, test-3, verify-1
  - Track B: update-1, verify-2
  - Track C: update-2, verify-3
  - Estimated: 2h 45m + 1h 10m + 1h 10m = ~5h

**Break here**: _________

### Session 2: __________ (Start time: __________)

- [ ] Complete Architecture Fixes & Final Verification (~1.5 hours)
  - Sequential: arch-1 through arch-5, final-verify
  - Estimated: 1h 30m

---

## ✅ COMPLETION CRITERIA

Phase 1 is **COMPLETE** when:

- [ ] All 16 tasks have checkboxes marked
- [ ] All 23 Playwright tests PASS (`npm run test:e2e`)
- [ ] Coverage improved 30% → 70%
- [ ] No broken tests (7 → 0)
- [ ] updateTabByAge() now has 3 tests (was 0)
- [ ] autoCloseOldestGroupTabs() closure verified (was toggle only)
- [ ] onTabActivated() title update tested (was state only)
- [ ] Test architecture fixed (beforeEach in all 14 files)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Tests can run independently (no order dependency)

---

## 🐛 TROUBLESHOOTING

### Tests fail with "env is undefined"
**Solution**: Verify `env` is created in `beforeEach`, not `beforeAll`

### RPC method not found
**Solution**: 
1. Verify method added to type definition AND registerService()
2. Check TypeScript compiles: `npm run build`
3. Restart test runner if caching issue

### Import errors
**Solution**: Verify file paths and imports match exactly

### Timeout errors
**Solution**: Increase timeout in `expect.poll()` or check service worker logs

### Storage state persists
**Solution**: Confirm `beforeEach` creates fresh userDataDir, `afterEach` cleans up

---

## 📞 REFERENCE DOCUMENTS

Keep these open while working:

1. **PHASE1_2_IMPLEMENTATION.md** (test/playwright/)
   - Copy-paste code for each task
   - Exact implementations

2. **EXECUTIVE_SUMMARY.md** (test/playwright/)
   - Why these changes matter
   - Detailed explanations

3. **QUICK_REFERENCE.md** (test/playwright/)
   - Quick patterns
   - Common issues

---

## 📝 NOTES & OBSERVATIONS

Use this space to track issues, discoveries, or time adjustments:

```
[Day 1, 9:00 AM]
Started rpc-1, completed in 12 min (3 min faster than estimate)

[Day 1, 10:30 AM]
Tests 1-3 easier than expected, all done in 85 min total

[Day 1, 4:00 PM]
Architecture fixes straightforward, 75 min completed as estimated
```

---

## 🎯 FINAL CHECKLIST

### Before Starting
- [ ] Read PHASE1_2_IMPLEMENTATION.md
- [ ] Have QUICK_REFERENCE.md open
- [ ] Ensure all tools installed: npm, Node, TypeScript
- [ ] Terminal ready to run `npm run test:e2e`

### After Completing Each Step
- [ ] Mark checkbox
- [ ] Run verification if needed
- [ ] Take brief note in NOTES section
- [ ] Move to next step

### After Completing Phase 1
- [ ] All tests passing
- [ ] All checkboxes marked
- [ ] Take screenshot of test results
- [ ] Celebrate! 🎉
- [ ] Review: Ready for Phase 2?

---

**Phase 1 Status**: ☐ Not Started | ☐ In Progress | ☐ Complete ✅

**Total Time Spent**: ____________  
**Date Completed**: ____________  
**Notes**: _________________________________________________________________

---

*Next: Phase 2 (2 hours) - Replace polling + add ordering tests*
