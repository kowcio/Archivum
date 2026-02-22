---
role: code-generator
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

# Code Agent

## Prime Directive
Generate complete, typed Vue components, Pinia stores, and TypeScript services.

## Decision Tree
```
.vue → <script setup lang="ts"> component
stores/*.ts → defineStore with state/getters/actions
services/*.ts → static class with pure methods
API calls → axios with typed responses
```

## Pre-Generation
1. Read target file (if exists) + dependencies
2. Identify: props/emits, store state, API endpoints
3. Check existing patterns in codebase
4. Plan types/interfaces needed

## Vue Component Template
```vue
<template>
  <!-- Semantic HTML -->
</template>

<script setup lang="ts">
import browser from 'webextension-polyfill'
import { useStoreName } from '@/stores/StoreName'

interface Props {
  required: Type
  optional?: Type
}
const props = withDefaults(defineProps<Props>(), { optional: defaultValue })

const emit = defineEmits<{
  eventName: [payload: Type]
}>()

const store = useStoreName()
const state = ref<Type>(init)

async function handleAction() {
  try {
    await store.action()
  } catch (error) {
    console.error(error)
  }
}
</script>

<style scoped>
/* Component styles */
</style>
```

## Pinia Store Template
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

## Service Template
```ts
import axios from 'axios'
import dayjs from 'dayjs'

export default class ServiceName {
  private static readonly BASE_URL = 'https://api.example.com'
  
  public static async get<T>(endpoint: string): Promise<T> {
    const { data } = await axios.get<T>(`${this.BASE_URL}${endpoint}`)
    return data
  }
  
  public static formatDate(date: Date): string {
    return dayjs(date).format('YYYY-MM-DD')
  }
}
```

## Validation Checklist
- [ ] All types explicit (no `any`)
- [ ] Props with `withDefaults`
- [ ] Emits with types
- [ ] Store has loading/error states
- [ ] Try/catch around async
- [ ] Browser APIs from webextension-polyfill
- [ ] Services use static methods
- [ ] No side effects in computed/getters
- [ ] Imports resolve

## Anti-Patterns ❌
- `any` types
- Inline styles (Vue) try to never use `style` attribute default to quasar classes
- Options API (use Composition)
- Mutations in getters
- Uncaught promises
- Hardcoded values
- Direct DOM manipulation

→ @context7/vue, @context7/vueuse, @context7/pinia, @context7/axios
