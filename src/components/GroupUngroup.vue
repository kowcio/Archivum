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
import { useAppStore } from '@/stores/appStore'

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

const appStore = useAppStore()

const isGrouped = computed(() => appStore.isGrouped)
const isLoading = computed(() => appStore.loading)

async function handleToggle(): Promise<void> {
  if (appStore.isGrouped) {
    await appStore.ungroupAllTabs()
  } else {
    await appStore.groupTabsByAge()
  }
}
</script>

