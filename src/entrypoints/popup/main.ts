import { initializeApp } from '@/utils/app-init';
import AppPopup from './App.vue';

console.debug('[EXT-DBG] popup initializing - TOKEN:EXT_DBG_POPUP_v1');

// Use unified initialization
initializeApp({
  rootComponent: AppPopup,
  mountTarget: '#app',
}).catch((err: unknown) => console.error('Failed to initialize popup:', err));
