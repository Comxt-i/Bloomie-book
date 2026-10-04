import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { BOOK_CATEGORIES } from '../categories'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', interests: [] })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { acceptSession } = useAuth()
  const navigate = useNavigate()

  function toggleInterest(category) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(category) ? current.interests.filter((item) => item !== category) : [...current.interests, category],
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      acceptSession(await api('/auth/register', { method: 'POST', body: JSON.stringify(form) }))
      navigate('/location')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-intro"><span className="eyebrow">เริ่มต้นกับ PUN AAN</span><h1>เจอเพื่อนอ่าน<br />ใกล้ตัวคุณ</h1><p>เลือกแนวหนังสือที่ชอบ เพื่อให้เราแนะนำเล่มใกล้ตัวที่ตรงใจคุณ</p></div>
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>สมัครสมาชิก</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <label>ชื่อที่แสดง<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>อีเมล<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>รหัสผ่าน <small>อย่างน้อย 8 ตัวอักษร</small><input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <fieldset><legend>หมวดหนังสือที่สนใจ (เลือกได้หลายหมวด)</legend><div className="choice-grid">{BOOK_CATEGORIES.map((category) => <button key={category} type="button" className={form.interests.includes(category) ? 'choice active' : 'choice'} onClick={() => toggleInterest(category)}>{form.interests.includes(category) ? '✓ ' : ''}{category}</button>)}</div></fieldset>
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}</button>
        <p className="form-switch">มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link></p>
      </form>
    </section>
  )
}
