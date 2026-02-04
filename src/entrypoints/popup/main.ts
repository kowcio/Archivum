import { initializeApp } from '@/utils/app-init';
import AppPopup from './App.vue';

console.log('Popup initializing...');

// Use unified initialization
initializeApp({
  rootComponent: AppPopup,
  mountTarget: '#app',
}).catch((err) => console.error('Failed to initialize popup:', err));

