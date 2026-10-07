import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'
import { MemoryStore, PostgresStore } from '../src/store.js'

function handlers(path, method = 'get') {
  const layer = app.router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method])
  return layer.route.stack.map((item) => item.handle)
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

test('admin session flag is derived from server config, not user input', () => {
  const original = process.env.ADMIN_USER_IDS
  try {
    process.env.ADMIN_USER_IDS = 'user-natcha'
    const me = handlers('/api/auth/me').at(-1)
    const admin = response()
    me({ user: { id: 'user-natcha', name: 'Natcha' } }, admin)
    assert.equal(admin.body.user.isAdmin, true)
    const reader = response()
    me({ user: { id: 'user-kanittha', name: 'Kanittha', isAdmin: true } }, reader)
    assert.equal(reader.body.user.isAdmin, false)
  } finally {
    if (original === undefined) delete process.env.ADMIN_USER_IDS
    else process.env.ADMIN_USER_IDS = original
  }
})

test('all admin routes reject a signed-in non-admin', () => {
  const original = process.env.ADMIN_USER_IDS
  try {
    process.env.ADMIN_USER_IDS = 'user-natcha'
    for (const [path, method] of [
      ['/api/admin/overview', 'get'], ['/api/admin/users', 'get'], ['/api/admin/books', 'get'],
      ['/api/admin/exchange-requests/issues', 'get'], ['/api/admin/exchange-requests/:id/resolve', 'patch'],
    ]) {
      const guard = handlers(path, method).at(-2)
      const denied = response()
      guard({ user: { id: 'user-kanittha' } }, denied, () => assert.fail('non-admin passed'))
      assert.equal(denied.statusCode, 403, path)
      let passed = false
      guard({ user: { id: 'user-natcha' } }, response(), () => { passed = true })
      assert.equal(passed, true, path)
    }
  } finally {
    if (original === undefined) delete process.env.ADMIN_USER_IDS
    else process.env.ADMIN_USER_IDS = original
  }
})

test('admin directory is searchable and never exposes password hashes or locations', async () => {
  const database = new MemoryStore()
  const users = await database.adminUsers({ search: 'NATCHA', page: 1, pageSize: 20 })
  assert.equal(users.total, 1)
  assert.equal(users.users[0].email, 'natcha@demo.com')
  assert.equal(users.users[0].bookCount, 3)
  assert.equal('passwordHash' in users.users[0], false)
  assert.equal('location' in users.users[0], false)
  const books = await database.adminBooks({ search: 'การ์ตูน', page: 1, pageSize: 20 })
  assert.equal(books.total, 1)
  assert.equal(books.books[0].owner.email, 'kanittha@demo.com')
  assert.equal((await database.adminUsers({ search: '', page: 2, pageSize: 1 })).users.length, 1)
  const overview = await database.adminOverview()
  assert.deepEqual({ users: overview.users, books: overview.books, openIssues: overview.openIssues }, { users: 2, books: 6, openIssues: 0 })
})

test('admin can see both open and resolved issue history', async () => {
  const database = new MemoryStore()
  const request = await database.createRequest('user-natcha', { offeredBookId: 'book-tgat', requestedBookId: 'book-math', loanDays: 14, meetingPlace: 'ห้องสมุด', meetingAt: new Date(Date.now() + 86400000).toISOString() })
  await database.updateRequestStatus(request.id, 'ACCEPTED', 'user-kanittha')
  await database.reportIssue(request.id, 'user-natcha', 'ยังไม่ได้รับหนังสือ')
  assert.equal((await database.adminOverview()).openIssues, 1)
  assert.equal((await database.listAdminIssues('open')).length, 1)
  await database.resolveIssue(request.id, 'user-natcha', 'CANCELLED', 'ตรวจสอบแล้วคืนหนังสือครบทั้งสองฝ่าย')
  assert.equal((await database.listAdminIssues('open')).length, 0)
  assert.equal((await database.listAdminIssues('resolved'))[0].issueResolution.by, 'user-natcha')
})

test('PostgreSQL directory queries parameterize search and page', async () => {
  const database = new PostgresStore('postgresql://localhost/review_test')
  const calls = []
  database.pool.query = async (sql, values) => {
    calls.push({ sql, values })
    return sql.includes('COUNT(*)::int AS total') ? { rows: [{ total: 0 }] } : { rows: [] }
  }
  const result = await database.adminUsers({ search: "%' OR TRUE --", page: 2, pageSize: 20 })
  assert.equal(result.total, 0)
  assert.deepEqual(calls[1].values, ["%%' OR TRUE --%", 20, 20])
  assert.equal(calls[1].sql.includes("' OR TRUE"), false)
  await database.pool.end()
})
