# Playwright Test Architecture — Quick Reference

**Status**: ❌ BROKEN (all 14 files)  
**Impact**: 7 tests critically broken, 9 at-risk, 7 working

---

## 7 Critical Findings

### 1️⃣ Single Shared Browser Instance ❌

**Current**: 
```typescript
test.beforeAll(async () => {
  env = await TestEnvironment.create()  // ONE instance
})
// ALL tests reuse this env
```

**Problem**: Storage, mocks, groups persist

**Fix**: Move to `beforeEach`
```typescript
test.beforeEach(async () => {
  if (env) await env.cleanup()
  env = await TestEnvironment.create()  // Fresh per test
})

test.afterEach(async () => {
  if (env) await env.cleanup()  // Delete profile
})
```

---

### 2️⃣ beforeEach = Cleanup, NOT Creation ❌

**Current**:
```typescript
test.beforeEach(async () => {
  // Just cleanup, no reset to defaults
  await env.optionsPage.ungroupAllTabs()
})
```

**Problem**: Storage still has old state

**Fix**:
```typescript
test.beforeEach(async () => {
  if (env) await env.cleanup()
  
  // CREATE fresh environment
  env = await TestEnvironment.create()
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.clickLoadMockTabs()
  console.log('[beforeEach] ✅ Fresh env')
})
```

---

### 3️⃣ Storage Persists Across Tests ❌

**Why**: `launchPersistentContext()` saves to `userDataDir`

**Current**:
```
Test 1: autoClose = true → stored
beforeEach: no storage clear
Test 2: reads autoClose = true ❌ (expected false)
```

**Fix**: Fresh environment = fresh profile
```typescript
// Each env = new userDataDir = empty storage
if (env) await env.cleanup()  // Deletes userDataDir
env = await TestEnvironment.create()  // New profile
```

---

### 4️⃣ Time Offsets Accumulate ❌

**Current**:
```typescript
Test 1: timeProgress(7)  // Mock ages += 7 days
Test 2: timeProgress(1)  // Mock ages += 1 more (cumulative!)
// Expected: 1 day, Actual: 8 days ❌
```

**Fix**: Fresh mocks per test
```typescript
test.beforeEach(async () => {
  env = await TestEnvironment.create()  // Fresh mocks
  await env.optionsPage.clickLoadMockTabs()  // Reload
})

// Each test starts with fresh mocks at age 0
Test 1: timeProgress(7)  // 7 days from 0
Test 2: timeProgress(1)  // 1 day from 0 (not 8)
```

---

### 5️⃣ expect.poll() Underutilized ⚠️

**Bad** (10 files):
```typescript
// Manual polling, no retry
let result
for (let i = 0; i < 20; i++) {
  result = await getValue()
  if (result === expected) break
  await new Promise(r => setTimeout(r, 500))
}
expect(result).toBe(expected)  // Could fail
```

**Good** (use in all files):
```typescript
// Auto retry + backoff
await expect.poll(
  async () => await getValue(),
  { timeout: 10000 }
).toBe(expected)
```

**Everywhere async results are checked**:
- Alarm handler completion
- Tab grouping after changes
- Storage updates
- Button state changes

---

### 6️⃣ Async Handlers Not Awaited ⚠️

**Current**:
```typescript
// Handler runs async in background
browser.alarms.onAlarm.addListener((alarm) => {
  BackgroundTabService.loadAndMarkTabs().catch()  // Fire-and-forget
})

// Test checks immediately ❌
const result = await testTriggerAlarm24h()
const groups = await getAllGroups()
expect(groups).toBe(5)  // Could race
```

**Fix**: Use expect.poll()
```typescript
await testTriggerAlarm24h()

// Wait for handler to complete
await expect.poll(
  async () => {
    return await env.optionsPage.getAllGroups()
  },
  { timeout: 10000 }
).toHaveLength(5)
```

---

### 7️⃣ Test Isolation Broken ❌

**Current**: Tests are order-dependent
```
Test A: Sets threshold = 3
Test B: Expects 5 (gets 3 instead) ❌
Cannot reorder, cannot run in parallel
```

**Fix**: Fresh environment per test eliminates dependency

---

## File Risk Summary

| File | Tests | Status | Risk |
|------|-------|--------|------|
| `browser-alarms-api.spec.ts` | 7 | ❌ | **CRITICAL** |
| `24h-alarm-age-grouping.spec.ts` | 1 | ❌ | **CRITICAL** |
| `24h-alarm-auto-close.spec.ts` | 1 | ❌ | **CRITICAL** |
| `thresholds-change.spec.ts` | 1 | ❌ | **CRITICAL** |
| `test-alarm-button.spec.ts` | 1 | ❌ | **CRITICAL** |
| `independence-grouping.spec.ts` | 1 | ⚠️ | MEDIUM |
| `chromium/ThresholdDayLevelChange.spec.ts` | 1 | ⚠️ | MEDIUM |
| `chromium/OptionsTresholdsTest.spec.ts` | 1 | ⚠️ | MEDIUM |
| `tooltip.spec.ts` | 2 | ⚠️ | MEDIUM |
| `chromium/OptionsTest.spec.ts` | 3 | ⚠️ | MEDIUM |
| `chromium/SingleTabInGroup.spec.ts` | 1 | ⚠️ | MEDIUM |
| `StoreTest.spec.ts` | 1 | ✅ | LOW |
| `thresholds-persist-reload.spec.ts` | 1 | ✅ | LOW |
| `chromium/PopupTest.spec.ts` | 2 | ✅ | LOW |

---

## Implementation Order

### Phase 1: CRITICAL FIX (2 hours)
**File**: `browser-alarms-api.spec.ts` (7 tests)

```typescript
// BEFORE
test.beforeAll(async () => {
  env = await TestEnvironment.create()
  await env.optionsPage.clickLoadMockTabs()
})

test.beforeEach(async () => {
  await env.optionsPage.ungroupAllTabs()
})

// AFTER
test.beforeEach(async () => {
  if (env) await env.cleanup()
  env = await TestEnvironment.create()
  await env.optionsPage.gotoOptionsPage(env.extensionId)
  await env.optionsPage.clickLoadMockTabs()
})

test.afterEach(async () => {
  if (env) await env.cleanup()
})

test.afterAll(async () => {
  if (env) await env.cleanup()
})
```

---

### Phase 2: CRITICAL SUITE FIX (1.5 hours)
**Files**: 
- `24h-alarm-age-grouping.spec.ts`
- `24h-alarm-auto-close.spec.ts`
- `test-alarm-button.spec.ts`
- `thresholds-change.spec.ts`
- `chromium/ThresholdDayLevelChange.spec.ts`

Same pattern as Phase 1

---

### Phase 3: POLLING FIXES (2 hours)

**All files** with manual polling loops:

Replace:
```typescript
for (let i = 0; i < 20; i++) {
  const val = await getValue()
  if (val === expected) break
  await new Promise(r => setTimeout(r, 500))
}
expect(val).toBe(expected)
```

With:
```typescript
await expect.poll(async () => await getValue(), {
  timeout: 10000
}).toBe(expected)
```

---

### Phase 4: AT-RISK HARDENING (2 hours)

Apply Phase 1 pattern to remaining 9 files:
- `independence-grouping.spec.ts`
- `chromium/OptionsTest.spec.ts`
- `chromium/OptionsTresholdsTest.spec.ts`
- `chromium/SingleTabInGroup.spec.ts`
- `chromium/ThresholdDayLevelChange.spec.ts`
- `tooltip.spec.ts`
- Others

---

## Testing Your Changes

### After Phase 1:
```bash
npm run test:chromium -- browser-alarms-api.spec.ts
# Should pass ✅
```

### After All Phases:
```bash
# Sequential (current)
npm run test:chromium
# Should pass ✅

# Reordered (verify order-independence)
npm run test:chromium -- --grep "@REVERSE"
# Should pass ✅

# Parallel (verify parallel-safety)
npm run test:chromium -- --workers=4
# Should pass ✅
```

---

## Verification Checklist

After implementing fixes:

- [ ] All 7 alarm tests pass independently
- [ ] All 23 tests pass in sequential order
- [ ] All 23 tests pass when reordered
- [ ] All 23 tests pass with `--workers=4` (parallel)
- [ ] No test depends on execution order
- [ ] All async operations use `expect.poll()`
- [ ] Each test has fresh environment
- [ ] `beforeEach` creates, `afterEach` cleans up
- [ ] No manual setTimeout loops in tests
- [ ] Storage is clear per test (fresh profile)

---

## Key Takeaways

✅ **Your insights were correct**:
1. beforeEach should CREATE, not cleanup
2. Each test needs fresh environment
3. expect.poll() handles async properly
4. No shared mutable state
5. No cumulative time offsets

✅ **Solution is straightforward**:
- Move `TestEnvironment.create()` to `beforeEach`
- Add cleanup in `afterEach`
- Replace manual polling with `expect.poll()`
- Tests become independent, parallel-ready

✅ **Timeline**:
- Phase 1: 2h (7 critical tests fixed)
- Phase 2: 1.5h (5 more critical tests)
- Phase 3: 2h (polling fixes, all files)
- Phase 4: 2h (at-risk hardening)
- **Total: 5.5 hours → 23 robust tests**

---

## Documents for Deep Dive

1. **ARCHITECTURE_ANALYSIS.md** — 7 findings with implementation plan
2. **ALL_TESTS_ANALYSIS.md** — File-by-file breakdown, risk tiers
3. **QUICK_REFERENCE.md** (this file) — Quick lookup guide

---

**Last Updated**: 2026-09-05T22:31:13.413+02:00
