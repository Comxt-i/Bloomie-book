import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import { transitionLoan, loanTerms } from './reading.js'
import { categoryOf, preferredCategories } from './categories.js'

const { Pool } = pg

const now = () => new Date().toISOString()

function conflict(message, status = 409) {
  return Object.assign(new Error(message), { status })
}



function publicUser(user) {
  if (!user) return null
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

function calculateScore(book, user, preference) {
  let score = 1
  const reasons = []

  if (preferredCategories(user.interests).includes(book.category || categoryOf(book.subject))) {
    score += 4
    reasons.push(`ตรงกับหมวด${book.category || categoryOf(book.subject)}ที่คุณสนใจ`)
  }
  if (user.educationLevel !== 'ทั่วไป' && user.educationLevel === book.educationLevel) {
    score += 3
    reasons.push('เหมาะกับระดับการศึกษา')
  }
  if (preference === 'LIKE') {
    score += 2
    reasons.push('คุณเคยกดสนใจ')
  }

  return { score, reasons: reasons.length ? reasons : ['หนังสือพร้อมแลก'] }
}

export class MemoryStore {
  constructor() {
    const passwordHash = bcrypt.hashSync('demo1234', 10)
    this.users = [
      {
        id: 'user-natcha',
        name: 'Natcha',
        email: 'natcha@demo.com',
        passwordHash,
        educationLevel: 'ม.6',
        interests: ['คณิตศาสตร์', 'ภาษาอังกฤษ'],
        createdAt: now(),
      },
      {
        id: 'user-kanittha',
        name: 'Kanittha',
        email: 'kanittha@demo.com',
        passwordHash,
        educationLevel: 'ม.6',
        interests: ['ชีววิทยา', 'TGAT'],
        createdAt: now(),
      },
    ]
    this.books = [
      {
        id: 'book-tgat',
        ownerId: 'user-natcha',
        title: 'TGAT1 การสื่อสารภาษาอังกฤษ',
        subject: 'TGAT',
        educationLevel: 'ม.6',
        condition: 'ดีมาก',
        description: 'มีรอยไฮไลต์เล็กน้อย ไม่มีหน้าขาด',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
      {
        id: 'book-math',
        ownerId: 'user-kanittha',
        title: 'สรุปคณิตศาสตร์ ม.ปลาย',
        subject: 'คณิตศาสตร์',
        educationLevel: 'ม.6',
        condition: 'ดี',
        description: 'สรุปสูตรครบ พร้อมข้อสอบท้ายบท',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
      {
        id: 'book-biology',
        ownerId: 'user-kanittha',
        title: 'Biology เตรียมสอบเข้ามหาวิทยาลัย',
        subject: 'ชีววิทยา',
        educationLevel: 'ม.6',
        condition: 'เหมือนใหม่',
        description: 'อ่านหนึ่งครั้ง ไม่มีรอยเขียน',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
      {
        id: 'book-fiction',
        ownerId: 'user-natcha',
        title: 'ร้านหนังสือในคืนฝนตก',
        subject: 'นิยายและวรรณกรรม',
        category: 'นิยายและวรรณกรรม',
        educationLevel: 'ทั่วไป',
        condition: 'ดีมาก',
        description: 'นิยายอบอุ่น อ่านจบแล้วอยากส่งต่อ',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
      {
        id: 'book-comic',
        ownerId: 'user-kanittha',
        title: 'การ์ตูนผจญภัย เล่ม 1',
        subject: 'การ์ตูนและมังงะ',
        category: 'การ์ตูนและมังงะ',
        educationLevel: 'ทั่วไป',
        condition: 'ดี',
        description: 'อ่านสนุก ปกและหน้าครบ',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
      {
        id: 'book-growth',
        ownerId: 'user-natcha',
        title: 'จัดเวลาให้ชีวิตดีขึ้น',
        subject: 'ความรู้และพัฒนาตนเอง',
        category: 'ความรู้และพัฒนาตนเอง',
        educationLevel: 'ทั่วไป',
        condition: 'เหมือนใหม่',
        description: 'หนังสือฝึกวางแผนชีวิตและการอ่าน',
        imageUrl: '',
        status: 'AVAILABLE',
        createdAt: now(),
      },
    ]
    this.users[0].location = { latitude: 7.01, longitude: 100.50 }
    this.users[1].location = { latitude: 7.00, longitude: 100.50 }
    this.swipeEvents = []
    this.conversations = []
    this.messages = []
    this.preferences = []
    this.requests = []
  }

  async initialize() {}

  async healthCheck() { return 'demo' }

  async findUserByEmail(email) {
    return this.users.find((user) => user.email === email.toLowerCase()) || null
  }

  async findUserById(id) {
    return publicUser(this.users.find((user) => user.id === id))
  }

  async createUser(input) {
    const user = {
      id: randomUUID(),
      ...input,
      email: input.email.toLowerCase(),
      createdAt: now(),
    }
    this.users.push(user)
    return publicUser(user)
  }

  enrichBook(book) {
    const user = this.users.find((user) => user.id === book.ownerId)
    const owner = user ? { id: user.id, name: user.name } : null
    return { ...book, category: book.category || categoryOf(book.subject), owner }
  }

  async listBooks({ search = '', category = '', userId = '' } = {}) {
    const needle = search.trim().toLowerCase()
    return this.books
      .filter((book) => !userId || book.ownerId === userId)
      .filter((book) => !category || (book.category || categoryOf(book.subject)) === category)
      .filter((book) => !needle || `${book.title} ${book.subject} ${book.category || categoryOf(book.subject)}`.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((book) => this.enrichBook(book))
  }

  async findBookById(id) {
    const book = this.books.find((item) => item.id === id)
    return book ? this.enrichBook(book) : null
  }

  async createBook(ownerId, input) {
    const book = {
      id: randomUUID(),
      ownerId,
      ...input,
      category: input.category,
      status: 'AVAILABLE',
      createdAt: now(),
    }
    this.books.push(book)
    return this.enrichBook(book)
  }

  async setPreference(userId, bookId, preference) {
    const existing = this.preferences.find((item) => item.userId === userId && item.bookId === bookId)
    if (existing) existing.preference = preference
    else this.preferences.push({ id: randomUUID(), userId, bookId, preference, createdAt: now() })
    return { bookId, preference }
  }

  async recommendations(userId) {
    const user = this.users.find((item) => item.id === userId)
    if (!user) return []
    return this.books
      .filter((book) => book.ownerId !== userId && book.status === 'AVAILABLE')
      .map((book) => {
        const pref = this.preferences.find((item) => item.userId === userId && item.bookId === book.id)
        return { ...this.enrichBook(book), ...calculateScore(book, user, pref?.preference), preference: pref?.preference || null }
      })
      .filter((book) => !this.preferences.some((item) => item.userId === userId && item.bookId === book.id && item.preference === 'DISLIKE'))
      .sort((a, b) => b.score - a.score)
  }

  async likedBooks(userId) {
    const likedIds = new Set(this.preferences.filter((item) => item.userId === userId && item.preference === 'LIKE').map((item) => item.bookId))
    return this.books.filter((book) => likedIds.has(book.id)).map((book) => this.enrichBook(book))
  }

  async createRequest(requesterId, input) {
    const offered = this.books.find((book) => book.id === input.offeredBookId)
    const requested = this.books.find((book) => book.id === input.requestedBookId)
    if (!offered || !requested) throw conflict('ไม่พบหนังสือ', 404)
    if (offered.ownerId !== requesterId || requested.ownerId === requesterId) throw conflict('ไม่สามารถเสนอแลกหนังสือคู่นี้ได้', 403)
    if (offered.status !== 'AVAILABLE' || requested.status !== 'AVAILABLE') throw conflict('หนังสือบางเล่มไม่พร้อมแลกแล้ว')
    if (this.requests.some((item) => item.requesterId === requesterId && item.requestedBookId === input.requestedBookId && item.status === 'PENDING')) throw conflict('คุณส่งคำขอสำหรับหนังสือเล่มนี้แล้ว')
    const request = {
      id: randomUUID(),
      requesterId,
      ...input,
      ...loanTerms(input),
      message: input.message || '',
      status: 'PENDING',
      createdAt: now(),
      updatedAt: now(),
    }
    this.requests.push(request)
    return this.enrichRequest(request)
  }

  enrichRequest(request) {
    return {
      ...request,
      requester: { id: request.requesterId, name: this.users.find((user) => user.id === request.requesterId)?.name },
      offeredBook: this.enrichBook(this.books.find((book) => book.id === request.offeredBookId)),
      requestedBook: this.enrichBook(this.books.find((book) => book.id === request.requestedBookId)),
    }
  }

  async listRequests(userId) {
    return this.requests
      .filter((request) => {
        const requestedBook = this.books.find((book) => book.id === request.requestedBookId)
        return request.requesterId === userId || requestedBook?.ownerId === userId
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => this.enrichRequest(request))
  }

  async findRequestById(id) {
    const request = this.requests.find((item) => item.id === id)
    return request ? this.enrichRequest(request) : null
  }

  async updateRequestStatus(id, status, actorId) {
    const request = this.requests.find((item) => item.id === id)
    if (!request) return null
    const offered = this.books.find((book) => book.id === request.offeredBookId)
    const requested = this.books.find((book) => book.id === request.requestedBookId)
    const result = transitionLoan(request, status, actorId, offered, requested)
    Object.assign(request, result.request)
    if (result.bookStatus) offered.status = requested.status = result.bookStatus
    if (status === 'ACCEPTED') {
      const ids = new Set([offered.id, requested.id])
      for (const other of this.requests) {
        if (other.id !== id && other.status === 'PENDING' && (ids.has(other.offeredBookId) || ids.has(other.requestedBookId))) {
          other.status = 'CANCELLED'; other.updatedAt = now()
        }
      }
    }
    return this.enrichRequest(request)
  }

  async saveLocation(userId, location) {
    this.users.find((user) => user.id === userId).location = location
    return this.findUserById(userId)
  }
  async discoveryContext(userId) {
    return { user: await this.findUserById(userId), users: this.users.map(({ id, name, location }) => ({ id, name, location })), books: this.books.map((book) => ({ ...book, category: book.category || categoryOf(book.subject) })), preferences: this.preferences }
  }
  async recordSwipe(event) { this.swipeEvents.push({ ...event, createdAt: now() }) }
  async createConversation(firstId, secondId) {
    const participants = [firstId, secondId].sort()
    let room = this.conversations.find((item) => item.participants.join('|') === participants.join('|'))
    if (!room) { room = { id: randomUUID(), participants, createdAt: now() }; this.conversations.push(room) }
    return room
  }
  async listConversations(userId) {
    return this.conversations.filter((room) => room.participants.includes(userId)).map((room) => ({ ...room, peer: { id: room.participants.find((id) => id !== userId), name: this.users.find((user) => room.participants.includes(user.id) && user.id !== userId)?.name } }))
  }
  async conversationMessages(roomId, userId) {
    if (!this.conversations.some((room) => room.id === roomId && room.participants.includes(userId))) throw conflict('ไม่พบห้องสนทนา', 404)
    return this.messages.filter((message) => message.conversationId === roomId).slice(-100)
  }
  async sendMessage(roomId, userId, text) {
    await this.conversationMessages(roomId, userId)
    const message = { id: randomUUID(), conversationId: roomId, senderId: userId, text, createdAt: now() }
    this.messages.push(message)
    return message
  }

}

function mapUser(row, includePassword = false) {
  if (!row) return null
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    educationLevel: row.education_level,
    interests: row.interests || [],
    location: row.search_location || null,
    createdAt: row.created_at,
  }
  if (includePassword) user.passwordHash = row.password_hash
  return user
}

function mapBook(row) {
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    subject: row.subject,
    category: row.category || categoryOf(row.subject),
    educationLevel: row.education_level,
    condition: row.condition,
    description: row.description,
    imageUrl: row.image_url,
    status: row.status,
    createdAt: row.created_at,
    owner: row.owner_name ? { id: row.owner_id, name: row.owner_name } : undefined,
  }
}

export class PostgresStore {
  constructor(connectionString) {
    const databaseUrl = new URL(connectionString)
    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      if (databaseUrl.searchParams.has(option)) throw new Error(`Remove ${option} from DATABASE_URL; use DATABASE_SSL_MODE instead`)
    }
    const hostname = databaseUrl.hostname
    const sslMode = process.env.DATABASE_SSL_MODE || (['localhost', '127.0.0.1', '::1'].includes(hostname) ? 'disable' : 'verify-full')
    if (!['disable', 'verify-full'].includes(sslMode)) throw new Error('DATABASE_SSL_MODE must be disable or verify-full')
    this.pool = new Pool({ connectionString, ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true, servername: hostname } })
  }

  async initialize() {
    const { readFile } = await import('node:fs/promises')
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
    await this.pool.query(schema)
    await this.pool.query(await readFile(new URL('./reading-schema.sql', import.meta.url), 'utf8'))
  }

  async healthCheck() {
    await this.pool.query('SELECT 1')
    return 'postgresql'
  }

  async findUserByEmail(email) {
    const result = await this.pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    return mapUser(result.rows[0], true)
  }

  async findUserById(id) {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id])
    return mapUser(result.rows[0])
  }

  async createUser(input) {
    const result = await this.pool.query(
      `INSERT INTO users (name, email, password_hash, education_level, interests)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.name, input.email.toLowerCase(), input.passwordHash, input.educationLevel, input.interests],
    )
    return mapUser(result.rows[0])
  }

  async listBooks({ search = '', category = '', userId = '' } = {}) {
    const result = await this.pool.query(
      `SELECT b.*, u.name AS owner_name FROM books b JOIN users u ON u.id = b.owner_id
       WHERE ($1::uuid IS NULL OR b.owner_id = $1::uuid)
         AND ($2::text IS NULL OR b.category = $2)
         AND ($3::text IS NULL OR LOWER(b.title || ' ' || b.subject || ' ' || b.category) LIKE '%' || LOWER($3) || '%')
       ORDER BY b.created_at DESC`,
      [userId || null, category || null, search || null],
    )
    return result.rows.map(mapBook)
  }

  async findBookById(id) {
    const result = await this.pool.query(
      'SELECT b.*, u.name AS owner_name FROM books b JOIN users u ON u.id = b.owner_id WHERE b.id = $1',
      [id],
    )
    return mapBook(result.rows[0])
  }

  async createBook(ownerId, input) {
    const result = await this.pool.query(
      `INSERT INTO books (owner_id, title, subject, category, education_level, condition, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [ownerId, input.title, input.subject, input.category, input.educationLevel, input.condition, input.description, input.imageUrl],
    )
    return this.findBookById(result.rows[0].id)
  }

  async setPreference(userId, bookId, preference) {
    await this.pool.query(
      `INSERT INTO book_preferences (user_id, book_id, preference) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, book_id) DO UPDATE SET preference = EXCLUDED.preference`,
      [userId, bookId, preference],
    )
    return { bookId, preference }
  }

  async recommendations(userId) {
    const user = await this.findUserById(userId)
    const books = await this.listBooks()
    const prefResult = await this.pool.query('SELECT book_id, preference FROM book_preferences WHERE user_id = $1', [userId])
    const preferences = new Map(prefResult.rows.map((row) => [row.book_id, row.preference]))
    return books
      .filter((book) => book.ownerId !== userId && book.status === 'AVAILABLE' && preferences.get(book.id) !== 'DISLIKE')
      .map((book) => ({ ...book, ...calculateScore(book, user, preferences.get(book.id)), preference: preferences.get(book.id) || null }))
      .sort((a, b) => b.score - a.score)
  }

  async likedBooks(userId) {
    const result = await this.pool.query(
      `SELECT b.*, u.name AS owner_name FROM book_preferences p
       JOIN books b ON b.id = p.book_id JOIN users u ON u.id = b.owner_id
       WHERE p.user_id = $1 AND p.preference = 'LIKE'`,
      [userId],
    )
    return result.rows.map(mapBook)
  }

  async createRequest(requesterId, input) {
    const client = await this.pool.connect()
    let id
    const terms = loanTerms(input)
    try {
      await client.query('BEGIN')
      const { rows: books } = await client.query('SELECT id, owner_id, status FROM books WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', [input.offeredBookId, input.requestedBookId])
      const offered = books.find((book) => book.id === input.offeredBookId)
      const requested = books.find((book) => book.id === input.requestedBookId)
      if (!offered || !requested) throw conflict('ไม่พบหนังสือ', 404)
      if (offered.owner_id !== requesterId || requested.owner_id === requesterId) throw conflict('ไม่สามารถเสนอแลกหนังสือคู่นี้ได้', 403)
      if (offered.status !== 'AVAILABLE' || requested.status !== 'AVAILABLE') throw conflict('หนังสือบางเล่มไม่พร้อมแลกแล้ว')
      const existing = await client.query("SELECT id FROM exchange_requests WHERE requester_id = $1 AND requested_book_id = $2 AND status = 'PENDING'", [requesterId, input.requestedBookId])
      if (existing.rowCount) throw conflict('คุณส่งคำขอสำหรับหนังสือเล่มนี้แล้ว')
      const result = await client.query(
        `INSERT INTO exchange_requests (requester_id, offered_book_id, requested_book_id, message, loan_days, meeting_place, meeting_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [requesterId, input.offeredBookId, input.requestedBookId, input.message || '', terms.loanDays, terms.meetingPlace, terms.meetingAt],
      )
      id = result.rows[0].id
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
    return this.findRequestById(id)
  }

  async requestRows(where, values) {
    const result = await this.pool.query(
      `SELECT r.*, requester.name AS requester_name,
        ob.title AS offered_title, ob.owner_id AS offered_owner_id,
        rb.title AS requested_title, rb.owner_id AS requested_owner_id,
        requested_owner.name AS requested_owner_name
       FROM exchange_requests r
       JOIN users requester ON requester.id = r.requester_id
       JOIN books ob ON ob.id = r.offered_book_id
       JOIN books rb ON rb.id = r.requested_book_id
       JOIN users requested_owner ON requested_owner.id = rb.owner_id
       ${where} ORDER BY r.created_at DESC`,
      values,
    )
    return result.rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      offeredBookId: row.offered_book_id,
      requestedBookId: row.requested_book_id,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      loanDays: row.loan_days, meetingPlace: row.meeting_place, meetingAt: row.meeting_at,
      dueAt: row.due_at, receivedBy: row.received_by, returnedBy: row.returned_by,
      requester: { id: row.requester_id, name: row.requester_name },
      offeredBook: { id: row.offered_book_id, title: row.offered_title, ownerId: row.offered_owner_id },
      requestedBook: { id: row.requested_book_id, title: row.requested_title, ownerId: row.requested_owner_id, owner: { name: row.requested_owner_name } },
    }))
  }

  async listRequests(userId) {
    return this.requestRows('WHERE r.requester_id = $1 OR rb.owner_id = $1', [userId])
  }

  async findRequestById(id) {
    const rows = await this.requestRows('WHERE r.id = $1', [id])
    return rows[0] || null
  }

  async updateRequestStatus(id, status, actorId) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const initial = await client.query('SELECT * FROM exchange_requests WHERE id = $1', [id])
      if (!initial.rows[0]) { await client.query('ROLLBACK'); return null }
      const { offered_book_id: offeredId, requested_book_id: requestedId } = initial.rows[0]
      // Always lock books in the same order before locking requests, including competing requests.
      const { rows: books } = await client.query('SELECT * FROM books WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', [offeredId, requestedId])
      const { rows: [row] } = await client.query('SELECT * FROM exchange_requests WHERE id = $1 FOR UPDATE', [id])
      const offered = mapBook(books.find((book) => book.id === offeredId))
      const requested = mapBook(books.find((book) => book.id === requestedId))
      const result = transitionLoan({ status: row.status, requesterId: row.requester_id, loanDays: row.loan_days, receivedBy: row.received_by, returnedBy: row.returned_by, dueAt: row.due_at }, status, actorId, offered, requested)
      await client.query('UPDATE exchange_requests SET status = $1, received_by = $2, returned_by = $3, due_at = $4, updated_at = NOW() WHERE id = $5', [result.request.status, JSON.stringify(result.request.receivedBy), JSON.stringify(result.request.returnedBy), result.request.dueAt, id])
      const bookStatus = result.bookStatus
      if (bookStatus) await client.query('UPDATE books SET status = $1 WHERE id IN ($2, $3)', [bookStatus, offeredId, requestedId])
      if (status === 'ACCEPTED') {
        await client.query(`UPDATE exchange_requests SET status = 'CANCELLED', updated_at = NOW()
          WHERE id <> $1 AND status = 'PENDING'
          AND (offered_book_id IN ($2, $3) OR requested_book_id IN ($2, $3))`, [id, offeredId, requestedId])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
    return this.findRequestById(id)
  }

  async saveLocation(userId, location) {
    await this.pool.query('UPDATE users SET search_location = $1 WHERE id = $2', [location ? JSON.stringify(location) : null, userId])
    return this.findUserById(userId)
  }
  async discoveryContext(userId) {
    const [user, users, books, preferences] = await Promise.all([this.findUserById(userId), this.pool.query('SELECT id, name, search_location FROM users'), this.listBooks(), this.pool.query('SELECT user_id, book_id, preference FROM book_preferences')])
    return { user, users: users.rows.map((row) => ({ id: row.id, name: row.name, location: row.search_location })), books, preferences: preferences.rows.map((row) => ({ userId: row.user_id, bookId: row.book_id, preference: row.preference })) }
  }
  async recordSwipe(event) {
    await this.pool.query('INSERT INTO swipe_events (user_id, book_id, subject_match, level_match, distance_km, label) VALUES ($1,$2,$3,$4,$5,$6)', [event.userId,event.bookId,event.subjectMatch,event.levelMatch,event.distanceKm,event.label])
  }
  async createConversation(firstId, secondId) {
    const [a,b] = [firstId, secondId].sort()
    const result = await this.pool.query('INSERT INTO conversations (first_user_id, second_user_id) VALUES ($1,$2) ON CONFLICT (first_user_id,second_user_id) DO UPDATE SET first_user_id = EXCLUDED.first_user_id RETURNING *', [a,b])
    return { id: result.rows[0].id, participants: [a,b] }
  }
  async listConversations(userId) {
    const result = await this.pool.query(`SELECT c.*, u.id AS peer_id, u.name AS peer_name FROM conversations c JOIN users u ON u.id = CASE WHEN c.first_user_id=$1 THEN c.second_user_id ELSE c.first_user_id END WHERE c.first_user_id=$1 OR c.second_user_id=$1 ORDER BY c.created_at DESC`, [userId])
    return result.rows.map((row) => ({ id: row.id, participants: [row.first_user_id,row.second_user_id], peer: { id: row.peer_id, name: row.peer_name } }))
  }
  async conversationMessages(roomId, userId) {
    const room = await this.pool.query('SELECT id FROM conversations WHERE id=$1 AND (first_user_id=$2 OR second_user_id=$2)', [roomId,userId])
    if (!room.rowCount) throw conflict('ไม่พบห้องสนทนา',404)
    const result = await this.pool.query('SELECT * FROM (SELECT * FROM chat_messages WHERE conversation_id=$1 ORDER BY created_at DESC, id DESC LIMIT 100) latest ORDER BY created_at,id', [roomId])
    return result.rows.map((row) => ({ id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, text: row.body, createdAt: row.created_at }))
  }
  async sendMessage(roomId, userId, text) {
    await this.conversationMessages(roomId,userId)
    const result = await this.pool.query('INSERT INTO chat_messages (conversation_id,sender_id,body) VALUES ($1,$2,$3) RETURNING *', [roomId,userId,text])
    const row = result.rows[0]
    return { id: row.id, conversationId: roomId, senderId: userId, text, createdAt: row.created_at }
  }

}

export function createStore(databaseUrl) {
  return databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore()
}
