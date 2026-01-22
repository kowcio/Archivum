---
applyTo: "**/*.spec.ts"
context7:
  - vitest
  - "@vue/test-utils"
  - "@playwright/test"
  - "@pinia/testing"
---

# Test Writing

## Rules
1. Mock `webextension-polyfill` FIRST
2. No `any` - explicit types
3. One test = one behavior

## Vue Component Tests
**Path**: `src/test/unit/ComponentName.spec.ts`  
**Mount**: `mount(C, { global: { plugins: [createTestingPinia()] } })`  
**Async**: `await wrapper.vm.$nextTick()` | `flushPromises()`  
**Test**: render, props, emits, interactions  
→ @context7/vue/test-utils, @context7/pinia/testing

## Pinia Store Tests
**Path**: `src/test/unit/stores/StoreName.spec.ts`  
**Setup**: `setActivePinia(createPinia())` in beforeEach  
**Mock**: `axios-mock-adapter` for APIs  
**Test**: state → getters → actions (success+error)  
→ @context7/pinia, @context7/axios-mock-adapter

## Service Tests
**Path**: `src/test/unit/services/ServiceName.spec.ts`  
**Test**: pure functions, edge cases, errors  
**Mock**: dayjs, stores if needed

## Playwright E2E
**Path**: `src/test/playwright/FeatureName.spec.ts`  
**Load**: extension from `dist/` in `test.beforeAll`  
**Protocol**: `moz-extension://`  
**Test**: popup, options, APIs  
→ @context7/playwright

## Commands
```bash
npm run test:unit           # Unit tests
npm run test:playwright     # E2E
npx vitest --coverage       # Coverage
```

## Mocks
Create `src/test/helpers/mocks.ts`:
- `mockBrowser` (tabs, runtime, storage)
- `mockWebExtension()`
- `createMockChartData()`

## Coverage
Components: 80% | Stores: 90% | Services: 95%
