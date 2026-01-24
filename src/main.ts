import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(Quasar)

// Initialize global store (useful when running the full app)
import { useGlobalStore } from '@/shared/stores/globalStore'
const global = useGlobalStore()
global.init().catch((err) => console.error('global.init failed', err))

app.mount('#app')
