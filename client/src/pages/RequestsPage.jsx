import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const labels = { PENDING: 'รอตอบรับ', ACCEPTED: 'นัดแลกได้', REJECTED: 'ปฏิเสธแล้ว', COMPLETED: 'แลกสำเร็จ', CANCELLED: 'ยกเลิกแล้ว' }

export default function RequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [tab, setTab] = useState('incoming')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    try { setRequests((await api('/exchange-requests/mine')).requests) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id, status) {
    try {
      const { request } = await api(`/exchange-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setRequests((current) => current.map((item) => item.id === id ? request : item))
    } catch (err) { setError(err.message) }
  }

  const visible = requests.filter((request) => tab === 'incoming' ? request.requestedBook.ownerId === user.id : request.requesterId === user.id)

  return (
    <section className="page-container">
      <div className="page-heading"><div><span className="eyebrow">จัดการการแลกเปลี่ยน</span><h1>คำขอแลกหนังสือ</h1><p>ตอบรับ ติดตาม และยืนยันเมื่อแลกหนังสือเรียบร้อย</p></div></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs"><button className={tab === 'incoming' ? 'active' : ''} onClick={() => setTab('incoming')}>คำขอที่ได้รับ</button><button className={tab === 'outgoing' ? 'active' : ''} onClick={() => setTab('outgoing')}>คำขอที่ส่ง</button></div>
      {loading ? <div className="empty-state">กำลังโหลดคำขอ...</div> : visible.length === 0 ? <div className="empty-state"><span>↔</span><h2>ยังไม่มีคำขอในส่วนนี้</h2><p>ค้นหาหนังสือที่สนใจ แล้วส่งข้อเสนอแลกได้เลย</p><Link className="button" to="/books">ค้นหาหนังสือ</Link></div> : <div className="request-list">{visible.map((request) => { const incoming = request.requestedBook.ownerId === user.id; return <article className="request-card" key={request.id}><div className="request-top"><span className={`status status-${request.status.toLowerCase()}`}>{labels[request.status]}</span><time>{new Date(request.createdAt).toLocaleDateString('th-TH')}</time></div><div className="exchange-books"><div><small>{incoming ? 'คุณจะให้' : 'คุณต้องการ'}</small><b>{request.requestedBook.title}</b></div><span>⇄</span><div><small>{incoming ? `${request.requester.name} เสนอ` : 'คุณเสนอ'}</small><b>{request.offeredBook.title}</b></div></div>{request.message && <blockquote>“{request.message}”</blockquote>}<div className="request-actions">{incoming && request.status === 'PENDING' && <><button className="button secondary" onClick={() => updateStatus(request.id, 'REJECTED')}>ปฏิเสธ</button><button className="button" onClick={() => updateStatus(request.id, 'ACCEPTED')}>ตอบรับ</button></>}{request.status === 'ACCEPTED' && <button className="button" onClick={() => updateStatus(request.id, 'COMPLETED')}>ยืนยันว่าแลกแล้ว</button>}{!incoming && ['PENDING', 'ACCEPTED'].includes(request.status) && <button className="button secondary" onClick={() => updateStatus(request.id, 'CANCELLED')}>ยกเลิกคำขอ</button>}</div></article> })}</div>}
    </section>
  )
}
