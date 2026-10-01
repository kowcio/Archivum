# 🚀 PHASE 1 QUICK START GUIDE

**Status**: Ready to implement  
**Duration**: 5-6 hours  
**Tasks**: 16  
**Tests**: 23 (will all pass after Phase 1)

---

## ⚡ QUICK START (3 minutes)

### What You Need to Do
Fix Playwright tests to improve coverage from 30% → 70%

### How Long
~5-6 hours total work

### What You'll Get
✅ All 23 tests passing  
✅ No broken tests  
✅ Test isolation fixed  
✅ New test coverage for critical gaps  

---

## 📋 TWO WAYS TO USE CHECKLISTS

### Option 1: Step-by-Step (RECOMMENDED FOR BEGINNERS)
**File**: `PHASE1_CHECKLIST_DETAILED.md`
- All steps broken down
- Time per task
- Detailed instructions
- Verification procedures
- Best for: Following exact steps without thinking

### Option 2: Interactive Tracking (RECOMMENDED FOR EXPERIENCED)
**File**: `PHASE1_INTERACTIVE_CHECKLIST.md`
- Visual dependency map
- Parallel work tracks
- Session planning (split into 2)
- Progress dashboard
- Troubleshooting guide
- Best for: Understanding big picture + tracking progress

---

## 🎯 THE WORK IN 5 STEPS

### Step 1: Add 2 RPC Methods (30 min)
- File: `src/services/BackgroundRPC.ts`
- Add: `testTriggerUpdateTabByAge()` 
- Add: `testTriggerAutoClose()`
- Verify: TypeScript compiles

### Step 2: Create updateTabByAge Test (100 min)
- File: `test/playwright/browser-alarms-updateTabByAge.spec.ts`
- Add: 3 tests (new file)
- Run: Verify all pass

### Step 3: Update Auto-Close Test (60 min)
- File: `24h-alarm-auto-close.spec.ts`
- Add: Closure count verification
- Run: Verify passes

### Step 4: Add Title Update Test (60 min)
- File: `chromium/SingleTabInGroup.spec.ts`
- Add: Group title verification
- Run: Verify passes

### Step 5: Fix Test Architecture (90 min)
- Fix 5 files:
  - `browser-alarms-api.spec.ts`
  - `24h-alarm-age-grouping.spec.ts`
  - `24h-alarm-auto-close.spec.ts`
  - `thresholds-change.spec.ts`
  - `test-alarm-button.spec.ts`
- Change: `beforeAll` → `beforeEach`
- Change: `afterAll` → `afterEach`
- Run: Verify all 23 tests pass

### Final: Verify All Tests (15 min)
- Run: `npm run test:e2e`
- Expected: All 23 ✅ PASS

---

## 🕐 TIME BREAKDOWN

| What | Time | Where |
|------|------|-------|
| RPC methods | 30 min | 1 file |
| Test creation | 100 min | 1 new file |
| Auto-close verify | 60 min | 1 file |
| Title test | 60 min | 1 file |
| Architecture fixes | 90 min | 5 files |
| Final verify | 15 min | npm command |
| **TOTAL** | **~355 min** | — |

---

## 🎓 DETAILED GUIDES

### For Code Examples
→ Open: `test/playwright/PHASE1_2_IMPLEMENTATION.md`  
All code you need is copy-pasted ready.

### For Understanding Why
→ Open: `test/playwright/EXECUTIVE_SUMMARY.md`  
Explains the 5 critical issues and solutions.

### For Quick Patterns
→ Open: `test/playwright/QUICK_REFERENCE.md`  
Quick lookup for common patterns.

---

## ✅ SUCCESS CHECKLIST

After Phase 1 is DONE:

- [ ] All 23 tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] updateTabByAge() tested (3 new tests)
- [ ] autoCloseOldestGroupTabs() verified
- [ ] onTabActivated() title tested
- [ ] 5 test files fixed (beforeEach/afterEach)
- [ ] Tests run independently (no order dependency)
- [ ] Coverage improved 30% → 70%

---

## 📍 FILE LOCATIONS

**Checklists**:
```
C:\Users\kowcio\IdeaProjects\czynsz_ff\PHASE1_CHECKLIST_DETAILED.md
C:\Users\kowcio\IdeaProjects\czynsz_ff\PHASE1_INTERACTIVE_CHECKLIST.md
```

**Code Examples**:
```
test/playwright/PHASE1_2_IMPLEMENTATION.md
```

**All Documentation**:
```
test/playwright/INDEX.md  (master index)
```

---

## 🚀 START NOW

### The Fastest Way to Begin

1. **Choose your checklist**:
   - Beginner: `PHASE1_CHECKLIST_DETAILED.md` (step-by-step)
   - Experienced: `PHASE1_INTERACTIVE_CHECKLIST.md` (tracking)

2. **Keep these open**:
   - Your chosen checklist (on left screen)
   - `PHASE1_2_IMPLEMENTATION.md` (for code, right screen)
   - Terminal (bottom)

3. **Start with Step 1**:
   - Open: `src/services/BackgroundRPC.ts`
   - Follow first task in checklist
   - Run verification
   - Move to next task

4. **Take a break after Session 1** (~4 hours)
   - You'll have completed 3 test files
   - All 3 new/updated tests passing
   - Good stopping point

5. **Complete Session 2** (~1.5 hours)
   - Fix 5 test architecture files
   - Run final verification
   - All 23 tests passing ✅

---

## 🆘 STUCK?

### Common Issues

**"env is undefined"**
→ Make sure you're using `beforeEach` not `beforeAll`

**"RPC method not found"**
→ Verify method in BOTH type definition AND registerService()

**"Test timeout"**
→ Increase timeout in `expect.poll()` or check service worker

**"TypeScript errors"**
→ Run `npm run build` to see full error messages

→ See TROUBLESHOOTING section in your chosen checklist

---

## 📊 WHAT'S HAPPENING

### Before Phase 1
- 30% test coverage
- 2 methods completely untested
- Test isolation broken
- 7 tests broken, 9 at-risk
- All tests share single browser environment
- Storage persists between tests

### After Phase 1
- 70% test coverage
- All critical methods tested
- Test isolation fixed
- 0 broken tests
- Each test gets fresh environment
- Storage cleared between tests

---

## 🎯 NEXT PHASE (After Phase 1)

Once Phase 1 is complete:
- Optional Phase 2 (2 hours) → 70% → 90% coverage
- Optional Phase 3-4 (3.5 hours) → 90% → 95% coverage

For now: **Focus on Phase 1 only**

---

## 🏁 FINAL COMMAND

When everything is done:
```bash
npm run test:e2e
```

Expected output:
```
23 test files
23 passed
0 failed
~12-15 seconds total
```

If you see that → **Phase 1 is COMPLETE** ✅

---

**👉 NOW: Open your chosen checklist and start!**

- Beginners: `PHASE1_CHECKLIST_DETAILED.md`
- Experienced: `PHASE1_INTERACTIVE_CHECKLIST.md`

**Good luck! 🚀**
