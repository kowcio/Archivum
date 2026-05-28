import { storage } from '#imports'
import type { TabsSnapshot } from '@/models/tabs/TabsSnapshot'

/**
 * WXT typed storage item for the shared tab state.
 *
 * Single source of truth for the storage key — import `tabStorageItem` everywhere
 * instead of string literals. Provides typed getValue/setValue/watch with no boilerplate.
 *
 * Architecture:
 *   Any context (popup / options / background) calls tabStorageItem.setValue(snapshot)
 *   → WXT fires storage.onChanged
 *   → all other contexts subscribed via tabStorageItem.watch() get the new value
 *   → TabStore.$patch() → Vue reactivity updates the UI
 */
export const tabStorageItem = storage.defineItem<TabsSnapshot | null>(
    'local:tab_history',
    { fallback: null },
)

