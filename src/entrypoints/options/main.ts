import { initializeApp } from '@/utils/app-init';
import AppOptions from './App.vue';

// Use unified initialization
initializeApp({
  rootComponent: AppOptions,
  mountTarget: '#app',
}).catch((err) => console.error('Failed to initialize options:', err));

