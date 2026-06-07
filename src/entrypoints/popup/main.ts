import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@/assets/global.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppPopup from './App.vue';

console.debug('[EXT-DBG] popup initializing - TOKEN:EXT_DBG_POPUP_v1');

// Non-blocking UI initialization
AppBootstrapper.initUI({
  rootComponent: AppPopup,
  mountTarget: '#app',
});

console.debug('[EXT-DBG] popup mounting in background');
