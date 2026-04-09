// Wrapper fetch che aggiunge automaticamente il Bearer token

function getToken() {
  return localStorage.getItem('token')
}

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

export async function apiGet(path) {
  return fetch(`/api${path}`, { headers: authHeaders() })
}

export async function apiPost(path, body) {
  return fetch(`/api${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
}

export async function apiDelete(path) {
  return fetch(`/api${path}`, { method: 'DELETE', headers: authHeaders() })
}
