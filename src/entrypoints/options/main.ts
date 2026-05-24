import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppOptions from './App.vue';

console.debug('[EXT-DBG] options initializing - TOKEN:EXT_DBG_OPTIONS_v1');

// Initialize UI with centralized bootstrapper
AppBootstrapper.initUI({
  rootComponent: AppOptions,
  mountTarget: '#app',
}).catch((err: unknown) => console.error('Failed to initialize options:', err));
