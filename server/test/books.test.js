import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app, store } from '../src/app.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64')

test('owners can edit books and upload, replace, and remove a durable cover', async () => {
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/api`
    const request = (path, options) => fetch(`${base}${path}`, options)
    const login = async (email) => {
      const response = await request('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })
      assert.equal(response.status, 200)
      return (await response.json()).token
    }
    const owner = await login('natcha@demo.com')
    const other = await login('kanittha@demo.com')
    const auth = (token, type = 'application/json') => ({ authorization: `Bearer ${token}`, 'content-type': type })
    const created = await request('/books', { method: 'POST', headers: auth(owner), body: JSON.stringify({ title: 'ปกทดสอบ', category: 'นิยายและวรรณกรรม', condition: 'ดี' }) })
    assert.equal(created.status, 201)
    const { book } = await created.json()
    const path = `/books/${book.id}`

    const forbidden = await request(path, { method: 'PATCH', headers: auth(other), body: JSON.stringify({ title: 'แอบแก้', category: book.category, condition: 'ดี' }) })
    assert.equal(forbidden.status, 403)
    const updated = await request(path, { method: 'PATCH', headers: auth(owner), body: JSON.stringify({ title: 'ปกใหม่', category: 'การ์ตูนและมังงะ', condition: 'เหมือนใหม่', description: 'แก้ไขแล้ว' }) })
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).book.category, 'การ์ตูนและมังงะ')

    const deniedImage = await request(`${path}/image`, { method: 'PUT', headers: auth(other, 'image/png'), body: png })
    assert.equal(deniedImage.status, 403)
    assert.equal((await request(`${path}/image`, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: png })).status, 401)
    assert.equal((await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/svg+xml'), body: '<svg />' })).status, 415)
    const wrongType = await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/jpeg'), body: png })
    assert.equal(wrongType.status, 415)
    const tooLarge = await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/png'), body: Buffer.alloc(2 * 1024 * 1024 + 1) })
    assert.equal(tooLarge.status, 413)
    const uploaded = await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/png'), body: png })
    assert.equal(uploaded.status, 200)
    assert.equal((await uploaded.json()).book.imageUrl, `/api${path}/image`)
    assert.equal((await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/png'), body: png })).status, 200)
    const image = await request(`${path}/image`)
    assert.equal(image.status, 200)
    assert.match(image.headers.get('content-type'), /^image\/png/)
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)

    const removed = await request(`${path}/image`, { method: 'DELETE', headers: { authorization: `Bearer ${owner}` } })
    assert.equal(removed.status, 200)
    assert.equal((await removed.json()).book.imageUrl, '')
    assert.equal((await request(`${path}/image`)).status, 404)

    const stored = store.books.find((item) => item.id === book.id)
    stored.status = 'RESERVED'
    const locked = await request(path, { method: 'PATCH', headers: auth(owner), body: JSON.stringify({ title: 'ห้ามแก้', category: 'นิยายและวรรณกรรม', condition: 'ดี' }) })
    assert.equal(locked.status, 409)
    assert.equal((await request(`${path}/image`, { method: 'PUT', headers: auth(owner, 'image/png'), body: png })).status, 409)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
