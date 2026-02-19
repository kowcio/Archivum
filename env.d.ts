/// <reference types="vite/client" />

import '@vue/runtime-core'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    __VERSION__: string
  }
}

declare global {
  const __VERSION__: string;
}

export {};
