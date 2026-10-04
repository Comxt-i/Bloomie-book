import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import BookCard from '../components/BookCard'
import Modal from '../components/Modal'
import ExchangeForm from '../components/ExchangeForm'
import { BOOK_CATEGORIES, bookCategory } from '../categories'

export default function DiscoverPage() {
  const navigate=useNavigate()
  const [data,setData]=useState({books:[],likedBooks:[]})
  const [myBooks,setMyBooks]=useState([])
  const [radius,setRadius]=useState(10)
  const [category,setCategory]=useState('ทั้งหมด')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [view,setView]=useState('swipe')
  const [reload,setReload]=useState(0)
  const [selected,setSelected]=useState(null)
  const [offset,setOffset]=useState(0)
  const start=useRef(null)
  const locked=useRef(false)
  useEffect(()=>{
    let active=true;setLoading(true);setError('')
    Promise.all([api(`/discovery?radiusKm=${radius}`),api('/books/mine')]).then(([result,mine])=>{if(active){setData(result);setMyBooks(mine.books.filter((book)=>book.status==='AVAILABLE'))}}).catch((err)=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[radius,reload])
  const book=data.books.find((item)=>category==='ทั้งหมด'||bookCategory(item)===category)
  const likedBooks=data.likedBooks.filter((item)=>category==='ทั้งหมด'||bookCategory(item)===category)
  async function swipe(preference) {
    if(!book||locked.current)return
    locked.current=true;setBusy(true);setOffset(0);setError('')
    try {
      const result=await api('/swipes',{method:'POST',body:JSON.stringify({bookId:book.id,preference})})
      setData((current)=>({...current,books:current.books.filter((item)=>item.id!==book.id),likedBooks:preference==='LIKE'?[result.book,...current.likedBooks.filter((item)=>item.id!==book.id)]:current.likedBooks}))
      setNotice(result.matched?'สนใจตรงกันแล้ว! ไปที่เล่มที่สนใจเพื่อเปิดแชทได้เลย':preference==='LIKE'?'เก็บไว้ในเล่มที่สนใจแล้ว คุณส่งคำขอแลกอ่านได้แม้ยังไม่แมตช์':'ผ่านเล่มนี้แล้ว')
    }catch(err){setError(err.message)}finally{locked.current=false;setBusy(false)}
  }
  async function chat(item) {
    if(busy)return
    setBusy(true);setError('')
    try{const {conversation}=await api('/conversations',{method:'POST',body:JSON.stringify({peerId:item.ownerId})});navigate(`/chats?room=${conversation.id}`)}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  function pointerEnd(event) {
    if(start.current===null)return
    const delta=event.clientX-start.current;start.current=null;setOffset(0)
    if(Math.abs(delta)>80)swipe(delta>0?'LIKE':'DISLIKE')
  }
  return <section className="page-container discovery-page"><div className="page-heading"><div><span className="eyebrow">NEARBY BOOK DATES</span><h1>ปัดเจอเล่มที่ใช่ ใกล้คุณ</h1><p>แลกกันอ่าน นัดคืนง่าย หนังสือยังเป็นของเรา</p></div><Link className="button secondary" to="/location">◎ เปลี่ยนพื้นที่</Link></div>
    <div className="discovery-toolbar"><label>ระยะค้นหา <select value={radius} onChange={(e)=>setRadius(Number(e.target.value))}>{[5,10,25,50,100].map((km)=><option key={km} value={km}>{km} กม.</option>)}</select></label><label>หมวดหนังสือ <select value={category} onChange={(e)=>setCategory(e.target.value)}><option>ทั้งหมด</option>{BOOK_CATEGORIES.map((item)=><option key={item}>{item}</option>)}</select></label><button className="text-button" onClick={()=>setReload((n)=>n+1)}>รีเฟรชคู่ที่สนใจ</button></div>
    {!loading&&!data.needsLocation&&data.engine!=='empty'&&<p className="form-help">{data.syntheticDemo?'โมเดลสาธิตจากข้อมูลจำลอง — ไม่ใช่ผลทำนายที่ยืนยันกับผู้ใช้จริง':data.engine==='content-knn'?'ML ช่วยเรียงจากชื่อ หมวด และเล่มที่เคยสนใจ':data.engine==='interest-distance-fallback'?'เรียงตามหมวดที่สนใจและระยะทาง': 'เรียงด้วยโมเดลที่ฝึกจากการกดสนใจจริง'}</p>}
    {data.demo&&<p className="demo-note">ข้อมูลสาธิตใช้พื้นที่ตัวอย่างหาดใหญ่ ไม่ใช่ตำแหน่งจริงของคุณ — เปลี่ยนพื้นที่ได้ด้านบน</p>}
    {error&&<div className="alert alert-error" role="alert">{error}</div>}{notice&&<div className="alert alert-success" role="status">{notice}</div>}
    {loading?<div className="empty-state" role="status">กำลังหาเล่มใกล้คุณ...</div>:data.needsLocation?<div className="empty-state"><h2>เริ่มจากพื้นที่ที่คุณสะดวก</h2><p>เราจะค้นหาเฉพาะหนังสือที่อยู่ในระยะนัดรับและคืนได้ง่าย</p><Link className="button" to="/location">เลือกพื้นที่ค้นหา</Link></div>:<>
      <div className="tabs"><button className={view==='swipe'?'active':''} onClick={()=>setView('swipe')}>ปัดเลือกหนังสือ</button><button className={view==='liked'?'active':''} onClick={()=>setView('liked')}>เล่มที่สนใจ ({likedBooks.length})</button></div>
      {view==='swipe'?<div className="swipe-layout"><div className="swipe-stage">
        {book?<><div className="distance-tag">◎ ห่างประมาณ {book.distanceKm<0.5?'ไม่เกิน 0.5':book.distanceKm} กม.</div><div className="swipe-card" tabIndex={0} aria-label="การ์ดหนังสือ ปัดขวาเพื่อสนใจ ปัดซ้ายเพื่อผ่าน" style={{transform:`translateX(${offset}px) rotate(${offset/22}deg)`}} onPointerDown={(e)=>{if(busy||e.button!==0)return;start.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={(e)=>{if(start.current!==null)setOffset(Math.max(-140,Math.min(140,e.clientX-start.current)))}} onPointerUp={pointerEnd} onPointerCancel={()=>{start.current=null;setOffset(0)}} onKeyDown={(e)=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();swipe(e.key==='ArrowRight'?'LIKE':'DISLIKE')}}}>
          {Math.abs(offset)>30&&<span className={`swipe-stamp ${offset>0?'yes':'no'}`}>{offset>0?'สนใจ':'ผ่าน'}</span>}<BookCard book={book} showScore/>
        </div><div className="swipe-controls"><button disabled={busy} aria-label="ผ่านหนังสือเล่มนี้" className="swipe-control pass" onClick={()=>swipe('DISLIKE')}>×<small>ผ่าน</small></button><button disabled={busy} aria-label="สนใจหนังสือเล่มนี้" className="swipe-control heart" onClick={()=>swipe('LIKE')}>♡<small>สนใจ</small></button></div><button className="text-button request-direct" onClick={()=>setSelected(book)}>ส่งคำขอแลกอ่านเล่มนี้ →</button></>:<div className="empty-state"><h2>ยังไม่มีเล่มในหมวดนี้</h2><p>ลองเปลี่ยนหมวดหรือขยายระยะค้นหา</p><button className="button secondary" onClick={()=>setCategory('ทั้งหมด')}>ดูทุกหมวด</button></div>}
      </div><aside className="swipe-guide"><span className="eyebrow">A MATCH, A NEW CHAPTER</span><h2>ชอบตรงกัน<br/>ก็เริ่มคุยกันได้</h2><p>ปัดขวาเพื่อสนใจ ปัดซ้ายเพื่อผ่าน หรือใช้ปุ่มด้านล่างแทนได้</p><div><b>♡ สนใจตรงกัน</b><p>เมื่อทั้งสองคนสนใจหนังสือของกันและกัน เปิดแชทเพื่อตกลงแลกอ่านได้ทันที</p></div><div><b>↗ สนใจฝ่ายเดียว</b><p>ส่งคำขอพร้อมเล่มที่เสนอ จุดนัด และระยะเวลาอ่าน ให้อีกฝ่ายพิจารณา</p></div><small>ระยะทางเป็นค่าประมาณจากพื้นที่ค้นหา ไม่ใช่เส้นทางเดินทางจริง</small></aside></div>:likedBooks.length?<div className="book-grid">{likedBooks.map((item)=><BookCard key={item.id} book={item} showScore actions={<div className="liked-actions">{item.matchingOfferIds.length>0&&<button className="button" disabled={busy} onClick={()=>chat(item)}>♡ สนใจตรงกัน · เปิดแชท</button>}<button className="button secondary" onClick={()=>setSelected(item)}>ส่งคำขอแลกอ่าน</button></div>}/>)}</div>:<div className="empty-state"><h2>ยังไม่มีเล่มที่สนใจในหมวดนี้</h2><p>กลับไปปัดเลือก หรือเปลี่ยนหมวดหนังสือ</p></div>}
    </>}
    {selected&&<Modal titleId="reading-request-title" onClose={()=>setSelected(null)}><span className="eyebrow">READ & RETURN</span><h2 id="reading-request-title">ขอแลกอ่าน “{selected.title}”</h2><ExchangeForm book={selected} myBooks={myBooks} onSent={()=>{setSelected(null);setNotice('ส่งคำขอแลกอ่านแล้ว ติดตามได้ที่หน้าแลกอ่าน / คืน');setReload((n)=>n+1)}}/></Modal>}
  </section>
}
