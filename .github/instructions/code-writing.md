---
applyTo:
  vue: "src/components/**/*.vue"
  stores: "src/stores/**/*.ts"
  services: "src/**/*.ts"
context7:
  - vue
  - "@vueuse/core"
  - pinia
  - axios
  - dayjs
  - webextension-polyfill
---

# Code Writing

## Vue Components

**Structure**: `<template>` → `<script setup lang="ts">` → `<style scoped>`

**Script Order**:
1. Imports (types, composables, stores)
2. Props with `withDefaults(defineProps<>(), {})`
3. Emits `defineEmits<{ event: [payload: Type] }>()`
4. Composables (@vueuse, stores)
5. Reactive state `ref<Type>()`, `computed()`
6. Methods
7. Lifecycle hooks

**Props**:
```ts
interface Props {
  title: string
  count?: number
}
const props = withDefaults(defineProps<Props>(), { count: 0 })
```

**Emits**:
```ts
const emit = defineEmits<{
  submit: [data: FormData]
  cancel: []
}>()
```

**Composables**: Use @vueuse (useAsyncState, useLocalStorage)  
**Browser APIs**: `import browser from 'webextension-polyfill'`  
**Store**: `const store = useStoreName()`  

## Pinia Stores

**Structure**: `defineStore('name', { state, getters, actions })`

**Template**:
```ts
import { defineStore } from 'pinia'
import type { Type } from '@/models/Types'

interface State {
  items: Type[]
  loading: boolean
  error: unknown
}

export const useStoreName = defineStore('name', {
  state: (): State => ({ items: [], loading: false, error: null }),
  
  getters: {
    count: (state) => state.items.length
  },
  
  actions: {
    async fetch() {
      this.loading = true
      try {
        this.items = await ApiService.get()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    }
  }
})
```

**Patterns**:
- State: Typed interface, default values
- Getters: Derived state, no side effects
- Actions: async/await, loading/error states

## TypeScript Services

**Structure**: Static class with pure methods

**Template**:
```ts
export default class ServiceName {
  private static readonly CONFIG = { /* constants */ }
  
  public static method(input: Type): ReturnType {
    // Pure function logic
    return result
  }
}
```

**API Service**:
```ts
import axios from 'axios'

export class ApiService {
  private static baseURL = 'https://api.example.com'
  
  static async get<T>(endpoint: string): Promise<T> {
    const { data } = await axios.get<T>(`${this.baseURL}${endpoint}`)
    return data
  }
}
```

**Date Handling**: Use dayjs for consistency

## Rules
- Explicit TypeScript types, no `any`
- Single responsibility per file
- Props with defaults
- Emits with types
- Loading + error states in stores
- Try/catch in actions/API calls
- Browser APIs via webextension-polyfill

## Anti-Patterns ❌
- No `any` types
- No inline styles (Vue)
- No mutations in getters (Pinia)
- No side effects in computed (Vue)
- No uncaught promises
- No hardcoded URLs/values
- **NO *.md documentation files** (see [NO_DOCUMENTATION.md](../NO_DOCUMENTATION.md))

## Token Optimization ⚡
**NEVER create .md files documenting changes** (except when explicitly asked)
- Each .md wastes 500-2000 tokens
- Users want code, not reports
- Tests verify correctness (no doc needed)
- Only modify code files

→ @context7/vue, @context7/vueuse, @context7/pinia, @context7/axios
