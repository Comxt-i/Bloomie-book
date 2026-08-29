import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createStore } from './store.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const jwtSecret = process.env.JWT_SECRET || 'pun-aan-development-secret'
const store = createStore(process.env.DATABASE_URL)

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4173' }))
app.use(express.json({ limit: '1mb' }))

function sendError(res, status, message) {
  return res.status(status).json({ message })
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' })
}

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

app.get('/api/health', (_req, res) => {
  res.json({ message: 'PUN AAN API is running', storage: process.env.DATABASE_URL ? 'postgresql' : 'demo' })
})

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, educationLevel, interests = [] } = req.body
    if (!name?.trim() || !email?.trim() || !password || !educationLevel) {
      return sendError(res, 400, 'กรุณากรอกข้อมูลให้ครบ')
    }
    if (password.length < 8) return sendError(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    if (await store.findUserByEmail(email)) return sendError(res, 409, 'อีเมลนี้ถูกใช้งานแล้ว')

    const user = await store.createUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash: await bcrypt.hash(password, 10),
      educationLevel,
      interests,
    })
    res.status(201).json({ user, token: signToken(user) })
  } catch (error) {
    next(error)
  }
})

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

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }))

app.get('/api/books', async (req, res, next) => {
  try {
    const books = await store.listBooks({ search: req.query.search, subject: req.query.subject })
    res.json({ books })
  } catch (error) {
    next(error)
  }
})

app.get('/api/books/mine', authenticate, async (req, res, next) => {
  try {
    res.json({ books: await store.listBooks({ userId: req.user.id }) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/books', authenticate, async (req, res, next) => {
  try {
    const { title, subject, educationLevel, condition, description = '', imageUrl = '' } = req.body
    if (!title?.trim() || !subject || !educationLevel || !condition) {
      return sendError(res, 400, 'กรุณากรอกข้อมูลหนังสือให้ครบ')
    }
    const book = await store.createBook(req.user.id, {
      title: title.trim(), subject, educationLevel, condition, description: description.trim(), imageUrl: imageUrl.trim(),
    })
    res.status(201).json({ book })
  } catch (error) {
    next(error)
  }
})

app.get('/api/recommendations', authenticate, async (req, res, next) => {
  try {
    res.json({ books: await store.recommendations(req.user.id) })
  } catch (error) {
    next(error)
  }
})

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

app.get('/api/exchange-requests/mine', authenticate, async (req, res, next) => {
  try {
    res.json({ requests: await store.listRequests(req.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/exchange-requests', authenticate, async (req, res, next) => {
  try {
    const { offeredBookId, requestedBookId, message = '' } = req.body
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
    const request = await store.createRequest(req.user.id, { offeredBookId, requestedBookId, message: message.trim() })
    res.status(201).json({ request })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/exchange-requests/:id/status', authenticate, async (req, res, next) => {
  try {
    const request = await store.findRequestById(req.params.id)
    if (!request) return sendError(res, 404, 'ไม่พบคำขอ')
    const isRequester = request.requesterId === req.user.id
    const isOwner = request.requestedBook.ownerId === req.user.id
    const allowed = {
      ACCEPTED: isOwner && request.status === 'PENDING',
      REJECTED: isOwner && request.status === 'PENDING',
      CANCELLED: isRequester && ['PENDING', 'ACCEPTED'].includes(request.status),
      COMPLETED: (isRequester || isOwner) && request.status === 'ACCEPTED',
    }
    const status = req.body.status
    if (!allowed[status]) return sendError(res, 403, 'ไม่สามารถเปลี่ยนเป็นสถานะนี้ได้')
    res.json({ request: await store.updateRequestStatus(request.id, status) })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  const message = error.code === '23505' ? 'ข้อมูลนี้มีอยู่ในระบบแล้ว' : 'ระบบเกิดข้อผิดพลาด กรุณาลองใหม่'
  res.status(error.code === '23505' ? 409 : 500).json({ message })
})

await store.initialize()

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`PUN AAN API: http://localhost:${port}`)
    console.log(`Storage: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'demo memory'}`)
  })
}

export { app, store }
