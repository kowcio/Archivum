<template>
  <q-btn-group>
    <q-btn
      :data-testid="isGrouped ? 'popup-btn-ungroup-tabs' : 'popup-btn-group-tabs'"
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
import { ref } from 'vue'
import { browser } from 'wxt/browser'

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

async function handleToggle(): Promise<void> {
  isLoading.value = true
  try {
    if (isGrouped.value) {
      await browser.runtime.sendMessage({ action: 'ungroupAllTabs' })
      isGrouped.value = false
    } else {
      const res = await browser.runtime.sendMessage<{ action: string }, { groupsCreated?: number }>({ action: 'groupTabsByAge' })
      if ((res?.groupsCreated ?? 0) > 0) isGrouped.value = true
    }
  } finally {
    isLoading.value = false
  }
}
</script>
