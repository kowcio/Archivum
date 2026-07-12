# Tab Age Tracker - Architecture Overview

## Communication Architecture: @webext-core/proxy-service

### Problem Solved
Browser extensions run in **separate execution contexts**:
- **Background Service Worker** - Has full browser API access, handles alarms, tab operations
- **UI Contexts** (Popup, Options) - Vue 3 components, limited browser API access
- **Content Scripts** - Run in page context

Before: Manual message routing with **200+ lines of if-else handlers** + `as any` casting = ❌ Not type-safe

Now: Type-safe RPC with **1 registration call** = ✅ Full TypeScript inference

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣ RPC Definition (BackgroundRPC.ts)                       │
│  ─────────────────────────────────────────────────────────  │
│  export const backgroundRPC = {                             │
│    groupTabsByAge: (): Promise<number> => ...               │
│    getTabs: (): Promise<Browser.tabs.Tab[]> => ...          │
│    setMockOverrides: (overrides) => ...                      │
│    // 🧪 11 production + 3 dev/test methods                 │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2️⃣ Service Registration (background.ts)                    │
│  ─────────────────────────────────────────────────────────  │
│  registerService('background', backgroundRPC)              │
│  // All 14 methods auto-registered, no manual routing       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3️⃣ Consumer Calls (UI Components + Tests)                 │
│  ─────────────────────────────────────────────────────────  │
│  // UI Components (Vue):                                    │
│  const bg = createProxyService<BackgroundRPC>('background') │
│  await bg.groupTabsByAge()  // Type-safe! ✅               │
│                                                             │
│  // Playwright Tests (via TestHelper):                      │
│  const tabs = await TestHelper.createMockTabs()  // Direct! │
└─────────────────────────────────────────────────────────────┘
```

---

## Communication Flows

### Flow 1: Production UI → Background (Type-Safe Proxy)
```
Vue Component
  ↓
createProxyService<BackgroundRPC>('background')  [SYNC, returns immediately]
  ↓
const result = await bg.groupTabsByAge()  [Async method call, fully typed]
  ↓
@webext-core/proxy-service
  ↓ (automatic marshalling)
browser.runtime.sendMessage()  [Transparent serialization]
  ↓
Background Service Worker
  ↓
Handler delegates to RPC method ✅
```

**Key**: No manual serialization, full TypeScript inference, zero `as any` casting

---

### Flow 2: Playwright Tests → Background (TestHelper Direct Calls)
```
Playwright Test
  ↓
import { TestHelper } from 'test/services/TestHelper'
  ↓
const tabs = await TestHelper.createMockTabs()  [Direct call, no message passing]
  ↓
TestHelper → Background RPC → BackgroundTabService
  ↓
Test receives tabs
```

**Key**: 
- Tests bypass message API entirely
- Same RPC methods as production UI
- Faster, type-safe, cleaner

---

## RPC Methods (14 Total)

### Tab Organization (5)
- `groupTabsByAge()` - Group tabs by age thresholds
- `ungroupAllTabs()` - Remove all groups
- `hasPluginGroups()` - Check if plugin groups exist
- `sortGroupsByDomain()` - Sort ungrouped tabs alphabetically
- `openRandomTabInGroup()` - Create test tab with random ID

### Tab Operations (4)
- `getTabs()` - Query all tabs in current window
- `closeTab(tabId)` - Close tab, update group count
- `focusTab(tabId)` - Activate tab, bring window to foreground
- `onTabActivated(tabId)` - Listener: ungroup + move to rightmost

### Test Helpers (3) 🧪
- `createMockTabs()` - Create backdated test tabs
- `setMockOverrides(overrides)` - Simulate tab aging
- `getMockOverrides()` - Debug: inspect current overrides

### Backup/Restore (2)
- `backupTabs()` - Save grouped tabs to storage
- `restoreTabs()` - Close all, recreate from backup

---

## Key Design Principles

### 1. Single Source of Truth
```typescript
// ✅ ONE definition in BackgroundRPC
setMockOverrides: (overrides) => mockOverrides.setValue(overrides)

// Used by:
// - UI components via createProxyService() (type-safe)
// - Playwright tests via TestHelper (direct calls)
// - Background alarms (direct call)
```

### 2. No Manual Message Routing
```typescript
// ❌ BEFORE (200+ lines):
if (msg.action === 'GROUP_TABS_BY_AGE') { ... }
if (msg.action === 'UNGROUP_ALL_TABS') { ... }
if (msg.action === 'HAS_PLUGIN_GROUPS') { ... }
// ... 10+ more if/else blocks

// ✅ AFTER (1 line):
registerService('background', backgroundRPC)
```

### 3. Test Helpers Are NOT Separate Code Paths
```typescript
// TestHelper delegates to same RPC as production UI
// Benefits:
// - If RPC changes, tests automatically use new implementation
// - No drift between test code and production code
// - Test failures surface real bugs, not test-specific issues
```

### 4. page.evaluate() Context Limitation
```typescript
// ❌ WRONG: Proxy-service not available in page.evaluate()
const bg = createProxyService<BackgroundRPC>('background')

// ✅ RIGHT: Tests use TestHelper (outside page.evaluate context)
const tabs = await TestHelper.createMockTabs()
```

---

## Type Safety Guarantee

```typescript
// UI Component - Full TypeScript inference ✅
const bg = createProxyService<BackgroundRPC>('background')

// TypeScript knows the exact signature:
const count: number = await bg.groupTabsByAge()           // ✅
const tabs: Browser.tabs.Tab[] = await bg.getTabs()       // ✅
await bg.closeTab(tabId)  // TS ensures tabId is number   // ✅
await bg.closeTab('123')  // ❌ TS ERROR: string ≠ number

// No 'as any' casting needed anywhere 🎉
```

---

## Files Overview

| File | Purpose |
|------|---------|
| `src/services/BackgroundRPC.ts` | 🎯 RPC definition (14 methods) |
| `src/entrypoints/background.ts` | 📋 `registerService()` call (61 lines, clean!) |
| `src/services/BackgroundTabService.ts` | 🔧 Tab operations (static methods) |
| `src/services/BackupService.ts` | 💾 Backup/restore logic |
| `test/services/TestHelper.ts` | 🧪 Test method access (direct RPC proxy) |
| `src/components/*.vue` | 📱 UI components using `createProxyService()` |

---

## Development Workflow

### Adding a New Feature
1. **Create service** (e.g., `MyService.ts`)
2. **Add RPC method** to `BackgroundRPC.ts`:
   ```typescript
   myFeature: (param: string): Promise<string> => MyService.doSomething(param)
   ```
3. **Use in UI** (auto-typed):
   ```typescript
   const bg = createProxyService<BackgroundRPC>('background')
   const result = await bg.myFeature('test')  // ✅ Fully typed
   ```
4. **Test in Playwright**:
   ```typescript
   const result = await TestHelper.openRandomTabInGroup()
   // TestHelper automatically delegates to RPC method
   ```

**No manual message routing needed** - RPC handles everything! 🚀

---

## Benefits Summary

| Aspect | Gain |
|--------|------|
| **Type Safety** | Full TypeScript inference, no `as any` ✅ |
| **Code Reuse** | One implementation, used everywhere |
| **Maintainability** | Change RPC once, updates everywhere |
| **Testing** | Tests use production code paths via TestHelper |
| **Refactor Safety** | Rename-safe across codebase |
| **Lines of Code** | 200+ if/else handlers → 1 `registerService()` call |
| **Developer Experience** | IDE autocomplete, compile-time errors |

---

**Result**: A clean, type-safe, single-source-of-truth architecture for cross-context communication in browser extensions. 🎉
