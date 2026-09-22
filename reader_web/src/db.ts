import { createDb } from '@amakefe/core'

export const db = createDb(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)
