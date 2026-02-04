<template>
  <div id="options">
    <h1>Extension Options (Vue)</h1>
    <div>
      <label>
        Username
        <input v-model="username" type="text" />
      </label>
    </div>
    <div>
      <label>
        <input v-model="enabled" type="checkbox" /> Enable feature
      </label>
    </div>
    <div style="margin-top:12px">
      <button @click="save">Save</button>
      <span style="margin-left:12px;color:green" v-if="saved">Saved</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGlobalStore } from '@/shared/stores/globalStore';

const global = useGlobalStore();
const username = ref('');
const enabled = ref(false);
const saved = ref(false);

onMounted(async () => {
  await global.init();
  username.value = global.flags.username ?? '';
  enabled.value = !!global.flags.enabled;
});

async function save() {
  global.flags = { ...global.flags, username: username.value, enabled: enabled.value };
  await global.save();
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
</script>

<style scoped>
input[type='text'] {
  width: 320px;
  padding: 6px;
}
label {
  display: block;
  margin: 8px 0;
}
</style>
