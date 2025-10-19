console.log('[DEBUG] Content script starting to load...');

import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
console.log('Content js loaded on ', window.location.href, ' shouldBeMounted=', shouldBeMounted)

// const shouldBeMounted = window.location.href.includes('9gag')
const shouldBeMounted = window.location.href.includes('estate')
console.log('[DEBUG] Content script imports completed')
console.log('[DEBUG] Current URL:', window.location.href)
console.log('[DEBUG] Should be mounted:', shouldBeMounted)

if (true) {
  console.log('This should be mounted ')

  if (!document.getElementById('my-vue-header')) {
    const headerDiv = document.createElement('div')
    headerDiv.id = 'my-vue-header'
    document.body.insertBefore(headerDiv, document.body.firstChild)
  }
  const style = document.createElement('style')

  if (!document.getElementById('my-vue-header')) {
    const headerDiv = document.createElement('div')
    headerDiv.id = 'my-vue-header'
    document.body.insertBefore(headerDiv, document.body.firstChild)
  }
  console.log('Style for ')
  style.textContent = `
  #my-vue-header {
    top: 2%; left: 2%; width: 96%; min-height:10%;
    margin: 2%;
    z-index: 9999;
    padding: 10px 0; text-align: center;
    border: solid orange 2px;
  }
`
  document.head.appendChild(style)

  const app = createApp(App)
  app.use(createPinia())
  app.mount('#my-vue-header')
} else {
  console.log('This should NOT be mounted ')
}
