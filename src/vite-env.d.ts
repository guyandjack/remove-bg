/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_DEV_URL: string;
  readonly VITE_API_DEV_URL: string;
  readonly VITE_BASE_PROD_URL: string;
  readonly VITE_API_PROD_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

