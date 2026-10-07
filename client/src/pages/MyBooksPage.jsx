import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import BookCard from '../components/BookCard'

export default function MyBooksPage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api('/books/mine').then((result) => { if (active) setBooks(result.books) }).catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return <section className="page-container"><div className="page-heading"><div><span className="eyebrow">MY LITTLE BOOKSHELF</span><h1>หนังสือของฉัน</h1><p>หนังสือยังเป็นของคุณ ติดตามว่าเล่มไหนพร้อมแลกหรืออยู่ระหว่างยืมอ่าน</p></div><Link className="button" to="/books/new">+ ลงหนังสือใหม่</Link></div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : loading ? <div className="empty-state" role="status">กำลังเปิดชั้นหนังสือ...</div> : books.length ? <div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} actions={book.status === 'AVAILABLE' ? <Link className="button button-card secondary" to={`/books/${book.id}/edit`}>แก้ไขหนังสือ</Link> : <Link className="button button-card secondary" to="/requests">ดูคำขอแลก</Link>} />)}</div> : <div className="empty-state"><h2>เริ่มชั้นหนังสือของคุณ</h2><p>ลงเล่มที่พร้อมให้ยืม แล้วหาเล่มที่คุณอยากอ่านมาแลกกัน</p><Link className="button" to="/books/new">ลงหนังสือเล่มแรก</Link></div>}
  </section>
}
