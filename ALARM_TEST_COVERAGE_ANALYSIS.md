# Browser Alarms Test Coverage Analysis

## Target Code (background.ts lines 33-34)
```typescript
browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, PERIOD_24H)
browser.alarms.create(APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS, PERIOD_24H)
```

## Analysis Results

### ✅ ALARM_UPDATE_TABS (Tab Age Grouping)

**Coverage: COMPLETE ✓**

**Where it's tested:**
- File: `test/playwright/24h-alarm-age-grouping.spec.ts` (lines 72, 84-97)
- RPC Method: `env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()`
- Implementation: `BackgroundTabService.testTriggerAlarm24h()` (Step 1: calls `groupTabsByAge()`)

**What's verified:**
```typescript
// Line 72 - Trigger the alarm
const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()

// Lines 84-97 - Verify tab redistribution across groups
expect(tabsAfter[0].tabCount).toBe(tabsBefore[0].tabCount + 2)  // Hell! gains tabs
expect(tabsAfter[1].tabCount).toBe(tabsBefore[1].tabCount - 2)  // Quarter+ loses tabs
expect(tabsAfter[2].tabCount).toBe(tabsBefore[2].tabCount + 1)  // Month+ gains tabs
```

**Assertion Method: EXACT + RELATIVE (Correct ✓)**
- Uses relative differences (`+2`, `-2`, `+1`) which is ideal for dynamic test data
- Follows the rule: "NEVER use toBeGreaterThan() — use EXACT values"

---

### ⚠️ ALARM_AUTO_CLOSE_TABS (Auto-Close Old Tabs)

**Coverage: PARTIAL ⚠️**

**Where it's tested:**
- File: `test/playwright/24h-alarm-auto-close.spec.ts` (lines 48, 52-56)
- RPC Method: `env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()` (same as above)
- Implementation: `BackgroundTabService.testTriggerAlarm24h()` (Step 2: calls `autoCloseOldestGroupTabs()`)

**What's verified:**
```typescript
// Line 48 - Enable auto-close toggle
await env.optionsPage.clickAutoCloseToggle();

// Line 52 - Trigger alarm with auto-close ENABLED
await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()

// Lines 54-56 - Verify tabs were closed
const hellGroupAfter = await env.optionsPage.getGroupByTitle("Hell!");
expect(hellGroupAfter?.tabCount).toBe(expectedTabsAfter);  // ✓ One tab should be closed
```

**ISSUE: Alarm Trigger INCOMPLETE ⚠️**

The `testTriggerAlarm24h()` method:
1. ✅ Always calls `groupTabsByAge()` (ALARM_UPDATE_TABS handler)
2. ✅ Checks if auto-close is enabled
3. ⚠️ **Conditional** — only calls `autoCloseOldestGroupTabs()` if enabled

**BUT:** The actual background.ts handler doesn't match:
```typescript
// background.ts lines 36-50
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === APP_DEFAULTS.ALARM_UPDATE_TABS) {
    await BackgroundTabService.groupTabsByAge()  // ✓ TESTED
  }
  if (alarm.name === APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS) {
    // ⚠️ This is a SEPARATE alarm handler that's NOT being tested!
    try {
      const state = await StorageRepository.storage.appStateStorage.getValue()
      if (state?.autoClose) {
        await BackgroundTabService.autoCloseOldestGroupTabs();
      }
    } catch {}
  }
})
```

---

## Problem Summary

### The Real Issue

**Two separate alarms are created:**
1. `ALARM_UPDATE_TABS` — fires every 24h to regroup tabs by age
2. `ALARM_AUTO_CLOSE_TABS` — fires every 24h to close old tabs

**Current test only simulates one:**
- `testTriggerAlarm24h()` manually calls business logic (works)
- BUT it doesn't test the actual `browser.alarms.onAlarm` handler
- The auto-close test relies on **conditional logic** not separate alarm firing

**What's missing:**
- ❌ No test for `ALARM_AUTO_CLOSE_TABS` firing as a separate alarm
- ❌ No test that both alarms fire at correct intervals (24h)
- ❌ No test for alarm persistence across extension reloads

---

## Recommended Fixes

### 1. **Add Test for Separate Alarm Handler** (CRITICAL)

Create: `test/playwright/24h-alarm-auto-close-separate.spec.ts`

```typescript
test('should trigger ALARM_AUTO_CLOSE_TABS independently', async () => {
  // Verify the second alarm exists and fires
  const diagnostics = await env.optionsPage.getBackgroundRPC().debugGetDiagnostics()
  
  // Both alarms should have been created at startup
  // (This requires adding a test helper to query created alarms)
})
```

### 2. **Extend testTriggerAlarm24h() to Accept Alarm Name**

Modify `BackgroundTabService.ts`:

```typescript
static async testTriggerAlarm24h(alarmName?: string): Promise<number> {
  const alarm = alarmName ?? APP_DEFAULTS.ALARM_UPDATE_TABS
  
  if (alarm === APP_DEFAULTS.ALARM_UPDATE_TABS) {
    return await this.groupTabsByAge()
  }
  
  if (alarm === APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS) {
    const appState = await StorageRepository.storage.appStateStorage.getValue()
    if (appState?.autoClose) {
      return await this.autoCloseOldestGroupTabs()
    }
  }
  
  throw new Error(`Unknown alarm: ${alarm}`)
}
```

Then use in tests:
```typescript
// Test ALARM_UPDATE_TABS
await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h(APP_DEFAULTS.ALARM_UPDATE_TABS)

// Test ALARM_AUTO_CLOSE_TABS
await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h(APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS)
```

### 3. **Test Alarm Initialization** (BEST PRACTICE)

Add to background.ts test suite:

```typescript
test('should create both 24h alarms at startup', async () => {
  // Verify both alarms are registered with correct intervals
  const alarms = await browser.alarms.getAll()
  const updateAlarm = alarms.find(a => a.name === APP_DEFAULTS.ALARM_UPDATE_TABS)
  const closeAlarm = alarms.find(a => a.name === APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS)
  
  expect(updateAlarm?.periodInMinutes).toBe(1440)  // 24 hours
  expect(closeAlarm?.periodInMinutes).toBe(1440)
})
```

---

## Current Test Status

| Alarm | Test File | Coverage | Issue |
|-------|-----------|----------|-------|
| `ALARM_UPDATE_TABS` | `24h-alarm-age-grouping.spec.ts` | ✅ Complete | None |
| `ALARM_AUTO_CLOSE_TABS` | `24h-alarm-auto-close.spec.ts` | ⚠️ Partial | Tested via manual RPC, not via actual alarm handler |
| Alarm creation | None | ❌ Missing | No test verifies `browser.alarms.create()` actually runs |
| Alarm intervals | None | ❌ Missing | No test verifies 24h periods |

---

## WebExtensions Best Practice (from MDN)

✅ **What the code does (correctly):**
- Creates alarms with `browser.alarms.create()` (global, cross-context)
- Registers `browser.alarms.onAlarm` listener
- Checks alarm name to dispatch to correct handler
- Alarms do NOT persist across browser sessions

⚠️ **What should be tested:**
- Alarm creation happens (query via `browser.alarms.getAll()`)
- Correct period is set (24 hours = 1440 minutes)
- Handler fires when alarm triggers
- Handler is idempotent (safe to call multiple times)

---

## Verdict

**ANSWER TO USER QUESTION:**

> "Does this test indeed test the browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, PERIOD_24H)?"

**Partial Answer:**
- ✅ **ALARM_UPDATE_TABS is tested** — the business logic is verified in `24h-alarm-age-grouping.spec.ts`
- ⚠️ **ALARM_AUTO_CLOSE_TABS is tested partially** — logic works, but not via separate alarm handler
- ❌ **`browser.alarms.create()` itself is NOT tested** — no test verifies the alarm registration happens
- ❌ **Alarm intervals (24h) are NOT tested** — could be 1h or 1min and tests would still pass

**Recommendation:** Tests are functional but don't validate alarm infrastructure. Add tests 1 & 3 from above.

---

**Reference:** [MDN WebExtensions - alarms API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms)
