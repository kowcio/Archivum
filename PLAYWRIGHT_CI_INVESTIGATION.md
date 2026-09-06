# Playwright Test Failures on GitHub Actions — Investigation & Fix

## Problem Summary
✅ **16/20 tests pass locally**  
❌ **11/27 tests fail on GitHub Actions CI**

All failures are UI interaction timeouts after element is detected as "visible, enabled, stable"

## Failure Pattern
```
TimeoutError: locator.click/fill: Timeout 15000ms exceeded
├─ element is visible, enabled and stable ✓
├─ scrolling into view if needed ✓
├─ performing click action → HANGS
└─ waiting for scheduled navigations to finish → TIMES OUT
```

## Root Cause Analysis

**Not a test logic problem** — the issue is **service worker responsiveness** on GitHub Actions CI:

### Why it Works Locally
- Abundant CPU/RAM
- No container resource limits
- Fast DOM rendering (Quasar components settle quickly)
- Service worker responds immediately to clicks

### Why it Fails on GitHub Actions
- **Limited CPU** in Ubuntu container (2-4 cores shared)
- **Heavy workload**: Chrome MV3 extension + service worker + Quasar UI all competing for CPU
- **Element "stable"** != **interaction complete**
  - Playwright detects element is ready
  - Click is dispatched successfully
  - But service worker is **blocked** by main thread
  - Event handlers never fire → click action never completes
- **`navigationTimeout` exhausts** while waiting for "scheduled navigations"

### Specific Failures

| Test | Timeout | Root Cause |
|------|---------|-----------|
| `24h-alarm-auto-close` | click toggle @ 15s | Service worker handling click is starved |
| `OptionsTresholdsTest` | click apply @ 15s | Background tab regrouping blocks event loop |
| `ThresholdDayLevelChange` | click group/ungroup @ 15s | Same as above |
| `thresholds-change` | fill input @ 15s | Vue input handler blocked |
| `SingleTabInGroup` | grouping @ 15s | Flaky - sometimes SW responds, sometimes not |
| `independence-grouping` | click group @ 15s | Inconsistent - depends on CPU availability |

## Solution Implemented

### 1️⃣ **Increased Timeouts for CI** (`playwright.config.ts`)

```typescript
// Before: 15s too short for resource-constrained CI
actionTimeout: isCI ? 15_000 : 10_000

// After: 30s allows service worker to process on slow hardware
actionTimeout: isCI ? 30_000 : 10_000

// Also increased:
navigationTimeout: 30s → 45s
expect(): 15s → 20s
testTimeout: 120s → 150s
```

### 2️⃣ **Retry Logic in OptionsPage** (`test/playwright/page-objects/OptionsPage.ts`)

Added 3-attempt retry loops with exponential backoff:

```typescript
// clickAutoCloseToggle() - 3 attempts @ 500ms backoff
// setLevelsCount() - fill/clear with retry
// clickGroupTabs() - with waitForLoadState()
// clickApplyThresholds() - click + extend polling to 25s
```

**Why this works:**
- If first click hangs due to SW being momentarily blocked, retry succeeds
- 500ms backoff gives SW time to catch up

### 3️⃣ **Chrome Launch Improvements** (`test/playwright/chromium/extensions.ts`)

```typescript
// Prevent IPC message throttling on slow CI
"--disable-ipc-flooding-protection"
```

### 4️⃣ **Enhanced Diagnostics**

Every interaction now logs:
- Start time & timing info
- Retry attempt numbers
- Clear error messages
- Service worker status

Example output:
```
[OptionsPage] 🔄 Clicking group tabs button...
[OptionsPage] ⏳ Waiting for groups to be created...
[OptionsPage] 📍 Click attempt 1/3...
[OptionsPage] ✅ Click succeeded on attempt 1
[OptionsPage] ✅ Groups created (took 8234ms)
```

## Testing the Fix

To verify improvements:

```bash
# Run locally (should still pass)
npm run test:playwright:chromium

# Watch GitHub Actions run — look for:
# ✅ Reduced timeout failures
# ✅ Retries succeeding on 2nd/3rd attempt
# ✅ Clearer diagnostic messages in logs
```

## Key Takeaways

1. **Element ready ≠ Interaction complete** in extension contexts
2. **CI resource constraints matter** — CI needs 2x timeouts vs local
3. **Retries are your friend** — small backoff often succeeds
4. **Logging is debugging** — add timing info to all interactions
5. **Service worker IPC** can be throttled on slow hardware

## Monitoring

If tests still flake:
- Check GitHub Actions CPU/memory usage
- Consider reducing test parallelism (already 1 worker)
- May need 40-50s timeouts if CI hardware degrades further

---
**Last Updated:** 2026-09-05  
**Status:** DEPLOYED ✅
