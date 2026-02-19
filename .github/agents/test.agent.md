---
role: test-generator
applyTo: "**/*.spec.ts"
context7:
  - vitest
  - "@vue/test-utils"
  - "@playwright/test"
  - "@pinia/testing"
---

# Test Agent

## Prime Directive
Generate complete, runnable tests. No TODO.

## Decision
```
.vue → mount() + createTestingPinia()
stores/*.ts → setActivePinia() + MockAdapter
services/*.ts → pure function tests
E2E → Playwright from dist/
```

## Pre-Gen Checklist
1. Read target + dependencies
2. Check existing test patterns
3. Identify: props, emits, stores, browser APIs

## Structure
```ts
// 1. vitest imports
// 2. vi.mock() BEFORE component imports
// 3. describe → beforeEach → tests
// 4. afterEach cleanup
```

## Types
- `VueWrapper<InstanceType<typeof C>>`
- `ReturnType<typeof useStore>`
- No `any` → use `unknown`

## Critical Mocks
```ts
// webextension-polyfill (ALWAYS first if browser APIs)
vi.mock('webextension-polyfill', () => ({ default: {} }))

// Axios (stores)
let mock = new MockAdapter(axios)
// beforeEach: new, afterEach: reset()

// Dayjs
vi.mock('dayjs', () => ({ default: () => ({ format: () => '2026-01-22' }) }))
```

## Test Paths
- Vue: `src/test/unit/ComponentName.spec.ts`
- Store: `src/test/unit/stores/StoreName.spec.ts`
- Service: `src/test/unit/services/ServiceName.spec.ts`
- E2E: `src/test/playwright/FeatureName.spec.ts`

## Patterns
**Vue**: render, props, emits, interactions, async  
**Store**: state → getters → actions (success+error)  
**Service**: happy + edge + error  
**E2E**: load, navigate, interact, assert

## Validation ✓
- [ ] Imports resolve
- [ ] webextension-polyfill mocked if needed
- [ ] Types explicit
- [ ] Async awaited
- [ ] Mocks reset
- [ ] Behavior-named tests
- [ ] Edge cases

## Refs
@context7/vitest | @context7/vue/test-utils | @context7/pinia/testing | @context7/playwright
