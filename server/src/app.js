// โหลด environment variables เช่น DATABASE_URL, JWT_SECRET
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createStore } from './store.js'
import { validateProductionConfig } from './config.js'
import { createAuthRateLimiter } from './security.js'
import { BOOK_CATEGORIES, LEGACY_STUDY_SUBJECTS, categoryOf, preferredCategories } from './categories.js'
import { normalizeLocation, nearbyBooks, rankNearby, rankRecommendations, distanceKm } from './reading.js'

// สร้างแอป Express และกำหนดค่าเริ่มต้นสำหรับ API
const app = express()
const port = Number(process.env.PORT || 3000)
const jwtSecret = process.env.JWT_SECRET || 'pun-aan-development-secret'
validateProductionConfig(process.env)
const store = createStore(process.env.DATABASE_URL)
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// เปิดการเข้าถึงจาก frontend ที่รันบนเครื่อง client (CORS)
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4173' }))
// อ่าน JSON body จาก request และจำกัดขนาด payload
app.use(express.json({ limit: '1mb' }))
app.post(['/api/auth/register', '/api/auth/login'], createAuthRateLimiter())
app.use('/api/admin', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

// ส่ง response error แบบมีรูปแบบเดียวกันทุก endpoint
function sendError(res, status, message) {
  return res.status(status).json({ message })
}

const isText = (value, max, required = true) => typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()))
const isId = (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value)
const isBookRouteId = (value) => isId(value) && (!process.env.DATABASE_URL || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
const BOOK_CONDITIONS = ['เหมือนใหม่', 'ดีมาก', 'ดี', 'มีรอยเขียน']
const isWebUrl = (value) => {
  if (value === '') return true
  if (!isText(value, 2048)) return false
  try { return ['http:', 'https:'].includes(new URL(value).protocol) }
  catch { return false }
}
const maxBookImageBytes = 2 * 1024 * 1024
const imageTypeFromBytes = (data) => {
  if (!Buffer.isBuffer(data)) return null
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg'
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}
async function editableBook(req) {
  const book = await store.findBookById(req.params.id)
  if (!book) throw Object.assign(new Error('ไม่พบหนังสือ'), { status: 404 })
  if (book.ownerId !== req.user.id) throw Object.assign(new Error('แก้ไขได้เฉพาะหนังสือของตัวเอง'), { status: 403 })
  if (book.status !== 'AVAILABLE') throw Object.assign(new Error('หนังสือเล่มนี้อยู่ระหว่างแลกอ่าน จึงยังแก้ไขไม่ได้'), { status: 409 })
  return book
}
const isAdmin = (userId) => (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).includes(userId)
const sessionUser = (user) => ({ ...user, isAdmin: isAdmin(user.id) })
const requireAdmin = (req, res, next) => isAdmin(req.user.id) ? next() : sendError(res, 403, 'ไม่มีสิทธิ์ผู้ดูแล')
const adminPage = (req) => {
  const page = Number(req.query.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw Object.assign(new Error('เลขหน้าไม่ถูกต้อง'), { status: 400 })
  const search = req.query.search ?? ''
  if (typeof search !== 'string' || search.length > 100) throw Object.assign(new Error('คำค้นไม่ถูกต้อง'), { status: 400 })
  return { page, search: search.trim(), pageSize: 20 }
}
const preferenceEvent = (user, book, owner, source, distance = null) => ({
  subjectMatch: Number(preferredCategories(user.interests).includes(book.category || categoryOf(book.subject))),
  levelMatch: Number(user.educationLevel !== 'ทั่วไป' && user.educationLevel === book.educationLevel),
  distanceKm: distance ?? (user.location && owner?.location ? distanceKm(user.location, owner.location) : null),
  source,
})

// สร้าง JWT สำหรับเก็บ session ของ user
function signToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' })
}

// Middleware ตรวจสอบ token ก่อนเข้าถึง route ที่ต้อง login
async function authenticate(req, res, next) {
  const authorization = req.headers.authorization
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ')
  let payload
  try {
    payload = jwt.verify(authorization.replace(/^Bearer\s+/i, ''), jwtSecret)
  } catch {
    return sendError(res, 401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  }
  try {
    const user = await store.findUserById(payload.sub)
    if (!user) return sendError(res, 401, 'ไม่พบบัญชีผู้ใช้')
    req.user = user
    next()
  } catch (error) { next(error) }
}

// Endpoint ตรวจสอบว่า server ทำงานและใช้ DB ชนิดไหน
app.get('/api/health', async (_req, res, next) => {
  try { res.json({ message: 'Bloomie Book API is running', storage: await store.healthCheck() }) }
  catch (error) { next(error) }
})

// สมัครสมาชิกใหม่: ตรวจข้อมูล, hash รหัสผ่าน, สร้าง user และคืน token
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, educationLevel = 'ทั่วไป', interests = [] } = req.body || {}
    if (!isText(name, 100) || !isText(email, 254) || !isText(password, 128) || password.length < 8 || !isText(educationLevel, 80)) return sendError(res, 400, 'กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษรให้ถูกต้อง')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return sendError(res, 400, 'อีเมลไม่ถูกต้อง')
    if (!Array.isArray(interests) || interests.length > BOOK_CATEGORIES.length || interests.some((item) => !BOOK_CATEGORIES.includes(item) && !LEGACY_STUDY_SUBJECTS.includes(item))) return sendError(res, 400, 'หมวดหนังสือที่สนใจไม่ถูกต้อง')
    if (await store.findUserByEmail(normalizedEmail)) return sendError(res, 409, 'อีเมลนี้ถูกใช้งานแล้ว')

    const user = await store.createUser({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      educationLevel,
      interests: preferredCategories(interests),
    })
    res.status(201).json({ user: sessionUser(user), token: signToken(user) })
  } catch (error) {
    next(error)
  }
})

// Login: ตรวจ email/password แล้วคืน token ให้ client
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!isText(email, 254) || !isText(password, 128)) return sendError(res, 400, 'กรุณากรอกอีเมลและรหัสผ่าน')
    const userWithPassword = await store.findUserByEmail(email.trim().toLowerCase())
    if (!userWithPassword || !(await bcrypt.compare(password, userWithPassword.passwordHash))) {
      return sendError(res, 401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }
    const user = await store.findUserById(userWithPassword.id)
    res.json({ user: sessionUser(user), token: signToken(user) })
  } catch (error) {
    next(error)
  }
})

// ดึงข้อมูล user ปัจจุบันจาก token
app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: sessionUser(req.user) }))

// ดึงหนังสือทั้งหมด หรือค้นหาตามชื่อและหมวดใหญ่
app.get('/api/books', async (req, res, next) => {
  try {
    if (req.query.search !== undefined && (typeof req.query.search !== 'string' || req.query.search.length > 200)) return sendError(res, 400, 'คำค้นไม่ถูกต้อง')
    if (req.query.category !== undefined && typeof req.query.category !== 'string') return sendError(res, 400, 'หมวดหนังสือไม่ถูกต้อง')
    if (req.query.subject !== undefined && typeof req.query.subject !== 'string') return sendError(res, 400, 'วิชาหรือหมวดหนังสือไม่ถูกต้อง')
    const category = req.query.category || (req.query.subject ? categoryOf(req.query.subject) : '')
    if (category && !BOOK_CATEGORIES.includes(category)) return sendError(res, 400, 'หมวดหนังสือไม่ถูกต้อง')
    const books = await store.listBooks({ search: req.query.search, category })
    res.json({ books })
  } catch (error) {
    next(error)
  }
})

// ดึงหนังสือที่ user เจ้าของโพสต์เอง
app.get('/api/books/mine', authenticate, async (req, res, next) => {
  try {
    res.json({ books: await store.listBooks({ userId: req.user.id }) })
  } catch (error) {
    next(error)
  }
})

// เพิ่มหนังสือใหม่เข้าระบบ โดยต้อง login ก่อน
app.post('/api/books', authenticate, async (req, res, next) => {
  try {
    const { title, subject, category: requestedCategory, educationLevel = 'ทั่วไป', condition, description = '', imageUrl = '' } = req.body || {}
    const category = requestedCategory || (subject ? categoryOf(subject) : '')
    if (!isText(title, 200) || !category || !BOOK_CONDITIONS.includes(condition) || !isText(educationLevel, 80) || !isText(description, 2000, false) || !isText(imageUrl, 2048, false) || !isWebUrl(imageUrl.trim())) {
      return sendError(res, 400, 'กรุณากรอกข้อมูลหนังสือให้ครบ')
    }
    if (typeof category !== 'string' || !BOOK_CATEGORIES.includes(category) || (subject !== undefined && (!isText(subject, 100) || !BOOK_CATEGORIES.includes(subject) && !LEGACY_STUDY_SUBJECTS.includes(subject)))) {
      return sendError(res, 400, 'หมวดหนังสือไม่ถูกต้อง')
    }
    const book = await store.createBook(req.user.id, {
      title: title.trim(), subject: subject || category, category, educationLevel, condition, description: description.trim(), imageUrl: imageUrl.trim(),
    })
    res.status(201).json({ book })
  } catch (error) {
    next(error)
  }
})

// Edit details only while the owner's book is available for exchange.
app.patch('/api/books/:id', authenticate, async (req, res, next) => {
  try {
    if (!isBookRouteId(req.params.id)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    await editableBook(req)
    const { title, category, condition, description = '' } = req.body || {}
    if (!isText(title, 200) || !BOOK_CATEGORIES.includes(category) || !BOOK_CONDITIONS.includes(condition) || !isText(description, 2000, false)) return sendError(res, 400, 'กรุณากรอกข้อมูลหนังสือให้ถูกต้อง')
    const book = await store.updateBook(req.params.id, req.user.id, { title: title.trim(), subject: category, category, condition, description: description.trim() })
    res.json({ book })
  } catch (error) { next(error) }
})

// Uploaded covers are public, but only their owner may replace or remove them.
app.get('/api/books/:id/image', async (req, res, next) => {
  try {
    if (!isBookRouteId(req.params.id)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    const image = await store.getBookImage(req.params.id)
    if (!image) return sendError(res, 404, 'ไม่พบรูปปก')
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).type(image.mimeType).send(image.data)
  } catch (error) { next(error) }
})

app.put('/api/books/:id/image', authenticate, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: maxBookImageBytes }), async (req, res, next) => {
  try {
    if (!isBookRouteId(req.params.id)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    await editableBook(req)
    const declaredType = req.get('content-type')?.split(';')[0].toLowerCase()
    if (!Buffer.isBuffer(req.body) || !req.body.length || req.body.length > maxBookImageBytes || imageTypeFromBytes(req.body) !== declaredType) return sendError(res, 415, 'ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB')
    res.json({ book: await store.saveBookImage(req.params.id, req.user.id, declaredType, req.body) })
  } catch (error) { next(error) }
})

app.delete('/api/books/:id/image', authenticate, async (req, res, next) => {
  try {
    if (!isBookRouteId(req.params.id)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    await editableBook(req)
    res.json({ book: await store.removeBookImage(req.params.id, req.user.id) })
  } catch (error) { next(error) }
})

// แนะนำหนังสือให้ user ตามความสนใจหรือข้อมูลประวัติ
app.get('/api/recommendations', authenticate, async (req, res, next) => {
  try {
    const [books, likedBooks] = await Promise.all([store.recommendations(req.user.id), store.likedBooks(req.user.id)])
    res.json(await rankRecommendations(req.user, books, likedBooks))
  } catch (error) {
    next(error)
  }
})

// ให้คะแนน/กดถูกใจหรือไม่ชอบหนังสือเล่มอื่น
app.post('/api/books/:id/preference', authenticate, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    if (!['LIKE', 'DISLIKE'].includes(req.body?.preference)) return sendError(res, 400, 'ค่าความสนใจไม่ถูกต้อง')
    const book = await store.findBookById(req.params.id)
    if (!book) return sendError(res, 404, 'ไม่พบหนังสือ')
    if (book.ownerId === req.user.id) return sendError(res, 400, 'ไม่สามารถให้คะแนนหนังสือของตัวเองได้')
    if (book.status !== 'AVAILABLE') return sendError(res, 409, 'หนังสือเล่มนี้ไม่พร้อมแลกอ่าน')
    const owner = await store.findUserById(book.ownerId)
    res.json(await store.savePreference(req.user.id, book.id, req.body.preference, preferenceEvent(req.user, book, owner, 'CATALOG')))
  } catch (error) {
    next(error)
  }
})

// ดึงคำขอแลกหนังสือของ user ปัจจุบัน
app.get('/api/exchange-requests/mine', authenticate, async (req, res, next) => {
  try {
    res.json({ requests: await store.listRequests(req.user.id) })
  } catch (error) {
    next(error)
  }
})

// สร้างคำขอแลกหนังสือระหว่างสองเล่ม
app.post('/api/exchange-requests', authenticate, async (req, res, next) => {
  try {
    const { offeredBookId, requestedBookId, message = '', loanDays, meetingPlace, meetingAt } = req.body || {}
    if (!isId(offeredBookId) || !isId(requestedBookId)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    if (typeof message !== 'string' || message.length > 1000) return sendError(res, 400, 'ข้อความต้องไม่เกิน 1,000 ตัวอักษร')
    const offered = await store.findBookById(offeredBookId)
    const requested = await store.findBookById(requestedBookId)
    if (!offered || !requested) return sendError(res, 404, 'ไม่พบหนังสือที่เลือก')
    if (offered.ownerId !== req.user.id) return sendError(res, 403, 'คุณเสนอได้เฉพาะหนังสือของตัวเอง')
    if (requested.ownerId === req.user.id) return sendError(res, 400, 'ไม่สามารถขอแลกหนังสือของตัวเอง')
    if (offered.status !== 'AVAILABLE' || requested.status !== 'AVAILABLE') return sendError(res, 409, 'หนังสือบางเล่มไม่พร้อมแลกแล้ว')
    const existing = (await store.listRequests(req.user.id)).some(
      (request) => request.requestedBookId === requestedBookId && request.status === 'PENDING',
    )
    if (existing) return sendError(res, 409, 'คุณส่งคำขอสำหรับหนังสือเล่มนี้แล้ว')
    const request = await store.createRequest(req.user.id, { offeredBookId, requestedBookId, message: message.trim(), loanDays, meetingPlace, meetingAt })
    res.status(201).json({ request })
  } catch (error) {
    next(error)
  }
})

// เปลี่ยนสถานะคำขอแลก เช่น รับอันยอม/ปฏิเสธ/ยกเลิก/เสร็จสิ้น
app.patch('/api/exchange-requests/:id/status', authenticate, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสคำขอไม่ถูกต้อง')
    const request = await store.findRequestById(req.params.id)
    if (!request) return sendError(res, 404, 'ไม่พบคำขอ')
    const status = req.body?.status
    if (!['ACCEPTED', 'REJECTED', 'CANCELLED', 'RECEIVED', 'UNDO_RECEIVED', 'CANCEL_REQUESTED', 'CANCEL_WITHDRAWN', 'RETURNED'].includes(status)) return sendError(res, 400, 'สถานะคำขอไม่ถูกต้อง')
    res.json({ request: await store.updateRequestStatus(request.id, status, req.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/exchange-requests/:id/issue', authenticate, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสคำขอไม่ถูกต้อง')
    const reason = req.body?.reason
    if (!isText(reason, 1000) || reason.trim().length < 10) return sendError(res, 400, 'กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร')
    res.json({ request: await store.reportIssue(req.params.id, req.user.id, reason.trim()) })
  } catch (error) { next(error) }
})

app.get('/api/admin/overview', authenticate, requireAdmin, async (_req, res, next) => {
  try { res.json(await store.adminOverview()) }
  catch (error) { next(error) }
})

app.get('/api/admin/users', authenticate, requireAdmin, async (req, res, next) => {
  try { res.json(await store.adminUsers(adminPage(req))) }
  catch (error) { next(error) }
})

app.get('/api/admin/books', authenticate, requireAdmin, async (req, res, next) => {
  try { res.json(await store.adminBooks(adminPage(req))) }
  catch (error) { next(error) }
})

app.get('/api/admin/exchange-requests/issues', authenticate, requireAdmin, async (req, res, next) => {
  if (req.query?.status && !['open', 'resolved'].includes(req.query.status)) return sendError(res, 400, 'สถานะรายการไม่ถูกต้อง')
  try { res.json({ requests: await store.listAdminIssues(req.query?.status || 'open') }) }
  catch (error) { next(error) }
})

app.patch('/api/admin/exchange-requests/:id/resolve', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสคำขอไม่ถูกต้อง')
    const { outcome, note } = req.body || {}
    if (!['CANCELLED', 'COMPLETED'].includes(outcome) || !isText(note, 1000) || note.trim().length < 10) return sendError(res, 400, 'ระบุผลการตรวจและเหตุผลอย่างน้อย 10 ตัวอักษร')
    res.json({ request: await store.resolveIssue(req.params.id, req.user.id, outcome, note.trim()) })
  } catch (error) { next(error) }
})

// Coarse location is visible only to its owner. Discovery returns approximate distance.
app.patch('/api/profile/location', authenticate, async (req, res, next) => {
  try { res.json({ user: sessionUser(await store.saveLocation(req.user.id, normalizeLocation(req.body?.location))) }) }
  catch (error) { next(error) }
})

app.get('/api/discovery', authenticate, async (req, res, next) => {
  try {
    if (req.query.radiusKm !== undefined && (typeof req.query.radiusKm !== 'string' || req.query.radiusKm.trim() === '')) return sendError(res, 400, 'รัศมีไม่ถูกต้อง')
    const radiusKm = Number(req.query.radiusKm ?? 10)
    if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 100) return sendError(res,400,'รัศมีต้องอยู่ระหว่าง 1–100 กม.')
    const context = await store.discoveryContext(req.user.id)
    if (!context.user.location) return res.json({ books: [], likedBooks: [], needsLocation: true, engine: 'empty' })
    const all = nearbyBooks(context, radiusKm, true)
    const candidates = all.filter((book) => !book.preference)
    const likedBooks = all.filter((book) => book.preference === 'LIKE')
    const likedHistory = context.books.filter((book) => context.preferences.some((pref) => pref.userId === req.user.id && pref.bookId === book.id && pref.preference === 'LIKE'))
    const ranking = await rankNearby(context.user, candidates, likedHistory)
    res.json({ ...ranking, likedBooks, needsLocation: false, demo: !process.env.DATABASE_URL })
  } catch (error) { next(error) }
})

app.post('/api/swipes', authenticate, async (req, res, next) => {
  try {
    const { bookId, preference } = req.body || {}
    if (!isId(bookId)) return sendError(res, 400, 'รหัสหนังสือไม่ถูกต้อง')
    if (!['LIKE','DISLIKE'].includes(preference)) return sendError(res,400,'เลือกสนใจหรือผ่าน')
    const context = await store.discoveryContext(req.user.id)
    const book = context.books.find((item) => item.id === bookId)
    const owner = context.users.find((item) => item.id === book?.ownerId)
    if (!book || book.ownerId === req.user.id || book.status !== 'AVAILABLE') return sendError(res,409,'หนังสือเล่มนี้ไม่พร้อมแลกอ่าน')
    if (!context.user.location || !owner?.location) return sendError(res,400,'เลือกพื้นที่ก่อนเริ่มปัดหนังสือ')
    const distance = distanceKm(context.user.location, owner.location)
    if (distance > 100) return sendError(res,400,'หนังสืออยู่นอกรัศมีค้นหา 100 กม.')
    await store.savePreference(req.user.id, bookId, preference, preferenceEvent(req.user, book, owner, 'DISCOVERY', distance))
    const matching = nearbyBooks(await store.discoveryContext(req.user.id), 100, true).find((item) => item.id === bookId)
    res.json({ matched: Boolean(matching?.matchingOfferIds.length), book: matching || null, unavailable: !matching })
  } catch (error) { next(error) }
})

app.get('/api/conversations', authenticate, async (req, res, next) => {
  try { res.json({ conversations: await store.listConversations(req.user.id) }) } catch (error) { next(error) }
})
app.post('/api/conversations', authenticate, async (req, res, next) => {
  try {
    const context = await store.discoveryContext(req.user.id)
    const peerId = req.body?.peerId
    if (!isId(peerId) || peerId === req.user.id || !context.users.some((user) => user.id === peerId)) return sendError(res,400,'ผู้สนทนาไม่ถูกต้อง')
    const ownBooks = context.books.filter((book) => book.ownerId === req.user.id && book.status === 'AVAILABLE')
    const peerBooks = context.books.filter((book) => book.ownerId === peerId && book.status === 'AVAILABLE')
    const likes = (userId, books) => context.preferences.some((pref) => pref.userId === userId && pref.preference === 'LIKE' && books.some((book) => book.id === pref.bookId))
    const mutual = likes(req.user.id, peerBooks) && likes(peerId, ownBooks)
    const accepted = (await store.listRequests(req.user.id)).some((request) => ['ACCEPTED','ACTIVE','COMPLETED'].includes(request.status) && [request.requesterId,request.requestedBook.ownerId].includes(peerId))
    if (!mutual && !accepted) return sendError(res,403,'เปิดแชทได้เมื่อสนใจตรงกัน หรือคำขอได้รับการตอบรับแล้ว')
    res.json({ conversation: await store.createConversation(req.user.id,peerId) })
  } catch (error) { next(error) }
})
app.get('/api/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสห้องสนทนาไม่ถูกต้อง')
    res.json({ messages: await store.conversationMessages(req.params.id,req.user.id) })
  } catch (error) { next(error) }
})
app.post('/api/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return sendError(res, 400, 'รหัสห้องสนทนาไม่ถูกต้อง')
    const text = req.body?.text
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) return sendError(res,400,'ข้อความต้องมี 1–2,000 ตัวอักษร')
    res.status(201).json({ message: await store.sendMessage(req.params.id,req.user.id,text.trim()) })
  } catch (error) { next(error) }
})

// จัดการ error ทั่วทั้ง API ให้ตอบกลับเป็น JSON ที่อ่านง่าย
app.use((error, _req, res, _next) => {
  if ([400, 403, 404, 409, 415].includes(error.status)) return sendError(res, error.status, error.message)
  if (error.status === 413) return sendError(res, 413, 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป')
  console.error(error)
  const message = error.code === '23505' ? 'ข้อมูลนี้มีอยู่ในระบบแล้ว' : 'ระบบเกิดข้อผิดพลาด กรุณาลองใหม่'
  res.status(error.code === '23505' ? 409 : 500).json({ message })
})

// เริ่มต้น storage/DB ให้พร้อมใช้งานก่อนรับ request
await store.initialize()

// เปิด port เพื่อรัน API จริง ๆ เว้นแต่ตอนทำ test
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Bloomie Book API: http://localhost:${port}`)
    console.log(`Storage: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'demo memory'}`)
  })
}

// Export app และ store สำหรับใช้ใน test หรือ import อื่น
export { app, store }
