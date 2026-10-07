import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { app, store } from '../src/app.js'
import { MemoryStore, PostgresStore } from '../src/store.js'
import { rankNearby } from '../src/reading.js'

function route(path, method) {
  const layer = app.router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method])
  return layer.route.stack.at(-1).handle
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('invalid meeting terms do not acquire a PostgreSQL connection', async () => {
  const database = new PostgresStore('postgresql://localhost/review_test')
  let acquired = 0
  database.pool.connect = async () => { acquired += 1; throw new Error('should not connect') }
  await assert.rejects(database.createRequest('reader', { loanDays: 0 }), { status: 400 })
  assert.equal(acquired, 0)
  await database.pool.end()
})

test('preference and training event roll back together on database failure', async () => {
  const database = new PostgresStore('postgresql://localhost/review_test')
  const commands = []
  let released = false
  database.pool.connect = async () => ({
    async query(sql) {
      commands.push(sql)
      if (sql.startsWith('SELECT owner_id')) return { rows: [{ owner_id: 'other', status: 'AVAILABLE' }] }
      if (sql.includes('INSERT INTO swipe_events')) throw new Error('insert failed')
      return { rows: [] }
    },
    release() { released = true },
  })
  await assert.rejects(database.savePreference('reader', 'book', 'LIKE', { subjectMatch: 1, levelMatch: 0, distanceKm: null, source: 'CATALOG' }), /insert failed/)
  assert.equal(commands.at(-1), 'ROLLBACK')
  assert.equal(released, true)
  await database.pool.end()
})

test('catalog preference records an event even without a location', async () => {
  const reader = await store.findUserById('user-natcha')
  const savedLocation = reader.location
  const original = store.users.find((item) => item.id === reader.id)
  original.location = null
  try {
    const res = response()
    let error
    await route('/api/books/:id/preference', 'post')({ user: { ...reader, location: null }, params: { id: 'book-math' }, body: { preference: 'LIKE' } }, res, (value) => { error = value })
    assert.equal(error, undefined)
    assert.equal(res.statusCode, 200)
    const event = store.swipeEvents.at(-1)
    assert.equal(event.source, 'CATALOG')
    assert.equal(event.distanceKm, null)
    assert.equal(event.label, 1)
  } finally { original.location = savedLocation }
})

test('swipe response handles a book reserved before the matching lookup', async () => {
  const originalSave = store.savePreference.bind(store)
  const book = store.books.find((item) => item.id === 'book-biology')
  store.savePreference = async (...args) => {
    const result = await originalSave(...args)
    book.status = 'RESERVED'
    return result
  }
  try {
    const res = response()
    let error
    await route('/api/swipes', 'post')({ user: await store.findUserById('user-natcha'), body: { bookId: book.id, preference: 'LIKE' } }, res, (value) => { error = value })
    assert.equal(error, undefined)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.book, null)
    assert.equal(res.body.unavailable, true)
  } finally { book.status = 'AVAILABLE'; store.savePreference = originalSave }
})

test('bad request fields return 400 and database outage is not reported as an expired session', async () => {
  const invalidRegistration = response()
  await route('/api/auth/register', 'post')({ body: { name: {}, email: 'reader@example.com', password: 'longpassword' } }, invalidRegistration, () => {})
  assert.equal(invalidRegistration.statusCode, 400)

  const duplicateEmail = response()
  await route('/api/auth/register', 'post')({ body: { name: 'Reader', email: ' NATCHA@DEMO.COM ', password: 'longpassword' } }, duplicateEmail, () => {})
  assert.equal(duplicateEmail.statusCode, 409)

  const login = response()
  await route('/api/auth/login', 'post')({ body: { email: ' NATCHA@DEMO.COM ', password: 'demo1234' } }, login, () => {})
  assert.equal(login.statusCode, 200)

  const invalidBook = response()
  await route('/api/books', 'post')({ user: await store.findUserById('user-natcha'), body: { title: {}, category: 'นิยายและวรรณกรรม', condition: 'ดี' } }, invalidBook, () => {})
  assert.equal(invalidBook.statusCode, 400)

  const invalidImage = response()
  await route('/api/books', 'post')({ user: await store.findUserById('user-natcha'), body: { title: 'เล่มใหม่', category: 'นิยายและวรรณกรรม', condition: 'ดี', imageUrl: 'javascript:alert(1)' } }, invalidImage, () => {})
  assert.equal(invalidImage.statusCode, 400)

  const invalidSearch = response()
  await route('/api/books', 'get')({ query: { search: { nested: 'invalid' } } }, invalidSearch, () => {})
  assert.equal(invalidSearch.statusCode, 400)

  const authorization = `Bearer ${jwt.sign({ sub: 'user-natcha' }, 'pun-aan-development-secret')}`
  const originalFind = store.findUserById.bind(store)
  store.findUserById = async () => { throw new Error('database unavailable') }
  try {
    let forwarded
    const res = response()
    const authLayer = app.router.stack.find((entry) => entry.route?.path === '/api/auth/me')
    await authLayer.route.stack[0].handle({ headers: { authorization } }, res, (error) => { forwarded = error })
    assert.equal(forwarded?.message, 'database unavailable')
    assert.equal(res.statusCode, 200)
  } finally { store.findUserById = originalFind }
})

test('one-sided receipt can be undone or closed by both participants', async () => {
  const database = new MemoryStore()
  const input = { offeredBookId: 'book-tgat', requestedBookId: 'book-math', loanDays: 14, meetingPlace: 'ห้องสมุด', meetingAt: new Date(Date.now() + 86400000).toISOString() }
  const request = await database.createRequest('user-natcha', input)
  await database.updateRequestStatus(request.id, 'ACCEPTED', 'user-kanittha')
  await database.updateRequestStatus(request.id, 'RECEIVED', 'user-natcha')
  await database.updateRequestStatus(request.id, 'UNDO_RECEIVED', 'user-natcha')
  assert.deepEqual((await database.findRequestById(request.id)).receivedBy, [])
  await database.updateRequestStatus(request.id, 'RECEIVED', 'user-natcha')
  await database.updateRequestStatus(request.id, 'CANCEL_REQUESTED', 'user-natcha')
  await assert.rejects(database.updateRequestStatus(request.id, 'RECEIVED', 'user-kanittha'), { status: 403 })
  await database.updateRequestStatus(request.id, 'CANCEL_REQUESTED', 'user-kanittha')
  assert.equal((await database.findRequestById(request.id)).status, 'CANCELLED')
  assert.equal((await database.findBookById('book-tgat')).status, 'AVAILABLE')
  assert.equal((await database.findBookById('book-math')).status, 'AVAILABLE')
})

test('a stalled exchange can be reported and resolved only after an admin review', async () => {
  const database = new MemoryStore()
  const input = { offeredBookId: 'book-tgat', requestedBookId: 'book-math', loanDays: 14, meetingPlace: 'ห้องสมุด', meetingAt: new Date(Date.now() + 86400000).toISOString() }
  const request = await database.createRequest('user-natcha', input)
  await database.updateRequestStatus(request.id, 'ACCEPTED', 'user-kanittha')
  await database.updateRequestStatus(request.id, 'RECEIVED', 'user-natcha')
  await assert.rejects(database.reportIssue(request.id, 'outsider', 'ไม่ได้รับหนังสืออีกเล่ม'), { status: 403 })
  await database.reportIssue(request.id, 'user-natcha', 'อีกฝ่ายยังไม่ได้รับหนังสือ')
  assert.equal((await database.listOpenIssues()).length, 1)
  await database.resolveIssue(request.id, 'trusted-admin', 'CANCELLED', 'ตรวจสอบแล้วหนังสือกลับถึงเจ้าของทั้งสองเล่ม')
  assert.equal((await database.listOpenIssues()).length, 0)
  assert.equal((await database.findRequestById(request.id)).issueResolution.by, 'trusted-admin')
  assert.equal((await database.findBookById('book-math')).status, 'AVAILABLE')

  const originalAdminIds = process.env.ADMIN_USER_IDS
  try {
    delete process.env.ADMIN_USER_IDS
    const res = response()
    const layer = app.router.stack.find((entry) => entry.route?.path === '/api/admin/exchange-requests/issues' && entry.route.methods.get)
    layer.route.stack.at(-2).handle({ user: { id: 'user-natcha' } }, res, () => {})
    assert.equal(res.statusCode, 403)
  } finally {
    if (originalAdminIds === undefined) delete process.env.ADMIN_USER_IDS
    else process.env.ADMIN_USER_IDS = originalAdminIds
  }
})

test('nearby fallback keeps a matching category ahead of an unrelated closer book', async () => {
  const books = [
    { id: 'near', category: 'อื่น ๆ', distanceKm: 0.5, reasons: [] },
    { id: 'match', category: 'นิยายและวรรณกรรม', distanceKm: 2, reasons: ['ตรงหมวดนิยายและวรรณกรรมที่สนใจ'] },
  ]
  const result = await rankNearby({ interests: ['นิยายและวรรณกรรม'], educationLevel: 'ทั่วไป' }, books, [], async () => { throw new Error('offline') })
  assert.deepEqual(result.books.map((book) => book.id), ['match', 'near'])
})
