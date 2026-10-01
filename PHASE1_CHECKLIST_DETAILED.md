# 📋 PHASE 1 IMPLEMENTATION CHECKLIST

**Total Effort**: 5 hours (300 minutes)  
**Status**: Ready to start  
**Created**: 2026-09-05 22:56

---

## STEP 1: Add RPC Methods (30 min)

### 1.1: testTriggerUpdateTabByAge() (15 min)
- [ ] Open: src/services/BackgroundRPC.ts
- [ ] Add to type definition:
      `	ypescript
      testTriggerUpdateTabByAge: () => Promise<{
        movedCount: number
        groupsAfter: Array<{ id: number; title: string; tabCount: number }>
      }>
      `
- [ ] Add to registerService() in background.ts
- [ ] Verify TypeScript compiles
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 1.2: testTriggerAutoClose() (15 min)
- [ ] Add to type definition:
      `	ypescript
      testTriggerAutoClose: () => Promise<{
        closedCount: number
        hellGroupCountAfter: number
      }>
      `
- [ ] Add to registerService() in background.ts
- [ ] Verify TypeScript compiles
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

**Subtotal**: 30 min  
**Cumulative**: 30 min

---

## STEP 2: Create updateTabByAge() Test Suite (1.5 hours = 90 min)

### 2.1: Test 1 - "moves tab to new group when it ages" (30 min)
- [ ] Create: 	est/playwright/browser-alarms-updateTabByAge.spec.ts
- [ ] Add test setup (beforeEach/afterEach)
- [ ] Test logic:
      1. Load mock tabs
      2. Group tabs (creates Hell!, Quarter+, Month+, 2 Weeks+, Week+)
      3. Get initial state (Week+ count)
      4. Age by 7 days
      5. Trigger updateTabByAge()
      6. Verify Week+ count decreased by 1
      7. Verify 2 Weeks+ count increased by 1
- [ ] **Time**: 30 min
- [ ] **Done**: ☐

### 2.2: Test 2 - "moves ungrouped tabs to appropriate group" (30 min)
- [ ] Add test to same file
- [ ] Test logic:
      1. Load mock tabs
      2. Get fresh ungrouped tabs
      3. Age by 7 days
      4. Trigger updateTabByAge()
      5. Verify Week+ group exists
      6. Verify Week+ tabCount > 0
- [ ] **Time**: 30 min
- [ ] **Done**: ☐

### 2.3: Test 3 - "handles multiple threshold transitions" (30 min)
- [ ] Add test to same file
- [ ] Test logic:
      1. Load & group mocks
      2. Record initial group counts
      3. Age by 30 days
      4. Trigger updateTabByAge() 30 times
      5. Verify Hell! count >= initial
      6. Verify Quarter+ count >= initial
      7. Verify Week+ count <= initial
- [ ] **Time**: 30 min
- [ ] **Done**: ☐

### 2.4: Verify Tests Pass (10 min)
- [ ] Run: 
pm run test:e2e -- browser-alarms-updateTabByAge.spec.ts
- [ ] Expected: 3/3 tests PASS
- [ ] Expected: ~3-4 seconds
- [ ] **Time**: 10 min
- [ ] **Done**: ☐

**Subtotal**: 100 min  
**Cumulative**: 130 min

---

## STEP 3: Update autoCloseOldestGroupTabs Test (1 hour = 60 min)

### 3.1: Add Closure Verification (50 min)
- [ ] Open: 	est/playwright/24h-alarm-auto-close.spec.ts
- [ ] Find existing test: "should keep tabs when auto-close disabled..."
- [ ] Before line ~22, add:
      `	ypescript
      const tabsBefore = await env.optionsPage.getGroupAndTabData()
      const hellGroupBefore = tabsBefore.groupsOrderedByIndex[0]
      const hellCountBefore = hellGroupBefore.tabCount
      `
- [ ] After trigger, add:
      `	ypescript
      const closeResult = await env.optionsPage.getBackgroundRPC().testTriggerAutoClose()
      expect(closeResult.closedCount).toBeGreaterThan(0)
      expect(closeResult.hellGroupCountAfter).toBeLessThan(hellCountBefore)
      `
- [ ] **Time**: 50 min
- [ ] **Done**: ☐

### 3.2: Verify Test Passes (10 min)
- [ ] Run: 
pm run test:e2e -- 24h-alarm-auto-close.spec.ts
- [ ] Expected: All tests PASS
- [ ] **Time**: 10 min
- [ ] **Done**: ☐

**Subtotal**: 60 min  
**Cumulative**: 190 min

---

## STEP 4: Add Title Update Test (1 hour = 60 min)

### 4.1: Add Group Title Test (50 min)
- [ ] Open: 	est/playwright/chromium/SingleTabInGroup.spec.ts
- [ ] Add new test:
      `	ypescript
      test('onTabActivated() updates group title with new tab count', async () => {
        await env.optionsPage.clickLoadMockTabs()
        await env.optionsPage.clickGroupTabs()
        
        let groups = await env.optionsPage.getAllGroups()
        const groupToTest = groups.find(g => g.tabCount > 1)
        const titleBefore = groupToTest.title
        const countBefore = groupToTest.tabCount
        
        const allTabs = await env.optionsPage.queryAllTabs()
        const tabToActivate = allTabs.find(t => t.groupId === groupToTest.id)
        
        await env.optionsPage.activateTab(tabToActivate.id)
        
        await expect.poll(
          async () => {
            const groupsAfter = await env.optionsPage.getAllGroups()
            const groupAfter = groupsAfter.find(g => g.id === groupToTest.id)
            return groupAfter?.title ?? null
          },
          { timeout: 10000 }
        ).toMatch(new RegExp(\\\\s*\\(\\\)\))
        
        const tabAfter = await env.optionsPage.queryTab(tabToActivate.id)
        expect(tabAfter.groupId).toBe(-1)
      })
      `
- [ ] **Time**: 50 min
- [ ] **Done**: ☐

### 4.2: Verify Test Passes (10 min)
- [ ] Run: 
pm run test:e2e -- chromium/SingleTabInGroup.spec.ts
- [ ] Expected: All tests PASS
- [ ] **Time**: 10 min
- [ ] **Done**: ☐

**Subtotal**: 60 min  
**Cumulative**: 250 min

---

## STEP 5: Fix Test Architecture (1.5 hours = 90 min)

### 5.1: browser-alarms-api.spec.ts (15 min)
- [ ] Open: 	est/playwright/browser-alarms-api.spec.ts
- [ ] Find: eforeAll(async () => {
- [ ] Change to: eforeEach(async () => {
- [ ] Find: fterAll(async () => {
- [ ] Change to: fterEach(async () => {
- [ ] Verify no other references to shared env
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 5.2: 24h-alarm-age-grouping.spec.ts (15 min)
- [ ] Open: 	est/playwright/24h-alarm-age-grouping.spec.ts
- [ ] Change eforeAll → eforeEach
- [ ] Change fterAll → fterEach
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 5.3: 24h-alarm-auto-close.spec.ts (15 min)
- [ ] Open: 	est/playwright/24h-alarm-auto-close.spec.ts
- [ ] Change eforeAll → eforeEach
- [ ] Change fterAll → fterEach
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 5.4: thresholds-change.spec.ts (15 min)
- [ ] Open: 	est/playwright/thresholds-change.spec.ts
- [ ] Change eforeAll → eforeEach
- [ ] Change fterAll → fterEach
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 5.5: test-alarm-button.spec.ts (15 min)
- [ ] Open: 	est/playwright/test-alarm-button.spec.ts
- [ ] Change eforeAll → eforeEach
- [ ] Change fterAll → fterEach
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

### 5.6: Verify Tests Pass (15 min)
- [ ] Run each file individually:
      - [ ] 
pm run test:e2e -- browser-alarms-api.spec.ts (PASS)
      - [ ] 
pm run test:e2e -- 24h-alarm-age-grouping.spec.ts (PASS)
      - [ ] 
pm run test:e2e -- 24h-alarm-auto-close.spec.ts (PASS)
      - [ ] 
pm run test:e2e -- thresholds-change.spec.ts (PASS)
      - [ ] 
pm run test:e2e -- test-alarm-button.spec.ts (PASS)
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

**Subtotal**: 90 min  
**Cumulative**: 340 min (OVER BY 40 min — adjust as needed)

---

## FINAL VERIFICATION (15 min)

### Run All Tests
- [ ] Run: 
pm run test:e2e
- [ ] Expected: All 23 tests PASS
- [ ] Expected: Time: ~12-15 seconds
- [ ] Expected: No TypeScript errors
- [ ] Expected: No console errors
- [ ] **Time**: 15 min
- [ ] **Done**: ☐

---

## ✅ COMPLETION CHECKLIST

After all steps complete:

- [ ] All 23 tests passing
- [ ] No TypeScript errors
- [ ] No console errors  
- [ ] updateTabByAge() tested (3 tests)
- [ ] autoCloseOldestGroupTabs() closure verified
- [ ] onTabActivated() title update tested
- [ ] 5 test files fixed (beforeEach/afterEach)
- [ ] RPC methods added and working
- [ ] Tests run independently (no order dependency)

---

## ⏱️ TIME TRACKING

| Step | Est (min) | Actual | Status |
|------|-----------|--------|--------|
| 1. RPC Methods | 30 | — | ☐ |
| 2. updateTabByAge Test | 100 | — | ☐ |
| 3. Auto-close Verification | 60 | — | ☐ |
| 4. Title Update Test | 60 | — | ☐ |
| 5. Architecture Fix | 90 | — | ☐ |
| Final Verification | 15 | — | ☐ |
| **TOTAL** | **355 min** | — | ☐ |

---

## 📝 NOTES

- Take breaks between sections
- Run verification after each major section
- Keep PHASE1_2_IMPLEMENTATION.md open for code examples
- If test fails, check troubleshooting guide in PHASE1_CHECKLIST.md
- Report any blockers immediately

---

## 🚀 SUCCESS CRITERIA

✅ Phase 1 complete when:
1. All 23 Playwright tests PASS
2. Coverage improved 30% → 70%
3. No broken tests (7 → 0)
4. updateTabByAge tested (0 → 3 tests)
5. autoCloseOldestGroupTabs verified
6. onTabActivated title tested
7. Test architecture fixed (all 14 files independent)

---

**Start Time**: ___________  
**End Time**: ___________  
**Total Duration**: ___________

**Phase 1 Status**: ☐ NOT STARTED  |  ☐ IN PROGRESS  |  ☐ COMPLETE ✅

