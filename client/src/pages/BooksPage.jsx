import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import BookCard from '../components/BookCard'
import Modal from '../components/Modal'
import ExchangeForm from '../components/ExchangeForm'
import { BOOK_CATEGORIES, bookCategory } from '../categories'

export default function BooksPage() {
  const { user, loading: authLoading } = useAuth()
  const [books, setBooks] = useState([])
  const [engine, setEngine] = useState('')
  const [syntheticDemo, setSyntheticDemo] = useState(false)
  const [myBooks, setMyBooks] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ทั้งหมด')
  const [selectedBook, setSelectedBook] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyBook, setBusyBook] = useState(null)
  const [reload, setReload] = useState(0)
  const userId = user?.id

  useEffect(() => {
    if (authLoading) return
    let active = true
    setLoading(true); setError('')
    const requests = userId ? [api('/recommendations'), api('/books/mine')] : [api('/books'), Promise.resolve({ books: [] })]
    Promise.all(requests).then(([recommended, mine]) => {
      if (!active) return
      setBooks(recommended.books.filter((book) => book.status === 'AVAILABLE'))
      setEngine(recommended.engine || '')
      setSyntheticDemo(recommended.syntheticDemo === true)
      setMyBooks(mine.books.filter((book) => book.status === 'AVAILABLE'))
    }).catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, authLoading, reload])

  const filtered = books.filter((book) => `${book.title} ${book.subject} ${bookCategory(book)}`.toLowerCase().includes(search.trim().toLowerCase()) && (category === 'ทั้งหมด' || bookCategory(book) === category))
  const recommendationText = syntheticDemo
    ? 'โมเดลสาธิตจากข้อมูลจำลอง — ผลจัดอันดับไม่ใช่ความแม่นยำกับผู้ใช้จริง'
    : engine === 'content-knn'
    ? 'จัดลำดับด้วย ML จากชื่อ หมวด และเล่มที่เคยสนใจ'
    : engine && !['empty', 'interest-distance-fallback'].includes(engine)
      ? 'จัดลำดับด้วยโมเดลที่ฝึกจากการกดสนใจจริง'
      : 'เรียงตามหมวดที่คุณสนใจ'

  async function setPreference(bookId, preference) {
    if (busyBook) return
    setBusyBook(bookId); setError('')
    try {
      await api(`/books/${bookId}/preference`, { method: 'POST', body: JSON.stringify({ preference }) })
      if (preference === 'DISLIKE') {
        setBooks((current) => current.filter((book) => book.id !== bookId))
        setCategory('ทั้งหมด')
        setNotice('ซ่อนหนังสือเล่มนี้จากคำแนะนำแล้ว')
      } else {
        setBooks((current) => current.map((book) => book.id === bookId ? { ...book, preference: 'LIKE' } : book))
        setNotice('บันทึกเป็นหนังสือที่คุณสนใจแล้ว')
      }
    } catch (err) { setError(err.message) } finally { setBusyBook(null) }
  }
  function closeModal() { setSelectedBook(null) }
  function openBook(book) { setSelectedBook(book); setModalError('') }

  return <section className="page-container">
    <div className="page-heading"><div><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>ค้นหาเล่มถัดไป</h1><p>{user ? recommendationText : 'เลือกหมวดและเล่มที่ชอบ แล้วเข้าสู่ระบบเมื่อพร้อมเสนอแลก'}</p></div><Link className="button" to="/books/new">+ ลงหนังสือของฉัน</Link></div>
    {notice && <div className="alert alert-success" role="status">{notice}<button aria-label="ปิดข้อความ" onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>ลองใหม่</button></div>}
    <div className="search-panel"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="ค้นหาชื่อหนังสือหรือหมวด" placeholder="ค้นหาชื่อหนังสือหรือหมวด" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="filter-row" aria-label="กรองตามหมวดหนังสือ">{['ทั้งหมด', ...BOOK_CATEGORIES].map((item) => <button key={item} aria-pressed={category === item} className={category === item ? 'filter active' : 'filter'} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    {loading || authLoading ? <div className="empty-state" role="status">กำลังเปิดชั้นหนังสือ...</div> : !error && filtered.length === 0 ? <div className="empty-state"><span aria-hidden="true">⌕</span><h2>ยังไม่พบหนังสือ</h2><p>ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่น</p><button className="button secondary" onClick={() => { setSearch(''); setCategory('ทั้งหมด') }}>ล้างตัวกรอง</button></div> : <div className="book-grid">{filtered.map((book) => <BookCard key={book.id} book={book} showScore={Boolean(user)} actions={<>
      {user && <button className="icon-button dislike" disabled={busyBook !== null} onClick={() => setPreference(book.id, 'DISLIKE')} aria-label={`ไม่สนใจ ${book.title}`}>×</button>}
      <button className="button button-card" onClick={() => openBook(book)}>{user ? 'ดูและเสนอแลก' : 'ดูรายละเอียด'}</button>
      {user && <button className="icon-button like" disabled={busyBook !== null} onClick={() => setPreference(book.id, 'LIKE')} aria-pressed={book.preference === 'LIKE'} aria-label={`สนใจ ${book.title}`}>♥</button>}
    </>} />)}</div>}
    {selectedBook && <Modal titleId="exchange-title" onClose={closeModal}><span className="eyebrow">เล่มที่คุณสนใจ</span><h2 id="exchange-title">{selectedBook.title}</h2>
      <p className="form-help">{bookCategory(selectedBook)}{selectedBook.subject !== bookCategory(selectedBook) ? ` · ${selectedBook.subject}` : ''} · สภาพ{selectedBook.condition}<br />{selectedBook.description || 'ยังไม่มีรายละเอียดเพิ่มเติม'}<br />เจ้าของ: {selectedBook.owner?.name}</p>
      {modalError && <div className="alert alert-error" role="alert">{modalError}</div>}
      {!user ? <div className="empty-state compact"><p>เข้าสู่ระบบเพื่อเลือกหนังสือของคุณมาเสนอแลก</p><Link className="button" to="/login" state={{ from: '/books' }}>เข้าสู่ระบบเพื่อเสนอแลก ↗</Link></div> : <ExchangeForm book={selectedBook} myBooks={myBooks} onSent={() => { setSelectedBook(null); setNotice('ส่งคำขอแลกอ่านแล้ว'); setReload((n) => n + 1) }} />}

    </Modal>}
  </section>
}
