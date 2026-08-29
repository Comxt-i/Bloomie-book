import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const subjects = ['คณิตศาสตร์', 'ภาษาอังกฤษ', 'ชีววิทยา', 'เคมี', 'ฟิสิกส์', 'TGAT']

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', educationLevel: 'ม.6', interests: [] })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { acceptSession } = useAuth()
  const navigate = useNavigate()

  function toggleInterest(subject) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(subject) ? current.interests.filter((item) => item !== subject) : [...current.interests, subject],
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      acceptSession(await api('/auth/register', { method: 'POST', body: JSON.stringify(form) }))
      navigate('/books')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-intro"><span className="eyebrow">เริ่มต้นกับ PUN AAN</span><h1>เปลี่ยนหนังสือ<br />เป็นโอกาสใหม่</h1><p>บอกเราสักนิดว่าคุณกำลังเรียนอะไร เพื่อให้คำแนะนำเหมาะกับคุณ</p></div>
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>สมัครสมาชิก</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field-row"><label>ชื่อที่แสดง<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>ระดับการศึกษา<select value={form.educationLevel} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}><option>ม.4</option><option>ม.5</option><option>ม.6</option><option>มหาวิทยาลัย</option></select></label></div>
        <label>อีเมล<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>รหัสผ่าน <small>อย่างน้อย 8 ตัวอักษร</small><input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <fieldset><legend>วิชาที่สนใจ</legend><div className="choice-grid">{subjects.map((subject) => <button key={subject} type="button" className={form.interests.includes(subject) ? 'choice active' : 'choice'} onClick={() => toggleInterest(subject)}>{form.interests.includes(subject) ? '✓ ' : ''}{subject}</button>)}</div></fieldset>
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}</button>
        <p className="form-switch">มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link></p>
      </form>
    </section>
  )
}
