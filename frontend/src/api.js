export async function apiFetch(input, init = {}) {
  const token = localStorage.getItem('aegis_access_token')
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(input, { ...init, headers })
  if (response.status === 401) {
    localStorage.removeItem('aegis_access_token')
    window.dispatchEvent(new Event('auth-expired'))
  }
  return response
}

export async function readJson(response) {
  const body = await response.text()
  if (!body.trim()) return null

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Server returned an invalid response (${response.status})`)
  }
}