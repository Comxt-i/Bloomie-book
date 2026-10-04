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

// ส่ง response error แบบมีรูปแบบเดียวกันทุก endpoint
function sendError(res, status, message) {
  return res.status(status).json({ message })
}

// สร้าง JWT สำหรับเก็บ session ของ user
function signToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' })
}

// Middleware ตรวจสอบ token ก่อนเข้าถึง route ที่ต้อง login
async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ')
    const payload = jwt.verify(token, jwtSecret)
    const user = await store.findUserById(payload.sub)
    if (!user) return sendError(res, 401, 'ไม่พบบัญชีผู้ใช้')
    req.user = user
    next()
  } catch {
    return sendError(res, 401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  }
}

// Endpoint ตรวจสอบว่า server ทำงานและใช้ DB ชนิดไหน
app.get('/api/health', async (_req, res, next) => {
  try { res.json({ message: 'PUN AAN API is running', storage: await store.healthCheck() }) }
  catch (error) { next(error) }
})

// สมัครสมาชิกใหม่: ตรวจข้อมูล, hash รหัสผ่าน, สร้าง user และคืน token
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, educationLevel = 'ทั่วไป', interests = [] } = req.body
    if (!name?.trim() || !email?.trim() || !password) {
      return sendError(res, 400, 'กรุณากรอกข้อมูลให้ครบ')
    }
    if (!Array.isArray(interests) || interests.some((item) => !BOOK_CATEGORIES.includes(item) && !LEGACY_STUDY_SUBJECTS.includes(item))) {
      return sendError(res, 400, 'หมวดหนังสือที่สนใจไม่ถูกต้อง')
    }
    if (password.length < 8) return sendError(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    if (await store.findUserByEmail(email)) return sendError(res, 409, 'อีเมลนี้ถูกใช้งานแล้ว')

    const user = await store.createUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash: await bcrypt.hash(password, 10),
      educationLevel,
      interests: preferredCategories(interests),
    })
    res.status(201).json({ user, token: signToken(user) })
  } catch (error) {
    next(error)
  }
})

// Login: ตรวจ email/password แล้วคืน token ให้ client
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    const userWithPassword = await store.findUserByEmail(email || '')
    if (!userWithPassword || !(await bcrypt.compare(password || '', userWithPassword.passwordHash))) {
      return sendError(res, 401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }
    const user = await store.findUserById(userWithPassword.id)
    res.json({ user, token: signToken(user) })
  } catch (error) {
    next(error)
  }
})

// ดึงข้อมูล user ปัจจุบันจาก token
app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }))

// ดึงหนังสือทั้งหมด หรือค้นหาตามชื่อและหมวดใหญ่
app.get('/api/books', async (req, res, next) => {
  try {
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
    const { title, subject, category: requestedCategory, educationLevel = 'ทั่วไป', condition, description = '', imageUrl = '' } = req.body
    const category = requestedCategory || (subject ? categoryOf(subject) : '')
    if (!title?.trim() || !category || !condition) {
      return sendError(res, 400, 'กรุณากรอกข้อมูลหนังสือให้ครบ')
    }
    if (!BOOK_CATEGORIES.includes(category) || (subject && !BOOK_CATEGORIES.includes(subject) && !LEGACY_STUDY_SUBJECTS.includes(subject))) {
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
    if (!['LIKE', 'DISLIKE'].includes(req.body.preference)) return sendError(res, 400, 'ค่าความสนใจไม่ถูกต้อง')
    const book = await store.findBookById(req.params.id)
    if (!book) return sendError(res, 404, 'ไม่พบหนังสือ')
    if (book.ownerId === req.user.id) return sendError(res, 400, 'ไม่สามารถให้คะแนนหนังสือของตัวเองได้')
    res.json(await store.setPreference(req.user.id, book.id, req.body.preference))
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
    const { offeredBookId, requestedBookId, message = '', loanDays, meetingPlace, meetingAt } = req.body
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
    const request = await store.findRequestById(req.params.id)
    if (!request) return sendError(res, 404, 'ไม่พบคำขอ')
    const status = req.body.status
    res.json({ request: await store.updateRequestStatus(request.id, status, req.user.id) })
  } catch (error) {
    next(error)
  }
})

// Coarse location is visible only to its owner. Discovery returns approximate distance.
app.patch('/api/profile/location', authenticate, async (req, res, next) => {
  try { res.json({ user: await store.saveLocation(req.user.id, normalizeLocation(req.body.location)) }) }
  catch (error) { next(error) }
})

app.get('/api/discovery', authenticate, async (req, res, next) => {
  try {
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
    const { bookId, preference } = req.body
    if (!['LIKE','DISLIKE'].includes(preference)) return sendError(res,400,'เลือกสนใจหรือผ่าน')
    const context = await store.discoveryContext(req.user.id)
    const book = context.books.find((item) => item.id === bookId)
    const owner = context.users.find((item) => item.id === book?.ownerId)
    if (!book || book.ownerId === req.user.id || book.status !== 'AVAILABLE') return sendError(res,409,'หนังสือเล่มนี้ไม่พร้อมแลกอ่าน')
    if (!context.user.location || !owner?.location) return sendError(res,400,'เลือกพื้นที่ก่อนเริ่มปัดหนังสือ')
    const distance = distanceKm(context.user.location, owner.location)
    if (distance > 100) return sendError(res,400,'หนังสืออยู่นอกรัศมีค้นหา 100 กม.')
    await store.setPreference(req.user.id, bookId, preference)
    await store.recordSwipe({ userId: req.user.id, bookId, subjectMatch: Number(preferredCategories(req.user.interests).includes(book.category || categoryOf(book.subject))), levelMatch: Number(req.user.educationLevel !== 'ทั่วไป' && req.user.educationLevel === book.educationLevel), distanceKm: distance, label: Number(preference === 'LIKE') })
    const matching = nearbyBooks(await store.discoveryContext(req.user.id), 100, true).find((item) => item.id === bookId)
    res.json({ matched: Boolean(matching?.matchingOfferIds.length), book: matching })
  } catch (error) { next(error) }
})

app.get('/api/conversations', authenticate, async (req, res, next) => {
  try { res.json({ conversations: await store.listConversations(req.user.id) }) } catch (error) { next(error) }
})
app.post('/api/conversations', authenticate, async (req, res, next) => {
  try {
    const context = await store.discoveryContext(req.user.id)
    const peerId = req.body.peerId
    if (typeof peerId !== 'string' || peerId === req.user.id || !context.users.some((user) => user.id === peerId)) return sendError(res,400,'ผู้สนทนาไม่ถูกต้อง')
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
  try { res.json({ messages: await store.conversationMessages(req.params.id,req.user.id) }) } catch (error) { next(error) }
})
app.post('/api/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    const text = req.body.text
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) return sendError(res,400,'ข้อความต้องมี 1–2,000 ตัวอักษร')
    res.status(201).json({ message: await store.sendMessage(req.params.id,req.user.id,text.trim()) })
  } catch (error) { next(error) }
})

// จัดการ error ทั่วทั้ง API ให้ตอบกลับเป็น JSON ที่อ่านง่าย
app.use((error, _req, res, _next) => {
  if ([400, 403, 404, 409].includes(error.status)) return sendError(res, error.status, error.message)
  console.error(error)
  const message = error.code === '23505' ? 'ข้อมูลนี้มีอยู่ในระบบแล้ว' : 'ระบบเกิดข้อผิดพลาด กรุณาลองใหม่'
  res.status(error.code === '23505' ? 409 : 500).json({ message })
})

// เริ่มต้น storage/DB ให้พร้อมใช้งานก่อนรับ request
await store.initialize()

// เปิด port เพื่อรัน API จริง ๆ เว้นแต่ตอนทำ test
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`PUN AAN API: http://localhost:${port}`)
    console.log(`Storage: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'demo memory'}`)
  })
}

// Export app และ store สำหรับใช้ใน test หรือ import อื่น
export { app, store }
