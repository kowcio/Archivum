import 'quasar/dist/quasar.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@/assets/global.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppPopup from './App.vue';

AppBootstrapper.initUI({
  rootComponent: AppPopup,
  mountTarget: '#app',
});
