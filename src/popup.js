// Import at top (adjust path)
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppPopup from '@/AppPopup.vue' // fix import path as needed

console.log('Vue app mounted')
const app = createApp(AppPopup)
app.use(createPinia())
app.mount('#app') // mounts on #app in popup.html

console.log('Vue app mounted2')
