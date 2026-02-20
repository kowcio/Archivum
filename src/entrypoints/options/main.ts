import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import { initializeApp } from '@/utils/app-init';
import AppOptions from './App.vue';

console.debug('[EXT-DBG] options initializing - TOKEN:EXT_DBG_OPTIONS_v1');

// Use unified initialization
initializeApp({
  rootComponent: AppOptions,
  mountTarget: '#app',
}).catch((err: unknown) => console.error('Failed to initialize options:', err));
