import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'

// SHARED CONSTANTS
const sharedPiniaStoreAcrossTheApps = createPinia()

// APP 1  - POP up app used in "default_popup": "popup.html"

const app = createApp(App)
app.use(sharedPiniaStoreAcrossTheApps)
const el = document.getElementById('myapp')

if (el) {
  app.mount(el)
} else {
  console.error('Error: #myapp element not found')
}

// APP 2 - the same but mounted on the main browser page instead of the popup on extention

// if (!document.getElementById('my-vue-header')) {
//   const headerDiv = document.createElement('div')
//   headerDiv.id = 'my-vue-header'
//   document.body.insertBefore(headerDiv, document.body.firstChild)
// }
const style = document.createElement('style')

if (window.location.href.includes('rozliczenia.estatecare.pl')) {

if (!document.getElementById('my-vue-header')) {
  const headerDiv = document.createElement('div')
  headerDiv.id = 'my-vue-header'
  document.body.insertBefore(headerDiv, document.body.firstChild)
}

  style.textContent = `
  #my-vue-header {
    top: 2%; left: 2%; width: 96%; min-height:10%;
    margin: 2%;
    z-index: 9999;
    padding: 10px 0; text-align: center;
    border: solid orange 2px;
  }
`
}
document.head.appendChild(style)
app.mount('#my-vue-header')
