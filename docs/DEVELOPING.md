# Development Guide

## Quick Start

### Setup
```bash
git clone ...
npm install
npm run install:chromium  # For Playwright
```

### Development Mode
```bash
npm run dev              # Chrome with HMR
npm run dev:firefox     # Firefox
npm run dev:edge        # Edge

# Visit chrome-extension://[EXTENSION_ID]/options.html
# Extension ID shown in console after startup
```

---

## Build & Test Commands

### Type Checking
```bash
npm run type-check    # Validate TypeScript (no compile)
npm run lint          # ESLint + Prettier
npm run format        # Auto-format code
```

### Testing
```bash
npm run test:unit                    # Vitest (110 tests)
npm run test:unit:watch              # Watch mode
npm run test:playwright:chromium     # Playwright E2E (Chrome)
npm run test:playwright:firefox      # Playwright E2E (Firefox)
npm run test:playwright:debug        # Debug with Playwright Inspector
npm run test:playwright:ui           # Visual test runner
npm test                             # Full suite
```

### Building
```bash
npm run build                   # Production builds (all browsers)
npm run build:test:chromium    # Chrome with dev features
npm run build:test:firefox     # Firefox with dev features

npm run zip:all                # Package all 3 browsers
npm run release                # Full pipeline: type-check → lint → test → build → zip
```

---

## Project Commands Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Chrome dev mode (HMR) |
| `npm run type-check` | Validate TypeScript |
| `npm run test:unit` | Run unit tests |
| `npm test` | Run ALL tests |
| `npm run build` | Production build |
| `npm run release` | Full release pipeline |

---

## Architecture: RPC Communication

### Adding a New Feature

**Step 1: Create Service**
```typescript
// src/services/MyFeatureService.ts
export class MyFeatureService {
  static async processData(input: string): Promise<string> {
    // ...implementation
    return result
  }
}
```

**Step 2: Register in RPC**
```typescript
// src/services/BackgroundRPC.ts
import { MyFeatureService } from '@/services/MyFeatureService'

export const backgroundRPC = {
  // ...existing methods
  myFeature: (input: string): Promise<string> => 
    MyFeatureService.processData(input),
}
```

**Step 3: Use in Components**
```typescript
// src/components/MyComponent.vue
import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

const bg = createProxyService<BackgroundRPC>('background')
const result = await bg.myFeature('input')  // ✅ Fully typed!
```

**Step 4: Test with TestHelper**
```typescript
// test/playwright/my-feature.spec.ts
import { TestHelper } from 'test/services/TestHelper'

const result = await TestHelper.myFeature('input')
```

**Result**: Zero boilerplate, full type safety, automatic everywhere! 🎉

---

## File Structure

### Core Architecture
```
src/
├── entrypoints/
│   ├── background.ts           Background service worker (61 lines!)
│   ├── options/App.vue         Options page UI
│   └── popup/App.vue           Popup UI
├── services/
│   ├── BackgroundRPC.ts        RPC definition (14 methods)
│   ├── BackgroundTabService.ts Tab operations
│   ├── BackupService.ts        Backup/restore
│   └── ...
├── components/                 Reusable Vue components
├── models/                      TypeScript types & factories
├── stores/                      Pinia stores
└── utils/                       Utilities
```

### Testing
```
test/
├── services/
│   └── TestHelper.ts           Direct RPC access for tests
├── playwright/
│   ├── page-objects/           Page Object Models
│   └── chromium/               Browser-specific tests
└── unit/                       Unit tests
```

---

## Code Patterns

### 1. Service Pattern (Static Methods)

**Why**: Services are stateless, thread-safe across extension contexts.

```typescript
// ✅ CORRECT
export class MyService {
  static async doSomething(input: string): Promise<string> {
    return result
  }
}

// ❌ WRONG: Instance methods
export class MyService {
  async doSomething(input: string): Promise<string> {}
}
```

### 2. RPC Methods (Always Async)

**Why**: @webext-core/proxy-service requires all methods to return `Promise<T>`.

```typescript
// ✅ CORRECT: Returns Promise even if sync
getTabs: (): Promise<Browser.tabs.Tab[]> => 
  BackgroundTabService.getTabs()

// ❌ WRONG: Sync return type won't register
getTabs: (): Browser.tabs.Tab[] => 
  BackgroundTabService.getTabs()
```

### 3. Type Safety (No `as any`)

```typescript
// ✅ CORRECT: Typed RPC
const bg = createProxyService<BackgroundRPC>('background')
const count = await bg.groupTabsByAge()  // number ✅

// ❌ WRONG: Bypasses type system
const response = await browser.runtime.sendMessage(...) as any
```

### 4. Browser API (No Direct Imports)

```typescript
// ✅ CORRECT: Use webextension-polyfill
import browser from 'webextension-polyfill'
await browser.tabs.query({})

// ❌ WRONG: Chrome global only exists in some contexts
const tabs = await chrome.tabs.query({})  // Undefined in many places
```

---

## Tab Groups System

### Understanding Group Indices

```
Browser Visual Layout:
[T0][T1][T2] | [T3][T4] | [T5][T6][T7] | [T8]
 Group A      Group B      Group C       Ungrouped
```

- **Tab indices**: Continuous (0, 1, 2, 3, 4, 5, 6, 7, 8)
- **Group indices**: Sparse (0, 3, 5) - only at group starts
- **Group.index**: Position of leftmost tab in that group

### Why Always Sort

```typescript
// ❌ WRONG: No guaranteed order
const groups = await browser.tabGroups.query({ windowId })

// ✅ CORRECT: Sort by visual position
const sorted = groups.sort((a, b) => (a.index ?? -1) - (b.index ?? -1))
```

### Tab Grouping by Age

**Order**: Oldest → Youngest (left → right)

1. "Eat that frog!" (Index 0) - Very old tabs
2. "Quarter+" (Index 1) - 90+ days
3. "Month+" (Index 2) - 28+ days
4. "2 Weeks+" (Index 3) - 14+ days
5. "Week+" (Index 4) - 7+ days
6. Ungrouped (Index -1) - Younger than 7 days

---

## WXT Framework Gotchas

### 1. Alarms (Not setInterval)

**Problem**: `setInterval` doesn't work in service workers.

**Solution**: Use WXT alarms:
```typescript
// ✅ CORRECT
browser.alarms.create('myAlarm', { periodInMinutes: 60 })
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'myAlarm') {
    // Do work...
  }
})

// ❌ WRONG: Doesn't work in service workers
setInterval(() => { /* ... */ }, 60000)
```

### 2. Storage Access

**In background**: Use WXT storage wrapper for sync access:
```typescript
// ✅ CORRECT (background.ts)
const { mockOverrides } = await import('@/store/appStore')
const value = await mockOverrides.getValue()

// ❌ WRONG: Async access overhead
const value = await browser.storage.local.get('key')
```

**In UI**: Use Pinia stores with WXT storage watcher:
```typescript
// ✅ CORRECT (Vue components)
const store = useMyStore()
const { data } = storeToRefs(store)
// Automatically syncs with storage
```

### 3. Content Scripts

**Communication pattern**:
```typescript
// content.ts (runs in page context)
window.addEventListener('message', (event) => {
  browser.runtime.sendMessage({
    action: 'DO_SOMETHING',
    data: event.data
  })
})

// background.ts (receives messages)
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'DO_SOMETHING') {
    // Process content script message
  }
})
```

---

## Common Development Patterns

### Pattern 1: Adding a New UI Component

**Files to create/modify**:
1. `src/components/MyFeature.vue` - Vue component
2. `src/services/BackgroundRPC.ts` - Add RPC method if needed
3. `test/playwright/page-objects/OptionsPage.ts` - Add test helper method

### Pattern 2: Implementing a New Background Task

**Files to create/modify**:
1. `src/services/MyTaskService.ts` - Service implementation
2. `src/services/BackgroundRPC.ts` - Register RPC method
3. `src/entrypoints/background.ts` - Register alarm/listener if needed
4. `test/services/TestHelper.ts` - Add test helper if needed

### Pattern 3: Debugging Extension Behavior

```bash
# View background service worker console
# Chrome DevTools → Application → Service Workers
# Click "inspect" on your extension

# View popup/options console
# Right-click extension icon → Inspect popup
# Or click the popup window

# View extension logs
npm run dev  # Outputs to terminal
```

---

## Firefox-Specific Gotchas

### Version Format (CRITICAL)

❌ WRONG: `1.26.0711.0920` (leading zeros rejected)  
✅ RIGHT: `1.26.711.920` (no zeros)

**Solution**:
```typescript
// wxt.config.ts
const monthDay = Number(`${month.padStart(2, '0')}${day.padStart(2, '0')}`)
const hourMin = Number(`${hours.padStart(2, '0')}${minutes.padStart(2, '0')}`)
return `1.${year}.${monthDay}.${hourMin}`
```

**Validate**:
```bash
npm run build:test:firefox
npx web-ext lint --source-dir .output/firefox-mv3
```

---

## Performance Optimization

### 1. Lazy Import Services
```typescript
// Only import when needed
const service = (await import('@/services/MyService')).default
```

### 2. Debounce Storage Writes
```typescript
// Don't write to storage on every keystroke
let timer: NodeJS.Timeout
const handleInput = debounce(() => {
  store.save()  // Batched write
}, 500)
```

### 3. Query Minimization
```typescript
// ✅ CORRECT: Single query
const tabs = await browser.tabs.query({ windowId })

// ❌ WRONG: Multiple queries
const active = await browser.tabs.query({ active: true })
const all = await browser.tabs.query({ windowId })
```

---

## Dependency Management

**NEVER re-add these** (verified unused):
- `axios` (use `fetch`)
- `jsdom` (use Vitest's happy-dom)
- `archiver` (use zip command)

**Locked dependencies** (don't upgrade):
- WXT 0.20+ (core)
- Vue 3.5+ (UI)
- Pinia 3+ (state)
- Quasar 2+ (component library)
- Vitest 4+ (testing)
- Playwright 1.60+ (E2E testing)

---

## Debugging Tips

### TypeScript Errors
```bash
npm run type-check  # Full validation
# IDE cache issue? Use File → Invalidate Caches in IntelliJ
```

### Test Failures
```bash
npm run test:playwright:debug     # Step-by-step debugging
npm run test:unit:watch           # Watch mode for unit tests
```

### Extension Issues
1. Check background console (Chrome DevTools → Service Workers)
2. Check popup console (right-click extension → Inspect)
3. Run tests to isolate issue
4. Add console.log throughout flow

---

## Release Process

```bash
npm run release
# 1. Type-check
# 2. Lint & format
# 3. Run test:unit
# 4. Build all browsers
# 5. Create .zip files
# Output: .output/archivum-*.zip
```

---

**Key Principles**: Type-safe communication, clean separation of concerns, comprehensive testing. Happy coding! 🚀

