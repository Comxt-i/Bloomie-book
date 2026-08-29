import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function NewBookPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', subject: 'คณิตศาสตร์', educationLevel: user.educationLevel, condition: 'ดีมาก', description: '', imageUrl: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api('/books', { method: 'POST', body: JSON.stringify(form) })
      navigate('/books', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <section className="page-container narrow">
      <Link className="back-link" to="/books">← กลับไปค้นหาหนังสือ</Link>
      <div className="page-heading"><div><span className="eyebrow">แบ่งปันเล่มที่คุณอ่านจบ</span><h1>ลงหนังสือใหม่</h1><p>ข้อมูลที่ชัดเจนช่วยให้คนที่เหมาะเจอหนังสือของคุณเร็วขึ้น</p></div></div>
      <form className="form-card book-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <label>ชื่อหนังสือ<input placeholder="เช่น สรุปคณิตศาสตร์ ม.ปลาย" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
        <div className="field-row"><label>วิชา<select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option>คณิตศาสตร์</option><option>ภาษาอังกฤษ</option><option>ชีววิทยา</option><option>เคมี</option><option>ฟิสิกส์</option><option>TGAT</option><option>อื่น ๆ</option></select></label><label>ระดับ<select value={form.educationLevel} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}><option>ม.4</option><option>ม.5</option><option>ม.6</option><option>มหาวิทยาลัย</option></select></label></div>
        <label>สภาพหนังสือ<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option>เหมือนใหม่</option><option>ดีมาก</option><option>ดี</option><option>มีรอยเขียน</option></select></label>
        <label>รายละเอียด<textarea rows="4" placeholder="บอกเกี่ยวกับรอยเขียน หน้าที่ขาด หรือจุดเด่นของหนังสือ" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>URL รูปปก <small>ไม่บังคับ</small><input type="url" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></label>
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังลงหนังสือ...' : 'ลงหนังสือให้คนอื่นค้นพบ'}</button>
      </form>
    </section>
  )
}
