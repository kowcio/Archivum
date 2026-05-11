<template>
  <div id="my-vue-header" data-testid="content-root">
    <div data-testid="debug">Hello from App.vue</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGlobalStore } from '@/stores/globalStore.ts';

const global = useGlobalStore();

onMounted(async () => {
  await global.init().catch((err: unknown) => console.error('global.init failed', err));
});
</script>

<style>
body {
  margin: 0;
  padding: 0;
}

#my-vue-header {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  top: 2%;
  left: 2%;
  width: 96%;
  min-height: 10%;
  margin: 2%;
  z-index: 9999;
  padding: 10px 0;
  text-align: center;
  border: solid orange 2px;
}

button {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}

button:hover {
  background: #f0f0f0;
}
</style>
