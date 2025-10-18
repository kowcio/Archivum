console.log('qweqweqwe')

qweqweqwe
// Import at top (adjust path)
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppPopup from './AppPopup.vue'
console.log('Popup js ')
const app = createApp(AppPopup)
app.use(createPinia())
app.mount('#app')
