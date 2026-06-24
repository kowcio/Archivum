<template>
  <q-btn-group>
    <q-btn
      :data-testid="isGrouped ? 'ungroup-tabs-btn' : 'group-tabs-btn'"
      :label="isGrouped ? ungroupLabel : groupLabel"
      :icon="isGrouped ? ungroupIcon : groupIcon"
      :color="isGrouped ? ungroupColor : groupColor"
      :loading="isLoading"
      v-bind="$attrs"
      @click="handleToggle"
    />
  </q-btn-group>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

type Props = {
  groupLabel?: string
  ungroupLabel?: string
  groupIcon?: string
  ungroupIcon?: string
  groupColor?: string
  ungroupColor?: string
}

withDefaults(defineProps<Props>(), {
  groupLabel: 'Group by age',
  ungroupLabel: 'Ungroup',
  groupIcon: 'folder',
  ungroupIcon: 'unfold_more',
  groupColor: 'purple',
  ungroupColor: 'warning',
})

const isGrouped = ref(false)
const isLoading = ref(false)


/**
 * Query actual browser state: are there any PLUGIN-CREATED groups?
 * ⚠️ Only un-group if groups were created by THIS PLUGIN (title pattern match)
 *
 * Logic:
 * - Ask background.ts: "Do plugin groups exist?"
 * - Background checks tabGroups titles: "Week+ (5)", "Month+ (2)" etc
 * - Only show "Ungroup" if plugin groups found
 * - This prevents accidentally ungrouping user's own groups!
 */
async function checkGroupState(): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.HAS_PLUGIN_GROUPS
    }) as any
    isGrouped.value = response?.hasPluginGroups ?? false
  } catch (e) {
    // On error, assume no groups (safe fallback: show "Group" button)
    console.error('[GroupUngroup] checkGroupState failed:', e)
    isGrouped.value = false
  }
}

/**
 * Init: check state on mount
 */
onMounted(async () => {
  await checkGroupState()
})

/**
 * Click handler: send message to background, then re-verify state
 * ⚠️ Never pre-set isGrouped - always query browser state!
 */
async function handleToggle(): Promise<void> {
  isLoading.value = true
  try {
    // Send action to background service worker
    const action = isGrouped.value
      ? BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS
      : BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE
    await browser.runtime.sendMessage({ action })

    // Wait for browser to process the change
    // (Chrome needs ~150ms for tab grouping operations)
    await new Promise(r => setTimeout(r, 150))

    // ✅ Always re-check from source of truth (browser.tabs)
    // Never trust the response or pre-set state
    await checkGroupState()
  } catch (err) {
    console.error('[GroupUngroup] handleToggle failed:', err)
    // Re-check state even on error (browser might have changed it anyway)
    await checkGroupState()
  } finally {
    isLoading.value = false
  }
}
</script>
