<template>
  <div class="got-title-bar">
    <div class="row title-row">
      <span class="got-title-icon">🕰️</span>
      <h1 class="got-title">Good old tabs</h1>
    </div>
    <div class="row">
      <span class="got-version q-ml-auto">v{{ version }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {APP_CONSTANTS} from '@/constants'

const version = APP_CONSTANTS.APP_VERSION
</script>

<style lang="css" scoped>


/* ── Page title ─────────────────────────────────────────────────────────── */
.got-title {
  background: var(--got-header-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  margin: 0;
  padding: 0;
  line-height: 1.2;
}


.got-title-bar {
  align-items: center;
  padding: 10px 10px 10px 10px;
  background: linear-gradient(90deg, rgba(255, 109, 0, 0.08) 0%, rgba(21, 101, 192, 0.08) 100%);
  border-bottom: 4px solid;
  border-image: var(--got-header-gradient) 1;
  margin-bottom: 12px;
}


.got-title-icon {
  font-size: 2rem;
}

/* Ensure icon and title align vertically center */
.title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* ── Version badge ──────────────────────────────────────────────────────── */
.got-version {
  font-size: 0.7rem;
  color: rgba(21, 101, 192, 0.55);
}


</style>
