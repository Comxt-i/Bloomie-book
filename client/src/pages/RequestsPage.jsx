import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const labels={PENDING:'รอตอบรับ',ACCEPTED:'นัดรับหนังสือ',ACTIVE:'กำลังแลกกันอ่าน',COMPLETED:'คืนครบแล้ว',REJECTED:'ปฏิเสธแล้ว',CANCELLED:'ยกเลิกแล้ว'}
const format=(value)=>value?new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'ยังไม่ได้ระบุ'
export default function RequestsPage(){
  const {user}=useAuth();const navigate=useNavigate()
  const [requests,setRequests]=useState([]),[tab,setTab]=useState('active'),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
  async function load(){try{setRequests((await api('/exchange-requests/mine')).requests);setError('')}catch(err){setError(err.message)}finally{setLoading(false)}}
  const [clock,setClock]=useState(()=>Date.now())
  useEffect(()=>{load();const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer)},[])
  async function update(id,status){if(busy)return;setBusy(true);setError('');try{await api(`/exchange-requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});await load()}catch(err){setError(err.message)}finally{setBusy(false)}}
  async function chat(request){setBusy(true);try{const peerId=request.requesterId===user.id?request.requestedBook.ownerId:request.requesterId;const {conversation}=await api('/conversations',{method:'POST',body:JSON.stringify({peerId})});navigate(`/chats?room=${conversation.id}`)}catch(err){setError(err.message)}finally{setBusy(false)}}
  const visible=requests.filter((request)=>tab==='active'?['ACCEPTED','ACTIVE'].includes(request.status):tab==='incoming'?request.requestedBook.ownerId===user.id:request.requesterId===user.id)
  return <section className="page-container"><div className="page-heading"><div><span className="eyebrow">READ. MEET. RETURN.</span><h1>แลกอ่าน แล้วคืนกัน</h1><p>ยืนยันรับและรับคืนทั้งสองฝ่าย หนังสือจะกลับมาพร้อมแลกอ่านอีกครั้ง</p></div><button className="button secondary" disabled={busy} onClick={load}>รีเฟรชสถานะ</button></div>{error&&<div className="alert alert-error" role="alert">{error}</div>}
    <div className="tabs"><button className={tab==='active'?'active':''} onClick={()=>setTab('active')}>กำลังแลกอ่าน</button><button className={tab==='incoming'?'active':''} onClick={()=>setTab('incoming')}>คำขอที่ได้รับ</button><button className={tab==='outgoing'?'active':''} onClick={()=>setTab('outgoing')}>คำขอที่ส่ง</button></div>
    {loading?<div className="empty-state">กำลังโหลด...</div>:!visible.length?<div className="empty-state"><h2>ยังไม่มีรายการในส่วนนี้</h2><p>เริ่มจากหนังสือใกล้คุณ แล้วส่งคำขอแลกอ่าน</p><Link className="button" to="/discover">ปัดเลือกหนังสือ</Link></div>:<div className="request-list">{visible.map((request)=>{
      const incoming=request.requestedBook.ownerId===user.id
      const received=request.receivedBy||[],returned=request.returnedBy||[]
      const overdue=request.status==='ACTIVE'&&request.dueAt&&clock>new Date(request.dueAt).getTime()
      return <article className="request-card" key={request.id}><div className="request-top"><span className={`status status-${request.status.toLowerCase()}`}>{labels[request.status]}</span><time>{new Date(request.createdAt).toLocaleDateString('th-TH')}</time></div>
        <div className="exchange-books"><div><small>คุณจะอ่าน</small><b>{incoming?request.offeredBook.title:request.requestedBook.title}</b></div><span aria-hidden="true">⇄</span><div><small>เล่มของคุณที่ให้ยืม</small><b>{incoming?request.requestedBook.title:request.offeredBook.title}</b></div></div>
        <div className="loan-terms"><p><b>จุดนัดรับ / คืน:</b> {request.meetingPlace||'รายการเดิม: กรุณาตกลงกันในแชท'}</p><p><b>นัดรับ:</b> {format(request.meetingAt)}</p><p><b>ระยะเวลาอ่าน:</b> {request.loanDays||14} วัน นับเมื่อยืนยันรับครบสองฝ่าย</p>{request.dueAt&&<p className={overdue?'overdue':''}><b>{overdue?'เลยกำหนดคืน:':'กำหนดคืน:'}</b> {format(request.dueAt)}</p>}</div>
        {request.message&&<blockquote>{request.message}</blockquote>}
        {request.status==='ACCEPTED'&&<p className="confirmation-note">ยืนยันได้รับหนังสือแล้ว {received.length}/2 ฝ่าย{received.includes(user.id)?' · รออีกฝ่ายยืนยัน':''}</p>}
        {request.status==='ACTIVE'&&<p className="confirmation-note">เจ้าของยืนยันได้รับเล่มของตัวเองคืนแล้ว {returned.length}/2 ฝ่าย{returned.includes(user.id)?' · รออีกฝ่ายยืนยัน':''}</p>}
        <div className="request-actions">
          {incoming&&request.status==='PENDING'&&<><button disabled={busy} className="button secondary" onClick={()=>update(request.id,'REJECTED')}>ปฏิเสธ</button><button disabled={busy} className="button" onClick={()=>update(request.id,'ACCEPTED')}>ตอบรับเงื่อนไขแลกอ่าน</button></>}
          {request.status==='ACCEPTED'&&!received.includes(user.id)&&<button disabled={busy} className="button" onClick={()=>update(request.id,'RECEIVED')}>ฉันได้รับหนังสือที่จะอ่านแล้ว</button>}
          {request.status==='ACTIVE'&&!returned.includes(user.id)&&<button disabled={busy} className="button" onClick={()=>update(request.id,'RETURNED')}>ฉันได้รับเล่มของตัวเองคืนแล้ว</button>}
          {['ACCEPTED','ACTIVE','COMPLETED'].includes(request.status)&&<button disabled={busy} className="button secondary" onClick={()=>chat(request)}>แชทนัดหมาย</button>}
          {['PENDING','ACCEPTED'].includes(request.status)&&received.length===0&&<button disabled={busy} className="button secondary" onClick={()=>update(request.id,'CANCELLED')}>ยกเลิกคำขอ</button>}
        </div>
      </article>
    })}</div>}
  </section>
}
