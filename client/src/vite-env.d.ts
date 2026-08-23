/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANDROID_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
