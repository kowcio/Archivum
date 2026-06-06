<template>
  <div id="my-vue-header" data-testid="content-root">
    <div data-testid="debug">Hello from App.vue</div>
  </div>
</template>

<script setup lang="ts">
// AppBootstrapper (called in main.ts) already runs global.init() and registers
// appStoreSyncPlugin — no manual store setup needed here.
</script>

<style>
body {
  margin: 0;
  padding: 0;
}

#my-vue-header {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  width: 96%;
  min-height: 10%;
  margin: 2%;
  z-index: 9999;
  padding: 10px 0;
  text-align: center;
  border: solid green 2px;
}

button {
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 4px;
}

</style>


