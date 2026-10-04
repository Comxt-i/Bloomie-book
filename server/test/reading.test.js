import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLocation, distanceKm, nearbyBooks, loanTerms, rankRecommendations } from '../src/reading.js'
import { MemoryStore } from '../src/store.js'

test('location is validated, rounded and removable',()=>{
  assert.deepEqual(normalizeLocation({latitude:7.012345,longitude:100.49872}),{latitude:7.01,longitude:100.5})
  assert.equal(normalizeLocation(null),null)
  for(const location of [{latitude:91,longitude:0},{latitude:'7',longitude:100},{latitude:0,longitude:Infinity}])assert.throws(()=>normalizeLocation(location),{status:400})
})
test('distance is geodesic and supports nearby radius filtering',async()=>{
  assert.equal(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0)
  assert.ok(Math.abs(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:1})-111.195)<.01)
  const store=new MemoryStore();const context=await store.discoveryContext('user-natcha')
  assert.equal(nearbyBooks(context,1).length,0)
  assert.equal(nearbyBooks(context,5).length,3)
  assert.equal(nearbyBooks({...context,user:{...context.user,location:null}},5).length,0)
  const book=nearbyBooks(context,5)[0]
  assert.deepEqual(Object.keys(book.owner).sort(),['id','name'])
  assert.equal('location' in book,false)
})
test('catalog recommendations use content ML and explain matched reading history', async () => {
  const user = { interests: ['นิยายและวรรณกรรม'], educationLevel: 'ทั่วไป' }
  const books = [
    { id: 'fiction', title: 'นิยายอีกเล่ม', category: 'นิยายและวรรณกรรม', reasons: ['ตรงกับหมวดนิยายและวรรณกรรมที่คุณสนใจ'], score: 5 },
    { id: 'comic', title: 'การ์ตูน', category: 'การ์ตูนและมังงะ', reasons: ['หนังสือพร้อมแลก'], score: 1 },
  ]
  let sent
  const request = async (_url, options) => {
    sent = JSON.parse(options.body)
    return { ok: true, json: async () => ({ engine: 'content-knn', ranking: [{ id: 'comic', score: 0.9 }, { id: 'fiction', score: 0.5 }] }) }
  }
  const ranked = await rankRecommendations(user, books, [{ category: 'นิยายและวรรณกรรม', title: 'นิยายที่ชอบ' }], request)
  assert.equal(sent.useClassifier, false)
  assert.equal(ranked.engine, 'content-knn')
  assert.equal(ranked.syntheticDemo, false)
  assert.deepEqual(ranked.books.map((book) => book.id), ['comic', 'fiction'])
  assert.ok(ranked.books[1].reasons.includes('หมวดเดียวกับเล่มที่คุณเคยสนใจ'))
  assert.deepEqual(ranked.books[0].reasons, ['หนังสือพร้อมแลก'])
})
test('catalog recommendations keep the original scoring order if ML is unavailable', async () => {
  const books = [
    { id: 'low', category: 'อื่น ๆ', score: 1, reasons: ['หนังสือพร้อมแลก'] },
    { id: 'high', category: 'การเรียนและสอบ', score: 5, reasons: ['ตรงกับหมวดการเรียนและสอบที่คุณสนใจ'] },
  ]
  const ranked = await rankRecommendations({ interests: ['การเรียนและสอบ'] }, books, [], async () => { throw new Error('offline') })
  assert.equal(ranked.engine, 'interest-distance-fallback')
  assert.deepEqual(ranked.books.map((book) => book.id), ['high', 'low'])
})
test('one-sided like is not a mutual match; both likes produce matching offer ids',async()=>{
  const store=new MemoryStore()
  await store.setPreference('user-natcha','book-math','LIKE')
  let books=nearbyBooks(await store.discoveryContext('user-natcha'),5,true)
  assert.deepEqual(books.find((b)=>b.id==='book-math').matchingOfferIds,[])
  await store.setPreference('user-kanittha','book-tgat','LIKE')
  books=nearbyBooks(await store.discoveryContext('user-natcha'),5,true)
  assert.deepEqual(books.find((b)=>b.id==='book-math').matchingOfferIds,['book-tgat'])
  assert.equal(nearbyBooks(await store.discoveryContext('user-natcha'),5).some((b)=>b.id==='book-math'),false)
})
test('meeting details and bounded reading duration are required',()=>{
  assert.throws(()=>loanTerms({loanDays:90}),{status:400})
  assert.throws(()=>loanTerms({loanDays:14,meetingPlace:'Library',meetingAt:'2020-01-01'}),{status:400})
})
test('conversation participants can read messages but outsiders cannot',async()=>{
  const store=new MemoryStore();const room=await store.createConversation('user-natcha','user-kanittha')
  assert.equal((await store.createConversation('user-kanittha','user-natcha')).id,room.id)
  await store.sendMessage(room.id,'user-natcha','Test meeting message')
  assert.equal((await store.conversationMessages(room.id,'user-kanittha')).length,1)
  await assert.rejects(store.conversationMessages(room.id,'outsider'),{status:404})
  await assert.rejects(store.sendMessage(room.id,'outsider','No access'),{status:404})
})
