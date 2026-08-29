import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import BookCard from '../components/BookCard'

export default function BooksPage() {
  const [books, setBooks] = useState([])
  const [myBooks, setMyBooks] = useState([])
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('ทั้งหมด')
  const [selectedBook, setSelectedBook] = useState(null)
  const [offerId, setOfferId] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadBooks() {
    setLoading(true)
    try {
      const [recommended, mine] = await Promise.all([api('/recommendations'), api('/books/mine')])
      setBooks(recommended.books)
      setMyBooks(mine.books.filter((book) => book.status === 'AVAILABLE'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBooks() }, [])

  const subjects = useMemo(() => ['ทั้งหมด', ...new Set(books.map((book) => book.subject))], [books])
  const filtered = books.filter((book) => {
    const matchesSearch = `${book.title} ${book.subject}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (subject === 'ทั้งหมด' || book.subject === subject)
  })

  async function setPreference(bookId, preference) {
    try {
      await api(`/books/${bookId}/preference`, { method: 'POST', body: JSON.stringify({ preference }) })
      if (preference === 'DISLIKE') setBooks((current) => current.filter((book) => book.id !== bookId))
      else setNotice('บันทึกเป็นหนังสือที่คุณสนใจแล้ว')
    } catch (err) { setError(err.message) }
  }

  async function sendRequest(event) {
    event.preventDefault()
    setError('')
    try {
      await api('/exchange-requests', { method: 'POST', body: JSON.stringify({ offeredBookId: offerId, requestedBookId: selectedBook.id, message }) })
      setNotice('ส่งคำขอแลกเรียบร้อยแล้ว ติดตามผลได้ที่หน้าคำขอแลก')
      setSelectedBook(null)
      setOfferId('')
      setMessage('')
    } catch (err) { setError(err.message) }
  }

  return (
    <section className="page-container">
      <div className="page-heading"><div><span className="eyebrow">หนังสือแนะนำสำหรับคุณ</span><h1>ค้นหาเล่มถัดไป</h1><p>เรียงจากวิชา ระดับ และความสนใจที่คุณระบุไว้</p></div><Link className="button" to="/books/new">+ ลงหนังสือของคุณ</Link></div>
      {notice && <div className="alert alert-success">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {error && <div className="alert alert-error">{error}<button onClick={() => setError('')}>×</button></div>}
      <div className="search-panel"><label className="search-box"><span>⌕</span><input placeholder="ค้นหาชื่อหนังสือหรือวิชา" value={search} onChange={(e) => setSearch(e.target.value)} /></label><div className="filter-row">{subjects.map((item) => <button key={item} className={subject === item ? 'filter active' : 'filter'} onClick={() => setSubject(item)}>{item}</button>)}</div></div>
      {loading ? <div className="empty-state">กำลังค้นหาหนังสือที่เหมาะกับคุณ...</div> : filtered.length === 0 ? <div className="empty-state"><span>⌕</span><h2>ยังไม่พบหนังสือ</h2><p>ลองเปลี่ยนคำค้นหรือเลือกวิชาอื่น</p></div> : <div className="book-grid">{filtered.map((book) => <BookCard key={book.id} book={book} showScore actions={<><button className="icon-button dislike" onClick={() => setPreference(book.id, 'DISLIKE')} title="ไม่สนใจ">×</button><button className="button button-card" onClick={() => { setSelectedBook(book); setOfferId(myBooks[0]?.id || '') }}>เสนอแลก</button><button className="icon-button like" onClick={() => setPreference(book.id, 'LIKE')} title="สนใจ">♥</button></>} />)}</div>}
      {selectedBook && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedBook(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="exchange-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedBook(null)}>×</button><span className="eyebrow">ส่งคำขอแลก</span><h2 id="exchange-title">อยากได้ “{selectedBook.title}”</h2>{myBooks.length === 0 ? <div className="empty-state compact"><p>คุณต้องลงหนังสือของตัวเองก่อนจึงจะเสนอแลกได้</p><Link className="button" to="/books/new">ลงหนังสือ</Link></div> : <form onSubmit={sendRequest}><label>เลือกหนังสือของคุณที่จะเสนอ<select value={offerId} onChange={(e) => setOfferId(e.target.value)} required>{myBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label>ข้อความถึงเจ้าของหนังสือ<textarea rows="3" placeholder="เช่น สะดวกนัดแลกที่ห้องสมุดช่วงเย็น" value={message} onChange={(e) => setMessage(e.target.value)} /></label><button className="button button-full">ส่งคำขอแลก</button></form>}</section></div>}
    </section>
  )
}
