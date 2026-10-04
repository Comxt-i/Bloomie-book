import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function ExchangeForm({ book, myBooks, onSent }) {
  const [offerId,setOfferId] = useState(myBooks[0]?.id || '')
  const [meetingPlace,setMeetingPlace] = useState('')
  const [meetingAt,setMeetingAt] = useState('')
  const [loanDays,setLoanDays] = useState(14)
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function submit(event) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try {
      await api('/exchange-requests',{method:'POST',body:JSON.stringify({offeredBookId:offerId,requestedBookId:book.id,meetingPlace,meetingAt:new Date(meetingAt).toISOString(),loanDays,message})})
      onSent()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  if (!myBooks.length) return <div className="empty-state compact"><p>ลงหนังสือที่พร้อมให้ยืมอ่านก่อน แล้วจึงเลือกเล่มมาแลกกัน</p><Link className="button" to="/books/new">ลงหนังสือของฉัน</Link></div>
  return <form onSubmit={submit}>
    <p className="form-help">เป็นการแลกอ่านชั่วคราว หนังสือยังเป็นของเจ้าของเดิม อีกฝ่ายจะเห็นวันนัดและระยะเวลาอ่านก่อนตอบรับ</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <label>เล่มที่คุณให้ยืมอ่าน<select required value={offerId} disabled={busy} onChange={(e)=>setOfferId(e.target.value)}>{myBooks.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <label>จุดนัดรับและคืน<input required maxLength={200} placeholder="เช่น หน้าห้องสมุดกลาง" value={meetingPlace} onChange={(e)=>setMeetingPlace(e.target.value)} disabled={busy}/></label>
    <div className="field-row"><label>วันและเวลานัดรับ<input type="datetime-local" required value={meetingAt} onChange={(e)=>setMeetingAt(e.target.value)} disabled={busy}/></label><label>ระยะเวลาอ่าน<select value={loanDays} onChange={(e)=>setLoanDays(Number(e.target.value))} disabled={busy}>{[7,14,21,30].map((days)=><option key={days} value={days}>{days} วัน</option>)}</select></label></div>
    <label>ข้อความถึงเจ้าของหนังสือ<textarea rows={2} maxLength={1000} value={message} onChange={(e)=>setMessage(e.target.value)} disabled={busy}/></label>
    <button className="button button-full" disabled={busy}>{busy?'กำลังส่ง...':'ส่งคำขอแลกอ่าน'}</button>
  </form>
}
