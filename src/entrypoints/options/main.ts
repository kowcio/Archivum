import 'quasar/dist/quasar.css';
import '@/assets/global.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import AppOptions from './App.vue';

AppBootstrapper.initUI({
  rootComponent: AppOptions,
  mountTarget: '#app',
});
