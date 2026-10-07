const TOKEN_KEY = 'bloomie-book-token'
const LEGACY_TOKEN_KEY = 'pun-aan-token'

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
  if (token && !localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, token)
  return token
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export async function api(path, options = {}) {
  const token = getToken()
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.message || 'ไม่สามารถติดต่อระบบได้')
    error.status = response.status
    throw error
  }
  return body
}
