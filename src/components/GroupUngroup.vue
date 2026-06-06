<template>
  <q-btn-group>
    <q-btn
      :data-testid="isGrouped ? 'btn-ungroup-tabs' : 'btn-group-by-age'"
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
import { computed } from 'vue'
import { useTabStore } from '@/stores/TabStore'

// Props for customization
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

const tabStore = useTabStore()

const isGrouped = computed(() => tabStore.isGrouped)
const isLoading = computed(() => tabStore.loading)

async function handleToggle(): Promise<void> {
  if (tabStore.isGrouped) {
    await tabStore.ungroupAllTabs()
  } else {
    await tabStore.groupTabsByAge()
  }
}
</script>

