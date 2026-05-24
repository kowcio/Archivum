<template>
  <div class="got-title-bar">
    <span class="got-title-icon">🕰️</span>
    <h1 class="got-title">Good old tabs</h1>
    <span class="got-version q-ml-auto">v{{ version }}</span>
  </div>
</template>

<script setup lang="ts">
import { APP_CONSTANTS } from '@/constants'
const version = APP_CONSTANTS.APP_VERSION
</script>
