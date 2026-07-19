# Documentation Guide

Welcome! This folder contains comprehensive documentation for the Tab Age Tracker extension. **Start with the appropriate guide below based on what you need to do**.

---

## 📚 Four Core Documents

### 1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System Design & Patterns
**Read this first to understand HOW the extension works**

- **@webext-core/proxy-service** - Type-safe RPC communication
- **Communication flows** - How UI, tests, and background interact
- **RPC methods** - All 14 methods categorized
- **Key design principles** - Single source of truth, no message routing
- **Type safety** - Full TypeScript inference, no `as any` casting

**For**: Understanding the system, learning core patterns, adding features

---

### 2. **[TESTING.md](./TESTING.md)** - Testing Practices & Gotchas
**Read this when writing or debugging tests**

- **TestHelper pattern** - Direct RPC access for tests (no message passing)
- **Test architecture** - Unit (Vitest) and E2E (Playwright) tests
- **Common patterns** - Loading mocks, aging tabs, verifying state
- **Gotchas** - 7 critical testing issues and solutions
- **Type safety in tests** - Full TypeScript inference

**For**: Writing reliable tests, debugging test failures, understanding quirks

---

### 3. **[DEVELOPING.md](./DEVELOPING.md)** - Development Workflow
**Read this when adding features or optimizing code**

- **Quick start** - Setup, dev mode, commands
- **Architecture** - Adding services, RPC methods, components
- **File structure** - Where to put code
- **Code patterns** - Service pattern, RPC methods, browser API usage
- **Tab groups system** - How index system works
- **WXT framework** - Alarms, storage, content scripts
- **Firefox gotchas** - Version format, validation

**For**: Day-to-day development, feature implementation, debugging

---

### 4. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Commands & Output
**Use as a quick lookup for build/test commands**

- **Build commands** - Dev, test, production
- **Test commands** - Unit and E2E
- **Packaging** - Distribution .zip files
- **Output structure** - Where files end up

**For**: Running builds/tests, quick command lookup

---

## 🎯 Quick Navigation by Task

### "I want to understand the system"
→ Read [ARCHITECTURE.md](./ARCHITECTURE.md)

### "I'm writing tests and they're failing"
→ Go to [TESTING.md](./TESTING.md) → Search for the issue in "Gotchas"

### "I'm adding a new feature"
→ Follow steps in [DEVELOPING.md](./DEVELOPING.md) → "Adding a New Feature"

### "I want to run a command"
→ Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

### "I need to debug something"
→ See [DEVELOPING.md](./DEVELOPING.md) → "Debugging Tips"

### "I want to know how mocking works in tests"
→ Go to [TESTING.md](./TESTING.md) → "Pattern 2: Simulate Tab Aging"

---

## ⚡ Key Concepts at a Glance

### RPC Communication
```typescript
// Define once (BackgroundRPC.ts)
myMethod: (): Promise<string> => MyService.doSomething()

// Use in UI (Vue components)
const bg = createProxyService<BackgroundRPC>('background')
await bg.myMethod()  // ✅ Type-safe, fully inferred

// Use in tests (Playwright)
const result = await TestHelper.myMethod()  // ✅ Direct, fast
```

### Test Pattern
```typescript
// Create test data
const tabs = await TestHelper.createMockTabs()

// Simulate aging
await TestHelper.setMockOverrides({ tabId: Date.now() - 7days })

// Verify state
const groups = await optionsPage.getAllGroups()  // ✅ Always sorted
```

### Tab Groups
```
[T0][T1][T2] | [T3][T4] | [T5][T6][T7] | [T8]
 Group A      Group B      Group C       Ungrouped
  Idx 0        Idx 3        Idx 5        Idx -1
```

---

## 🚀 Getting Started

1. **Setup**
   ```bash
   npm install
   npm run install:chromium  # For Playwright tests
   ```

2. **Understand the system**
   - Read [ARCHITECTURE.md](./ARCHITECTURE.md)

3. **Run tests**
   - `npm run test:unit` (quick)
   - `npm run test:playwright:chromium` (full E2E)

4. **Start developing**
   - `npm run dev` (Chrome with HMR)
   - Make changes, test with `npm test`

5. **Deploy**
   - `npm run release` (builds + packages)

---

## 📝 Notes for Future Developers

### Important Patterns
- **Services** use static methods (never instances)
- **RPC methods** always return `Promise<T>` (even for sync operations)
- **Tab groups** must be sorted by `.index` (API returns arbitrary order)
- **Tests** use `TestHelper` for direct RPC access (no message passing)

### Critical Gotchas
1. Group sorting - Always sort by `.index`
2. Mock overrides - Persist across tests, reset between
3. Tab creation - Wait for `networkidle` after creating mocks
4. Storage sync - Add explicit wait for persistence
5. page.evaluate() - Can't use proxy-service there (use TestHelper instead)
6. Assertions - Use exact values with `toBe()`, not comparisons
7. Test isolation - Always setup/cleanup properly

### Firefox Specifics
- Version format: `1.26.711.920` (no leading zeros!)
- Validate with: `npx web-ext lint --source-dir .output/firefox-mv3`

---

## 💡 Pro Tips

- **Type checking**: `npm run type-check` (validates without compile)
- **Watch mode**: `npm run test:unit:watch` (fast feedback during development)
- **Debug tests**: `npm run test:playwright:debug` (Playwright Inspector)
- **IDE issues**: File → Invalidate Caches → Restart (clears TypeScript cache)

---

## 📖 Document Structure

```
docs/
├── README.md (you are here)           ← Start here
├── ARCHITECTURE.md                    ← System design & patterns
├── TESTING.md                         ← Test practices & gotchas
├── DEVELOPING.md                      ← Development workflow
└── QUICK_REFERENCE.md                 ← Build commands
```

---

## Questions?

1. **System architecture** → [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Test debugging** → [TESTING.md](./TESTING.md) → Gotchas section
3. **Feature implementation** → [DEVELOPING.md](./DEVELOPING.md) → Patterns section
4. **Commands** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

---

**Happy coding!** 🚀 The codebase is designed to be learnable—explore the source code alongside these guides.

