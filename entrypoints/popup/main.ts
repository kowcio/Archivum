import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AppPopup from './App.vue';
import { useGlobalStore } from '@/shared/stores/globalStore.ts';

console.log('Popup initializing...');

const app = createApp(AppPopup);
const pinia = createPinia();
app.use(pinia);

// Initialize global store so popup reacts to changes from other contexts
const global = useGlobalStore();
global.init().catch((err) => console.error('global.init failed', err));

app.mount('#app');
