/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
  readonly VITE_CREATOR_PHONE: string
  readonly VITE_CREATOR_PHONE_DISPLAY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
