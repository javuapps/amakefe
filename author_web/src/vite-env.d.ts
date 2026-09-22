/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
  readonly VITE_PUBLIC_SITE_URL?: string
  /** Meta app id. The secret stays server-side as an Edge Function secret. */
  readonly VITE_META_AUTHOR_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
