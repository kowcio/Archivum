import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@/assets/global.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppPopup from './App.vue';

console.debug('[EXT-DBG] popup initializing - TOKEN:EXT_DBG_POPUP_v1');

// Initialize UI with centralized bootstrapper
AppBootstrapper.initUI({
  rootComponent: AppPopup,
  mountTarget: '#app',
}).catch((err: unknown) => console.error('Failed to initialize popup:', err));
