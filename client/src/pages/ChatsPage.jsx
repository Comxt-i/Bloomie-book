import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function ChatsPage() {
  const {user}=useAuth()
  const [params,setParams]=useSearchParams()
  const roomId=params.get('room')
  const [rooms,setRooms]=useState([])
  const [messages,setMessages]=useState([])
  const [text,setText]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    let active=true
    api('/conversations').then(({conversations})=>{if(active)setRooms(conversations)}).catch((err)=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  useEffect(()=>{
    if(!roomId){setMessages([]);return}
    let active=true;let pending=false
    setMessages([]);setText('');setError('')
    async function refresh(){if(pending)return;pending=true;try{const result=await api(`/conversations/${roomId}/messages`);if(active){setMessages(result.messages);setError('')}}catch(err){if(active)setError(err.message)}finally{pending=false}}
    refresh()
    const timer=setInterval(()=>{if(!document.hidden)refresh()},5000)
    return()=>{active=false;clearInterval(timer)}
  },[roomId])
  async function send(e){
    e.preventDefault();if(busy||!text.trim())return
    setBusy(true);setError('')
    try{await api(`/conversations/${roomId}/messages`,{method:'POST',body:JSON.stringify({text})});setText('');setMessages((await api(`/conversations/${roomId}/messages`)).messages)}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const room=rooms.find((item)=>item.id===roomId)
  return <section className="page-container"><div className="page-heading"><div><span className="eyebrow">LET’S TALK BOOKS</span><h1>คุยก่อน แลกกันอ่าน</h1><p>ตกลงจุดนัดและเล่มที่จะแลก แล้วส่งคำขอเพื่อบันทึกวันรับและระยะเวลาอ่าน</p></div><Link className="button secondary" to="/discover">กลับไปเลือกหนังสือ</Link></div>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}
    {loading?<div className="empty-state">กำลังเปิดแชท...</div>:!rooms.length?<div className="empty-state"><h2>ห้องสนทนาจะเริ่มเมื่อสนใจตรงกัน</h2><p>หรือเมื่ออีกฝ่ายตอบรับคำขอแลกอ่านของคุณ</p></div>:<div className="chat-layout"><nav className="chat-rooms" aria-label="ห้องสนทนา">{rooms.map((item)=><button disabled={busy} key={item.id} className={roomId===item.id?'active':''} onClick={()=>setParams({room:item.id})}>{item.peer.name}<span>เปิดบทสนทนา →</span></button>)}</nav><div className="chat-panel">{room?<><h2>{room.peer.name}</h2><div className="chat-messages" role="log" aria-label="ข้อความสนทนา" aria-live="polite">{messages.length?messages.map((message)=><div key={message.id} className={`chat-message ${message.senderId===user.id?'mine':''}`}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleString('th-TH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>):<p className="form-help">ทักทาย แล้วคุยเรื่องหนังสือที่อยากแลกอ่านกันได้เลย</p>}</div><form className="chat-compose" onSubmit={send}><label htmlFor="chat-text">ข้อความ</label><textarea id="chat-text" rows={2} maxLength={2000} value={text} disabled={busy} onChange={(e)=>setText(e.target.value)} placeholder="สะดวกนัดรับหนังสือวันไหนบ้าง?"/><button className="button" disabled={busy||!text.trim()}>{busy?'กำลังส่ง...':'ส่งข้อความ'}</button></form></>:<div className="empty-state">เลือกห้องสนทนาเพื่อเริ่มคุย</div>}</div></div>}
  </section>
}
