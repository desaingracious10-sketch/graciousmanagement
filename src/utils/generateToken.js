export function generatePortalToken(customerId = '') {
  const raw = String(customerId) + Date.now() + Math.random().toString(36)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36) + Date.now().toString(36)
}
