(function(){
  'use strict'
  const $ = (sel) => document.querySelector(sel)
  const status = $('#status')
  const username = $('#opt-username')
  const enabled = $('#opt-enabled')
  const saveBtn = $('#save')

  function storageGet() {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local.get(null)
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((res) => chrome.storage.local.get(null, res))
    }
    // fallback to localStorage
    return Promise.resolve(JSON.parse(localStorage.getItem('extension-settings') || '{}'))
  }

  function storageSet(obj) {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local.set(obj)
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((res) => chrome.storage.local.set(obj, res))
    }
    localStorage.setItem('extension-settings', JSON.stringify(obj))
    return Promise.resolve()
  }

  async function restoreOptions() {
    try {
      const data = await storageGet()
      username.value = data.username || ''
      enabled.checked = !!data.enabled
    } catch (e) {
      console.error('restore', e)
    }
  }

  async function saveOptions() {
    const obj = { username: username.value.trim(), enabled: enabled.checked }
    try {
      await storageSet(obj)
      status.textContent = 'Options saved.'
      setTimeout(()=> status.textContent = '', 2000)
    } catch (e) {
      console.error('save', e)
      status.textContent = 'Failed to save options'
    }
  }

  saveBtn.addEventListener('click', saveOptions)
  document.addEventListener('DOMContentLoaded', restoreOptions)
})()
