import { initializeApp } from '@/utils/app-init';
import AppOptions from './App.vue';

console.debug('[EXT-DBG] options initializing - TOKEN:EXT_DBG_OPTIONS_v1');

// Use unified initialization
initializeApp({
  rootComponent: AppOptions,
  mountTarget: '#app',
}).catch((err) => console.error('Failed to initialize options:', err));
