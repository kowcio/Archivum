import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AppOptions from './App.vue';
import { useGlobalStore } from '../../src/shared/stores/globalStore';

const app = createApp(AppOptions);
const pinia = createPinia();
app.use(pinia);

// Initialize global store (loads from storage and sets up sync)
const global = useGlobalStore();
global.init().catch((err) => console.error('global.init failed', err));

app.mount('#app');
