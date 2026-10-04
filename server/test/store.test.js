import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore } from '../src/store.js'
import { BOOK_CATEGORIES } from '../src/categories.js'
const terms=()=>({loanDays:14,meetingPlace:'Demo library',meetingAt:new Date(Date.now()+86400000).toISOString()})

async function competingRequests() {
  const store = new MemoryStore()
  const first = await store.createRequest('user-natcha', { ...terms(), offeredBookId: 'book-tgat', requestedBookId: 'book-math' })
  const second = await store.createRequest('user-natcha', { ...terms(), offeredBookId: 'book-tgat', requestedBookId: 'book-biology' })
  return { store, first, second }
}

test('accepting a request cancels competing offers and does not reserve their other books', async () => {
  const { store, first, second } = await competingRequests()
  await store.updateRequestStatus(first.id, 'ACCEPTED', 'user-kanittha')
  assert.equal((await store.findRequestById(second.id)).status, 'CANCELLED')
  assert.equal((await store.findBookById('book-tgat')).status, 'RESERVED')
  assert.equal((await store.findBookById('book-biology')).status, 'AVAILABLE')
  await assert.rejects(store.updateRequestStatus(second.id, 'REJECTED', 'user-kanittha'), { status: 403 })
  assert.equal((await store.findBookById('book-tgat')).status, 'RESERVED')
})

test('only one competing request can be accepted', async () => {
  const { store, first, second } = await competingRequests()
  const outcomes = await Promise.allSettled([store.updateRequestStatus(first.id, 'ACCEPTED', 'user-kanittha'), store.updateRequestStatus(second.id, 'ACCEPTED', 'user-kanittha')])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
})

test('cancelling accepted request releases both books and keeps competing request closed', async () => {
  const { store, first, second } = await competingRequests()
  await store.updateRequestStatus(first.id, 'ACCEPTED', 'user-kanittha')
  await store.updateRequestStatus(first.id, 'CANCELLED', 'user-natcha')
  assert.equal((await store.findBookById('book-tgat')).status, 'AVAILABLE')
  assert.equal((await store.findBookById('book-math')).status, 'AVAILABLE')
  assert.equal((await store.findRequestById(second.id)).status, 'CANCELLED')
})

test('both parties must confirm receiving and returning before books become available', async () => {
  const { store, first } = await competingRequests()
  await store.updateRequestStatus(first.id, 'ACCEPTED', 'user-kanittha')
  await assert.rejects(store.updateRequestStatus(first.id, 'COMPLETED', 'user-natcha'), { status: 403 })
  await store.updateRequestStatus(first.id, 'RECEIVED', 'user-natcha')
  assert.equal((await store.findRequestById(first.id)).status, 'ACCEPTED')
  await assert.rejects(store.updateRequestStatus(first.id, 'CANCELLED', 'user-natcha'), { status: 403 })
  await assert.rejects(store.updateRequestStatus(first.id, 'RECEIVED', 'user-natcha'), { status: 403 })
  await store.updateRequestStatus(first.id, 'RECEIVED', 'user-kanittha')
  assert.equal((await store.findBookById('book-tgat')).status, 'ON_LOAN')
  assert.ok((await store.findRequestById(first.id)).dueAt)
  await store.updateRequestStatus(first.id, 'RETURNED', 'user-natcha')
  assert.equal((await store.findBookById('book-tgat')).status, 'ON_LOAN')
  await store.updateRequestStatus(first.id, 'RETURNED', 'user-kanittha')
  assert.equal((await store.findRequestById(first.id)).status, 'COMPLETED')
  assert.equal((await store.findBookById('book-tgat')).status, 'AVAILABLE')
  assert.equal((await store.findBookById('book-tgat')).ownerId, 'user-natcha')
  await assert.rejects(store.updateRequestStatus(first.id, 'RETURNED', 'user-kanittha'), { status: 403 })
})

test('requester cannot accept their own request and outsiders cannot update it', async () => {
  const { store, first } = await competingRequests()
  await assert.rejects(store.updateRequestStatus(first.id, 'ACCEPTED', 'user-natcha'), { status: 403 })
  await assert.rejects(store.updateRequestStatus(first.id, 'CANCELLED', 'unrelated'), { status: 403 })
  assert.equal((await store.findRequestById(first.id)).status, 'PENDING')
})

test('duplicate simultaneous requests are rejected', async () => {
  const store = new MemoryStore()
  const input = { ...terms(), offeredBookId: 'book-tgat', requestedBookId: 'book-math' }
  const outcomes = await Promise.allSettled([store.createRequest('user-natcha', input), store.createRequest('user-natcha', input)])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
})

test('public books expose only the display identity of their owner', async () => {
  const store = new MemoryStore()
  const books = await store.listBooks()
  assert.deepEqual(Object.keys(books[0].owner).sort(), ['id', 'name'])
})

test('broad categories include existing school books without losing their subject', async () => {
  const store = new MemoryStore()
  const studyBooks = await store.listBooks({ category: 'การเรียนและสอบ' })
  assert.equal(studyBooks.length, 3)
  assert.equal(studyBooks.find((book) => book.id === 'book-math').subject, 'คณิตศาสตร์')
  const fiction = await store.createBook('user-natcha', {
    title: 'เรื่องเล่าจากทะเล', subject: 'นิยายและวรรณกรรม', category: 'นิยายและวรรณกรรม',
    educationLevel: 'ทั่วไป', condition: 'ดี', description: '', imageUrl: '',
  })
  assert.equal(fiction.category, 'นิยายและวรรณกรรม')
  assert.ok((await store.listBooks({ category: 'นิยายและวรรณกรรม' })).some((book) => book.id === fiction.id))
  assert.equal(BOOK_CATEGORIES.length, 7)
})
