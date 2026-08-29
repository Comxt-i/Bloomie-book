import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

async function request(path, options = {}) {
  const server = app.listen(0)
  const address = server.address()
  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, options)
  } finally {
    server.close()
  }
}

test('health endpoint reports demo storage', async () => {
  const response = await request('/api/health')
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.storage, 'demo')
})

test('demo user can login and get recommendations', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'natcha@demo.com', password: 'demo1234' }),
  })
  assert.equal(login.status, 200)
  const { token } = await login.json()
  const recommendations = await request('/api/recommendations', {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(recommendations.status, 200)
  const body = await recommendations.json()
  assert.ok(body.books.length >= 1)
})

test('two demo users can complete an exchange request', async () => {
  const natchaLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'natcha@demo.com', password: 'demo1234' }),
  })
  const { token: natchaToken } = await natchaLogin.json()

  const created = await request('/api/exchange-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${natchaToken}` },
    body: JSON.stringify({
      offeredBookId: 'book-tgat',
      requestedBookId: 'book-math',
      message: 'สะดวกแลกที่ห้องสมุด',
    }),
  })
  assert.equal(created.status, 201)
  const { request: exchangeRequest } = await created.json()

  const kanitthaLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'kanittha@demo.com', password: 'demo1234' }),
  })
  const { token: kanitthaToken } = await kanitthaLogin.json()
  const accepted = await request(`/api/exchange-requests/${exchangeRequest.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${kanitthaToken}` },
    body: JSON.stringify({ status: 'ACCEPTED' }),
  })
  assert.equal(accepted.status, 200)
  assert.equal((await accepted.json()).request.status, 'ACCEPTED')

  const completed = await request(`/api/exchange-requests/${exchangeRequest.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${natchaToken}` },
    body: JSON.stringify({ status: 'COMPLETED' }),
  })
  assert.equal(completed.status, 200)
  assert.equal((await completed.json()).request.status, 'COMPLETED')
})
