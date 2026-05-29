<template>
  <q-btn
    :data-testid="isLoaded ? 'btn-reset' : 'btn-load-tabs'"
    :label="isLoaded ? 'Reset' : 'Load & Mark'"
    :icon="isLoaded ? 'restart_alt' : 'refresh'"
    :color="isLoaded ? 'negative' : 'primary'"
    :class="btnClass"
    :loading="tabStore.loading"
    v-bind="$attrs"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '@/stores/TabStore'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ btnClass?: string }>()

const tabStore = useTabStore()

const isLoaded = computed(() => tabStore.tabs.some(t => t.isMarked))

async function handleClick(): Promise<void> {
  if (isLoaded.value) {
    await tabStore.reset()
  } else {
    await tabStore.getAllOpenedTabs()
  }
}
</script>
