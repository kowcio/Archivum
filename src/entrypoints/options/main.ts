import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@/assets/global.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppOptions from './App.vue';

console.debug('[EXT-DBG] options initializing - TOKEN:EXT_DBG_OPTIONS_v1');

// Non-blocking UI initialization
AppBootstrapper.initUI({
  rootComponent: AppOptions,
  mountTarget: '#app',
});

console.debug('[EXT-DBG] options mounting in background');
