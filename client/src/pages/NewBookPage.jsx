import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { BOOK_CATEGORIES } from '../categories'

export default function NewBookPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', category: '', condition: 'ดีมาก', description: '', imageUrl: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api('/books', { method: 'POST', body: JSON.stringify(form) })
      navigate('/books/mine', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <section className="page-container narrow">
      <Link className="back-link" to="/books">← กลับไปค้นหาหนังสือ</Link>
      <div className="page-heading"><div><span className="eyebrow">เล่มที่พร้อมให้เพื่อนยืมอ่าน</span><h1>ลงหนังสือใหม่</h1><p>ข้อมูลที่ชัดเจนช่วยให้คนที่เหมาะเจอหนังสือของคุณเร็วขึ้น</p></div></div>
      <form className="form-card book-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <label>ชื่อหนังสือ<input placeholder="เช่น นิยายเล่มโปรด หรือหนังสือจัดการเวลา" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
        <label>หมวดหนังสือ<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required><option value="">เลือกหมวดหนังสือ</option>{BOOK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label>สภาพหนังสือ<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option>เหมือนใหม่</option><option>ดีมาก</option><option>ดี</option><option>มีรอยเขียน</option></select></label>
        <label>รายละเอียด<textarea rows="4" placeholder="บอกเกี่ยวกับรอยเขียน หน้าที่ขาด หรือจุดเด่นของหนังสือ" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>URL รูปปก <small>ไม่บังคับ</small><input type="url" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></label>
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังลงหนังสือ...' : 'ลงหนังสือสำหรับแลกอ่าน'}</button>
      </form>
    </section>
  )
}
