import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function LocationPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [latitude,setLatitude] = useState('')
  const [longitude,setLongitude] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function save(location) {
    setBusy(true);setError('')
    try { const result=await api('/profile/location',{method:'PATCH',body:JSON.stringify({location})});updateUser(result.user); if(location)navigate('/discover'); }
    catch(err){setError(err.message)}finally{setBusy(false)}
  }
  function locate() {
    if(!navigator.geolocation){setError('เบราว์เซอร์นี้ไม่รองรับตำแหน่ง โปรดระบุพิกัดเอง');return}
    setBusy(true);setError('')
    navigator.geolocation.getCurrentPosition((position)=>save({latitude:position.coords.latitude,longitude:position.coords.longitude}),()=>{setBusy(false);setError('ยังเข้าถึงตำแหน่งไม่ได้ คุณเลือกพิกัดจุดนัดพบเองด้านล่างได้')},{enableHighAccuracy:false,timeout:15000,maximumAge:300000})
  }
  return <section className="page-container narrow"><div className="page-heading"><div><span className="eyebrow">START NEAR YOU</span><h1>เล่มที่ใช่ เริ่มจากใกล้กัน</h1><p>เลือกพื้นที่ที่คุณสะดวกนัดรับและคืนหนังสือ</p></div></div><div className="form-card location-card"><div className="location-symbol" aria-hidden="true">◎</div><h2>พื้นที่ค้นหาของคุณ</h2><p className="form-help">เก็บเฉพาะพิกัดพื้นที่โดยประมาณ ไม่ติดตามการเดินทาง คนอื่นเห็นเพียงระยะห่างโดยประมาณ ส่วนจุดนัดจริงค่อยตกลงกันในคำขอหรือแชท</p>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}
    <button className="button button-full" disabled={busy} onClick={locate}>{busy?'กำลังดำเนินการ...':'ใช้ตำแหน่งปัจจุบัน'}</button>
    {user.location&&<p className="form-help current-area">พื้นที่ที่บันทึกไว้: {user.location.latitude.toFixed(2)}, {user.location.longitude.toFixed(2)} <button className="text-button" disabled={busy} onClick={()=>save(null)}>ลบพื้นที่ที่บันทึก</button></p>}
    <details><summary>ระบุพิกัดจุดนัดพบเอง</summary><form onSubmit={(e)=>{e.preventDefault();save({latitude:Number(latitude),longitude:Number(longitude)})}}><div className="field-row"><label>ละติจูด<input type="number" step="any" min="-90" max="90" required value={latitude} onChange={(e)=>setLatitude(e.target.value)}/></label><label>ลองจิจูด<input type="number" step="any" min="-180" max="180" required value={longitude} onChange={(e)=>setLongitude(e.target.value)}/></label></div><button className="button secondary" disabled={busy}>ใช้พื้นที่นี้</button></form></details>
  </div></section>
}
