/// <reference types="vite/client" />
/// <reference types="chrome" />

// Custom env variables - Vite doesn't provide types for custom VITE_* variables
declare global {
  interface ImportMeta {
    env: ImportMetaEnv
  }
}

interface ImportMetaEnv {
  readonly VITE_DEV_FEATURES?: string
}

