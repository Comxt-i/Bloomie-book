import { categoryOf, preferredCategories } from './categories.js'

export function problem(message, status = 409) { return Object.assign(new Error(message), { status }) }

export function normalizeLocation(value) {
  if (value === null) return null
  if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) throw problem('กรุณาระบุพิกัดที่ถูกต้อง', 400)
  // Keep only a coarse search area, never an exact live position or movement history.
  return { latitude: Math.round(value.latitude * 100) / 100, longitude: Math.round(value.longitude * 100) / 100 }
}
export function distanceKm(a, b) {
  const radians = (n) => n * Math.PI / 180
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export function loanTerms(input) {
  const loanDays = input.loanDays ?? 14
  if (!Number.isInteger(loanDays) || loanDays < 1 || loanDays > 60) throw problem('ระยะเวลาอ่านต้องเป็น 1–60 วัน', 400)
  if (typeof input.meetingPlace !== 'string' || !input.meetingPlace.trim() || input.meetingPlace.length > 200) throw problem('ระบุจุดนัดพบ เช่น ห้องสมุดหรือคาเฟ่', 400)
  const meetingAt = new Date(input.meetingAt)
  if (!Number.isFinite(meetingAt.getTime()) || meetingAt.getTime() < Date.now() - 60000) throw problem('เลือกเวลานัดพบในอนาคต', 400)
  return { loanDays, meetingPlace: input.meetingPlace.trim(), meetingAt: meetingAt.toISOString(), receivedBy: [], returnedBy: [], dueAt: null }
}
export function transitionLoan(request, action, actorId, offered, requested) {
  const isRequester = request.requesterId === actorId, isOwner = requested.ownerId === actorId
  const receivedBy = request.receivedBy || [], returnedBy = request.returnedBy || []
  const allowed = {
    ACCEPTED: isOwner && request.status === 'PENDING',
    REJECTED: isOwner && request.status === 'PENDING',
    CANCELLED: (isRequester || isOwner) && ['PENDING', 'ACCEPTED'].includes(request.status) && receivedBy.length === 0,
    RECEIVED: (isRequester || isOwner) && request.status === 'ACCEPTED' && !receivedBy.includes(actorId),
    RETURNED: (isRequester || isOwner) && request.status === 'ACTIVE' && !returnedBy.includes(actorId),
  }
  if (!allowed[action]) throw problem('สถานะเปลี่ยนไปแล้ว หรือยังทำขั้นตอนนี้ไม่ได้', 403)
  const result = { ...request, receivedBy: [...receivedBy], returnedBy: [...returnedBy], updatedAt: new Date().toISOString() }
  let bookStatus = null
  if (action === 'ACCEPTED') {
    if (offered.status !== 'AVAILABLE' || requested.status !== 'AVAILABLE') throw problem('หนังสือบางเล่มไม่พร้อมแลกอ่านแล้ว')
    result.status = 'ACCEPTED'; bookStatus = 'RESERVED'
  } else if (action === 'RECEIVED') {
    result.receivedBy.push(actorId)
    if (result.receivedBy.length === 2) {
      result.status = 'ACTIVE'; bookStatus = 'ON_LOAN'
      result.dueAt = new Date(Date.now() + request.loanDays * 86400000).toISOString()
    }
  } else if (action === 'RETURNED') {
    result.returnedBy.push(actorId)
    if (result.returnedBy.length === 2) { result.status = 'COMPLETED'; bookStatus = 'AVAILABLE' }
  } else {
    result.status = action
    if (action === 'CANCELLED' && request.status === 'ACCEPTED') bookStatus = 'AVAILABLE'
  }
  return { request: result, bookStatus }
}

export function nearbyBooks({ user, users, books, preferences }, radiusKm = 10, includeSeen = false) {
  if (!user.location) return []
  const pref = (uid, bid) => preferences.find((item) => item.userId === uid && item.bookId === bid)?.preference
  return books.filter((book) => book.ownerId !== user.id && book.status === 'AVAILABLE').flatMap((book) => {
    const owner = users.find((item) => item.id === book.ownerId)
    if (!owner?.location) return []
    const distance = distanceKm(user.location, owner.location)
    const preference = pref(user.id, book.id)
    if (distance > radiusKm || (!includeSeen && preference)) return []
    const matchingOfferIds = preference === 'LIKE' ? books.filter((mine) => mine.ownerId === user.id && mine.status === 'AVAILABLE' && pref(owner.id, mine.id) === 'LIKE').map((mine) => mine.id) : []
    const reasons = []
    if (preferredCategories(user.interests).includes(book.category || categoryOf(book.subject))) reasons.push(`ตรงหมวด${book.category || categoryOf(book.subject)}ที่สนใจ`)
    if (user.educationLevel !== 'ทั่วไป' && user.educationLevel === book.educationLevel) reasons.push('ระดับการศึกษาเดียวกัน')
    const { owner: _owner, ...safeBook } = book
    return [{ ...safeBook, owner: { id: owner.id, name: owner.name }, distanceKm: Math.round(distance * 2) / 2, preference: preference || null, matchingOfferIds, reasons }]
  }).sort((a, b) => a.distanceKm - b.distanceKm)
}

function withReasons(books, likedBooks) {
  return books.map((book) => {
    const reasons = (book.reasons || []).filter((reason) => reason !== 'หนังสือพร้อมแลก')
    const category = book.category || categoryOf(book.subject)
    if (likedBooks.some((liked) => liked.id !== book.id && (liked.category || categoryOf(liked.subject)) === category)) reasons.push('หมวดเดียวกับเล่มที่คุณเคยสนใจ')
    if (!reasons.length) reasons.push('หนังสือพร้อมแลก')
    return { ...book, reasons: [...new Set(reasons)] }
  })
}

async function rankBooks(user, books, likedBooks, nearby, request) {
  if (!books.length) return { books, engine: 'empty' }
  const explained = withReasons(books, likedBooks)
  try {
    const response = await request(`${process.env.ML_SERVICE_URL || 'http://127.0.0.1:4190'}/rank`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(2500),
      // Only content features go to the recommendation service, never names or coordinates.
      body: JSON.stringify({ profile: { interests: preferredCategories(user.interests), educationLevel: user.educationLevel }, useClassifier: nearby, books: explained.map(({ id, title, subject, category, educationLevel, distanceKm }) => ({ id, title, category: category || categoryOf(subject), educationLevel, distanceKm })), likedBooks: likedBooks.map(({ title, subject, category, educationLevel }) => ({ title, category: category || categoryOf(subject), educationLevel })) }),
    })
    if (!response.ok) throw new Error('ML unavailable')
    const result = await response.json()
    if (!Array.isArray(result.ranking)) throw new Error('Invalid ranking')
    if (!['content-knn', 'knn-classifier', 'decision-tree', 'logistic-regression'].includes(result.engine)) throw new Error('Invalid ranking engine')
    const scores = new Map(result.ranking.map((item) => [item.id, item.score]))
    if (explained.some((book) => !Number.isFinite(scores.get(book.id)))) throw new Error('Invalid ranking')
    return { books: explained.sort((a, b) => scores.get(b.id) - scores.get(a.id) || (nearby ? a.distanceKm - b.distanceKm : b.score - a.score)), engine: result.engine, syntheticDemo: result.syntheticDemo === true }
  } catch {
    return { books: explained.sort((a, b) => nearby ? b.reasons.length - a.reasons.length || a.distanceKm - b.distanceKm : b.score - a.score), engine: 'interest-distance-fallback' }
  }
}

export function rankNearby(user, books, likedBooks, request = fetch) {
  return rankBooks(user, books, likedBooks, true, request)
}

export function rankRecommendations(user, books, likedBooks, request = fetch) {
  return rankBooks(user, books, likedBooks, false, request)
}
