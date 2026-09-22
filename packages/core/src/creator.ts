/**
 * How the community reaches the creator.
 *
 * Spec §14: Share Your Story is not a submission form. It opens a phone call or
 * WhatsApp, because the conversation is the part of this product that must stay
 * human. These are build-time values — her number changes about never, and a
 * table would be a schema for one row.
 */
export type CreatorContact = {
  /** E.164, for tel: and wa.me links. */
  phone: string
  /** What the reader sees. */
  phoneDisplay: string
}

export const waLink = (contact: CreatorContact, message: string): string =>
  `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`

export const telLink = (contact: CreatorContact): string => `tel:${contact.phone}`
