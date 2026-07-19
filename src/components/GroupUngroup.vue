<template>
  <div class="row items-center">
    <q-btn
      ref="buttonRef"
      :data-testid="isGrouped ? 'ungroup-tabs-btn' : 'group-tabs-btn'"
      :label="buttonLabel"
      :icon="isGrouped ? ungroupIcon : groupIcon"
      :loading="isLoading"
      :size="buttonSize"
      :class="btnClasses"
      class="col-xs-12"
      :rounded="rounded"
      :disabled="!isGrouped && !hasStaleTabsToGroup"
      no-caps
      @click="handleToggle"
    />
    <q-tooltip
      :target="buttonRef?.$el"
      class="bg-dark"
      v-if="!isGrouped && !hasStaleTabsToGroup"
    >
      Nothing to archive, all tabs are less than {{ minThresholdDays }} days of age.
    </q-tooltip>
    <q-tooltip
      :target="buttonRef?.$el"
      class="bg-dark text-subtitle2"
      v-else-if="hasStaleTabsToGroup"
      v-html="
        `Group all ungrouped tabs older than ${minThresholdDays} days into age-based groups.
        <br/> Existing tabs will be left intact !`
      "
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { createProxyService } from '@webext-core/proxy-service'
import { browser } from 'wxt/browser'
import { useAppStore } from '@/store/appStore'
import { TabRow } from '@/entrypoints/options/models/TabRow.ts'
import { mockOverrides } from '@/store/appStore'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

// ⚠️ DEVELOPERS: createProxyService() returns a type-safe proxy object immediately (not a promise)
// It looks like local methods but actually calls background service worker via messaging
// DO NOT call browser.runtime.sendMessage() directly - use this proxy instead ✅
const background = createProxyService<BackgroundRPC>('background')

type Props = {
  groupLabel?: string
  ungroupLabel?: string
  groupIcon?: string
  ungroupIcon?: string
  size?: string
  rounded?: boolean
  square?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  groupLabel: 'Group by age',
  ungroupLabel: 'Ungroup',
  groupIcon: 'folder',
  ungroupIcon: 'unfold_more',
  size: 'lg',
  rounded: true,
  square: false,
})

const appStore = useAppStore()
const isGrouped = ref(false)
const isLoading = ref(false)
const allTabs = ref<any[]>([])
const buttonRef = ref<any>(null)

const minThresholdDays = computed(() => {
  const levels = appStore.thresholds.value?.active()
  return levels && levels.length > 0 ? levels[0].days : 7
})

/**
 * Reactively check if ANY tab is older than the minimum threshold.
 * Uses actual browser tabs + mock overrides (for testing).
 */
const hasStaleTabsToGroup = computed(() => {
  if (allTabs.value.length === 0) return false

  const thresholds = appStore.thresholds.value
  const minDays = minThresholdDays.value

  // Check if any tab is older than the minimum threshold
  for (const tab of allTabs.value) {
    const row = new TabRow(tab, thresholds)
    if ((row.lastAccessDays ?? 0) > minDays) {
      return true
    }
  }
  return false
})

const buttonLabel = computed(() => {
  if (isGrouped.value) return props.ungroupLabel
  return hasStaleTabsToGroup.value ? props.groupLabel : 'Nothing to archive'
})

const btnClasses = computed(() => ({
  'got-btn-primary': !isGrouped.value && hasStaleTabsToGroup.value,
  'got-btn-primary-faded': !isGrouped.value && !hasStaleTabsToGroup.value,
  'got-btn-primary-blue-faded': isGrouped.value,
}))

const buttonSize = computed(() => {
  // State 1 & 2 (archiving or all fresh): lg size
  // State 3 (grouped): md size (default)
  return isGrouped.value ? 'md' : 'lg'
})

/**
 * Query all tabs from current window + apply mock overrides
 */
async function refreshAllTabs(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true })

    // Apply mock overrides for testing
    const overridesObj = await mockOverrides.getValue()

    // ✅ FIX: Handle both numeric keys and string keys (WXT JSON serialization)
    const overrides: Record<number, number> = {}
    for (const key in overridesObj) {
      const numKey = parseInt(key, 10)
      overrides[numKey] = overridesObj[key as any]
    }

    for (const tab of tabs) {
      if (tab.id != null) {
        const override = overrides[tab.id]
        if (override != null && override > 0) {
          tab.lastAccessed = override
        }
      }
    }

    allTabs.value = tabs
  } catch (e) {
    console.error('[GroupUngroup] refreshAllTabs failed:', e)
    allTabs.value = []
  }
}

/**
 * Query actual browser state: are there any PLUGIN-CREATED groups?
 */
async function checkGroupState(): Promise<void> {
  try {
    // ⚠️ DEVELOPERS: No manual message handling - proxy service handles everything
    // Type-safe: TypeScript knows return type is boolean ✅
    const hasPluginGroups = await background.hasPluginGroups()
    isGrouped.value = hasPluginGroups
  } catch (e) {
    console.error('[GroupUngroup] checkGroupState failed:', e)
    isGrouped.value = false
  }
}

onMounted(async () => {
  await appStore.load()
  await refreshAllTabs()
  await checkGroupState()

  // Listen to tab changes to stay reactive
  if (browser.tabs != null) {
    browser.tabs.onCreated.addListener(() => refreshAllTabs())
    browser.tabs.onRemoved.addListener(() => refreshAllTabs())
  }

   // Listen to mock overrides changes (for testing with backdated tabs)
   mockOverrides.watch(() => {
     refreshAllTabs()
   })
})

async function handleToggle(): Promise<void> {
  isLoading.value = true
  try {
    // ⚠️ DEVELOPERS: Type-safe proxy calls - no manual action strings needed
    // If method signature changes, TypeScript catches it at compile time ✅
    if (isGrouped.value) {
      await background.ungroupAllTabs()
    } else {
      await background.groupTabsByAge()
    }
    await new Promise(r => setTimeout(r, 150))
    await refreshAllTabs()
    await checkGroupState()
  } catch (err) {
    console.error('[GroupUngroup] handleToggle failed:', err)
    await refreshAllTabs()
    await checkGroupState()
  } finally {
    isLoading.value = false
  }
}
</script>
