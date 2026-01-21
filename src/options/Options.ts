import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Options from './Options.vue'

const app = createApp(Options)
const pinia = createPinia()
app.use(pinia)
app.mount('#options')
