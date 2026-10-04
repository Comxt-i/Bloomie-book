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
  assert.ok(['content-knn', 'knn-classifier', 'decision-tree', 'logistic-regression', 'interest-distance-fallback'].includes(body.engine))
  assert.ok(body.books.every((book) => book.reasons.length > 0))
})

test('reader can register without a school level and list a book by broad category', async () => {
  const registration = await request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Reader', email: 'reader@demo.com', password: 'demo1234', interests: ['นิยายและวรรณกรรม'] }),
  })
  assert.equal(registration.status, 201)
  const { token, user } = await registration.json()
  assert.equal(user.educationLevel, 'ทั่วไป')

  const created = await request('/api/books', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'เรื่องเล่าจากทะเล', category: 'นิยายและวรรณกรรม', condition: 'ดีมาก' }),
  })
  assert.equal(created.status, 201)
  const { book } = await created.json()
  assert.equal(book.category, 'นิยายและวรรณกรรม')

  const filtered = await request(`/api/books?category=${encodeURIComponent('นิยายและวรรณกรรม')}`)
  assert.equal(filtered.status, 200)
  assert.ok((await filtered.json()).books.some((item) => item.id === book.id))

  const rejected = await request('/api/books', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'หมวดผิด', category: 'หมวดที่ไม่มี', condition: 'ดี' }),
  })
  assert.equal(rejected.status, 400)
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
      loanDays:14,meetingPlace:'ห้องสมุด',meetingAt:new Date(Date.now()+86400000).toISOString(),
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

  for (const status of ['RECEIVED','RETURNED']) {
    for (const token of [natchaToken,kanitthaToken]) {
      const updated=await request(`/api/exchange-requests/${exchangeRequest.id}/status`, {
        method:'PATCH', headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({status})
      })
      assert.equal(updated.status,200)
      if(status==='RETURNED' && token===kanitthaToken) assert.equal((await updated.json()).request.status,'COMPLETED')
    }
  }
})
