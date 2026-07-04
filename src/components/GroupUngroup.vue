<template>
  <q-btn
    :data-testid="isGrouped ? 'ungroup-tabs-btn' : 'group-tabs-btn'"
    :label="buttonLabel"
    :icon="isGrouped ? ungroupIcon : groupIcon"
    :loading="isLoading"
    :size="size"
    :class="btnClasses"
    :rounded="rounded"
    :disabled="!isGrouped && !hasStaleTabsToGroup"
    no-caps
    @click="handleToggle"
  >
    <q-tooltip v-if="!isGrouped && !hasStaleTabsToGroup" class="bg-dark">
      All tabs are fresh (less than {{ minThresholdDays }} days old)
    </q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'
import { useAppStore } from '@/store/appStore'
import { TabRow } from '@/entrypoints/options/models/TabRow.ts'
import { mockOverrides } from '@/store/appStore'

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
  groupLabel: 'Group',
  ungroupLabel: 'Ungroup',
  groupIcon: 'folder',
  ungroupIcon: 'unfold_more',
  size: 'md',
  rounded: false,
  square: false,
})

const appStore = useAppStore()
const isGrouped = ref(false)
const isLoading = ref(false)
const allTabs = ref<any[]>([])

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
  return hasStaleTabsToGroup.value ? props.groupLabel : 'All tabs fresh'
})

const btnClasses = computed(() => ({
  'got-btn-amber': !isGrouped.value && hasStaleTabsToGroup.value,
  'got-btn-blue': isGrouped.value,
}))

/**
 * Query all tabs from current window + apply mock overrides
 */
async function refreshAllTabs(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true })

    // Apply mock overrides for testing
    const overrides = await mockOverrides.getValue()
    for (const tab of tabs) {
      if (tab.id != null) {
        const override = overrides[tab.id]
        if (override != null) {
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
    const response = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.HAS_PLUGIN_GROUPS
    }) as any
    isGrouped.value = response?.hasPluginGroups ?? false
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
    console.log('[GroupUngroup] Mock overrides changed → refreshing tabs')
    refreshAllTabs()
  })
})

async function handleToggle(): Promise<void> {
  isLoading.value = true
  try {
    const action = isGrouped.value
      ? BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS
      : BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE
    await browser.runtime.sendMessage({ action })
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
