import type { CreatorContact } from '@amakefe/core'

export const creator: CreatorContact = {
  phone: import.meta.env.VITE_CREATOR_PHONE,
  phoneDisplay: import.meta.env.VITE_CREATOR_PHONE_DISPLAY,
}
