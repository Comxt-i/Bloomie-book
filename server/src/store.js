import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Pool } = pg

const now = () => new Date().toISOString()

function publicUser(user) {
  if (!user) return null
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

function calculateScore(book, user, preference) {
  let score = 1
  const reasons = []

  if (user.interests.includes(book.subject)) {
    score += 4
    reasons.push(`ตรงกับความสนใจด้าน${book.subject}`)
  }
  if (user.educationLevel === book.educationLevel) {
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
    ]
    this.preferences = []
    this.requests = []
  }

  async initialize() {}

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
    const owner = publicUser(this.users.find((user) => user.id === book.ownerId))
    return { ...book, owner }
  }

  async listBooks({ search = '', subject = '', userId = '' } = {}) {
    const needle = search.trim().toLowerCase()
    return this.books
      .filter((book) => !userId || book.ownerId === userId)
      .filter((book) => !subject || book.subject === subject)
      .filter((book) => !needle || `${book.title} ${book.subject}`.toLowerCase().includes(needle))
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
        return { ...this.enrichBook(book), ...calculateScore(book, user, pref?.preference) }
      })
      .filter((book) => !this.preferences.some((item) => item.userId === userId && item.bookId === book.id && item.preference === 'DISLIKE'))
      .sort((a, b) => b.score - a.score)
  }

  async createRequest(requesterId, input) {
    const request = {
      id: randomUUID(),
      requesterId,
      ...input,
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
      requester: publicUser(this.users.find((user) => user.id === request.requesterId)),
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

  async updateRequestStatus(id, status) {
    const request = this.requests.find((item) => item.id === id)
    if (!request) return null
    request.status = status
    request.updatedAt = now()

    const offeredBook = this.books.find((book) => book.id === request.offeredBookId)
    const requestedBook = this.books.find((book) => book.id === request.requestedBookId)
    if (status === 'ACCEPTED') {
      offeredBook.status = 'RESERVED'
      requestedBook.status = 'RESERVED'
    }
    if (status === 'COMPLETED') {
      offeredBook.status = 'EXCHANGED'
      requestedBook.status = 'EXCHANGED'
    }
    if (['REJECTED', 'CANCELLED'].includes(status)) {
      offeredBook.status = 'AVAILABLE'
      requestedBook.status = 'AVAILABLE'
    }
    return this.enrichRequest(request)
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
    this.pool = new Pool({ connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } })
  }

  async initialize() {
    const { readFile } = await import('node:fs/promises')
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
    await this.pool.query(schema)
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

  async listBooks({ search = '', subject = '', userId = '' } = {}) {
    const result = await this.pool.query(
      `SELECT b.*, u.name AS owner_name FROM books b JOIN users u ON u.id = b.owner_id
       WHERE ($1::uuid IS NULL OR b.owner_id = $1::uuid)
         AND ($2::text IS NULL OR b.subject = $2)
         AND ($3::text IS NULL OR LOWER(b.title || ' ' || b.subject) LIKE '%' || LOWER($3) || '%')
       ORDER BY b.created_at DESC`,
      [userId || null, subject || null, search || null],
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
      `INSERT INTO books (owner_id, title, subject, education_level, condition, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ownerId, input.title, input.subject, input.educationLevel, input.condition, input.description, input.imageUrl],
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
      .map((book) => ({ ...book, ...calculateScore(book, user, preferences.get(book.id)) }))
      .sort((a, b) => b.score - a.score)
  }

  async createRequest(requesterId, input) {
    const result = await this.pool.query(
      `INSERT INTO exchange_requests (requester_id, offered_book_id, requested_book_id, message)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [requesterId, input.offeredBookId, input.requestedBookId, input.message || ''],
    )
    return this.findRequestById(result.rows[0].id)
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

  async updateRequestStatus(id, status) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const requestResult = await client.query('UPDATE exchange_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id])
      if (!requestResult.rows[0]) {
        await client.query('ROLLBACK')
        return null
      }
      const bookStatus = status === 'ACCEPTED' ? 'RESERVED' : status === 'COMPLETED' ? 'EXCHANGED' : 'AVAILABLE'
      await client.query('UPDATE books SET status = $1 WHERE id IN ($2, $3)', [bookStatus, requestResult.rows[0].offered_book_id, requestResult.rows[0].requested_book_id])
      await client.query('COMMIT')
      return this.findRequestById(id)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

export function createStore(databaseUrl) {
  return databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore()
}
