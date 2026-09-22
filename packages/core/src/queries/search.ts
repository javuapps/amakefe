/**
 * PostgREST `ilike` treats `%`, `_` and `\` as syntax. Someone typing them means
 * them, so they are escaped before they reach a pattern.
 *
 * Shared rather than copied: the studio searches stories and the reader searches
 * answered questions, and two versions of this would be one version and a bug.
 */
export const escapeLike = (value: string): string =>
  value.replace(/[%_\\]/g, (char) => '\\' + char)
