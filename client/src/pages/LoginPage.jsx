import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form, setForm] = useState({ email: 'natcha@demo.com', password: 'demo1234' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { acceptSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      acceptSession(await api('/auth/login', { method: 'POST', body: JSON.stringify(form) }))
      navigate(location.state?.from || '/books')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-intro"><span className="eyebrow">ยินดีต้อนรับกลับมา</span><h1>หนังสือดี ๆ<br />กำลังรอคุณอยู่</h1><p>เข้าสู่ระบบเพื่อดูคำแนะนำและติดตามคำขอแลกเปลี่ยน</p></div>
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>เข้าสู่ระบบ</h2>
        <p className="form-help">บัญชีทดลองถูกกรอกไว้ให้แล้ว กดเข้าสู่ระบบได้ทันที</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>อีเมล<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>รหัสผ่าน<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        <p className="form-switch">ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link></p>
      </form>
    </section>
  )
}
