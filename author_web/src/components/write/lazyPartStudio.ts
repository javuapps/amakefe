import { lazy } from 'react'

/**
 * One lazy reference, shared by the screens that can open the studio.
 *
 * Declaring `lazy()` in each of them would give each its own chunk of TipTap —
 * about 135KB gzip apiece — and the second screen would download it again.
 */
export const PartStudio = lazy(async () => ({
  default: (await import('./PartStudio')).PartStudio,
}))
