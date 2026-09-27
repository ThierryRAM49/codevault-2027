export const CONTACT_EMAIL = 'riad-design@gmx.com'

export function buildMailto(subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body })
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`
}
