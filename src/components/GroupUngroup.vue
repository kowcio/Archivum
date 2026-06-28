<template>
  <q-btn
    :data-testid="isGrouped ? 'ungroup-tabs-btn' : 'group-tabs-btn'"
    :label="isGrouped ? ungroupLabel : groupLabel"
    :icon="isGrouped ? ungroupIcon : groupIcon"
    :loading="isLoading"
    :size="size"
    :class="btnClasses"
    :rounded="rounded"
    no-caps
    @click="handleToggle"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

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

const isGrouped = ref(false)
const isLoading = ref(false)

const btnClasses = computed(() => ({
  'got-btn-amber': !isGrouped.value,
  'got-btn-blue': isGrouped.value,
}))

/**
 * Query actual browser state: are there any PLUGIN-CREATED groups?
 * ⚠️ Only un-group if groups were created by THIS PLUGIN (title pattern match)
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
  await checkGroupState()
})

async function handleToggle(): Promise<void> {
  isLoading.value = true
  try {
    const action = isGrouped.value
      ? BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS
      : BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE
    await browser.runtime.sendMessage({ action })
    await new Promise(r => setTimeout(r, 150))
    await checkGroupState()
  } catch (err) {
    console.error('[GroupUngroup] handleToggle failed:', err)
    await checkGroupState()
  } finally {
    isLoading.value = false
  }
}
</script>
