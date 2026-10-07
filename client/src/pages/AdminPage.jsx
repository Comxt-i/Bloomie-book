import { useEffect, useState } from 'react'
import { api } from '../api'

const number = (value) => new Intl.NumberFormat('th-TH').format(value ?? 0)
const date = (value) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const statusLabels = { AVAILABLE: 'พร้อมแลก', RESERVED: 'จองแล้ว', ON_LOAN: 'กำลังอ่าน', EXCHANGED: 'แลกแล้ว', ACCEPTED: 'นัดรับ', ACTIVE: 'กำลังอ่าน', CANCELLED: 'ยกเลิก', COMPLETED: 'เสร็จสิ้น' }

export default function AdminPage() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [issues, setIssues] = useState([])
  const [issueStatus, setIssueStatus] = useState('open')
  const [directory, setDirectory] = useState({ users: [], books: [], total: 0, pageSize: 20 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const request = tab === 'overview'
      ? Promise.all([api('/admin/overview'), api('/admin/exchange-requests/issues?status=open')])
      : tab === 'issues'
        ? api(`/admin/exchange-requests/issues?status=${issueStatus}`)
        : api(`/admin/${tab}?page=${page}&search=${encodeURIComponent(search)}`)
    request.then((result) => {
      if (!active) return
      if (tab === 'overview') { setOverview(result[0]); setIssues(result[1].requests) }
      else if (tab === 'issues') setIssues(result.requests)
      else setDirectory(result)
    }).catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tab, issueStatus, page, search, refresh])

  function changeTab(next) {
    setTab(next)
    setPage(1)
    setSearch('')
    setSearchInput('')
    setAction(null)
    setNotice('')
  }

  async function resolve(event) {
    event.preventDefault()
    if (!action || busy) return
    const note = action.note.trim()
    if (note.length < 10) { setError('กรุณาระบุผลการตรวจสอบอย่างน้อย 10 ตัวอักษร'); return }
    if (!window.confirm('ยืนยันว่าตรวจสอบการรับและคืนหนังสือจริงแล้ว? การปิดรายการจะทำให้หนังสือทั้งสองเล่มกลับมาพร้อมแลก')) return
    setBusy(true)
    setError('')
    try {
      await api(`/admin/exchange-requests/${action.id}/resolve`, { method: 'PATCH', body: JSON.stringify({ outcome: action.outcome, note }) })
      setNotice('บันทึกผลการตรวจสอบแล้ว')
      setAction(null)
      setRefresh((value) => value + 1)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  function issueList() {
    return issues.length ? <div className="admin-issue-list">{issues.map((request) => <article className="admin-issue" key={request.id}>
      <div className="admin-issue-top"><span className="status">{statusLabels[request.status] || request.status}</span><time>{date(request.updatedAt)}</time></div>
      <h3>{request.offeredBook.title} <span aria-hidden="true">⇄</span> {request.requestedBook.title}</h3>
      <p>ผู้ขอแลก: {request.requester?.name || 'ไม่ทราบชื่อ'} · เจ้าของอีกเล่ม: {request.requestedBook.owner?.name || 'ไม่ทราบชื่อ'}</p>
      <p>จุดนัด: {request.meetingPlace || 'ไม่ได้ระบุ'} · กำหนดคืน: {date(request.dueAt)}</p>
      <blockquote>{request.issueReport?.reason}</blockquote>
      {request.issueResolution ? <p className="admin-resolution"><b>ผลการตรวจ:</b> {statusLabels[request.issueResolution.outcome] || request.issueResolution.outcome} · {request.issueResolution.note} ({date(request.issueResolution.at)})</p> : <>
        <button className="button secondary" type="button" disabled={busy} onClick={() => setAction(action?.id === request.id ? null : { id: request.id, outcome: 'CANCELLED', note: '' })}>{action?.id === request.id ? 'ปิดแบบฟอร์ม' : 'ตรวจและปิดรายการ'}</button>
        {action?.id === request.id && <form className="admin-resolve-form" onSubmit={resolve}>
          <label>ผลการตรวจ<select value={action.outcome} onChange={(event) => setAction({ ...action, outcome: event.target.value })}><option value="CANCELLED">ยกเลิก — หนังสือกลับถึงเจ้าของทั้งสองฝ่ายแล้ว</option>{request.status === 'ACTIVE' && <option value="COMPLETED">เสร็จสิ้น — คืนหนังสือครบแล้ว</option>}</select></label>
          <label>บันทึกเหตุผล<textarea rows="3" maxLength="1000" required minLength="10" value={action.note} onChange={(event) => setAction({ ...action, note: event.target.value })} placeholder="ระบุสิ่งที่ตรวจสอบและวิธีติดต่อคู่แลกอ่าน" /></label>
          <p>ตรวจสอบกับทั้งสองฝ่ายก่อนยืนยัน เพราะหนังสือจะกลับมาพร้อมให้ผู้อื่นแลก</p>
          <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันผลการตรวจ'}</button>
        </form>}
      </>}
    </article>)}</div> : <div className="empty-state compact"><h2>ไม่มีรายการในส่วนนี้</h2><p>รายการที่ต้องตรวจสอบจะปรากฏที่นี่</p></div>
  }

  const pages = Math.max(1, Math.ceil(directory.total / directory.pageSize))
  return <section className="page-container admin-page"><div className="page-heading"><div><span className="eyebrow">BLOOMIE BOOK · ADMIN</span><h1>Admin Dashboard</h1><p>ติดตามภาพรวมและช่วยแก้ปัญหาการแลกอ่านในที่เดียว</p></div><button className="button secondary" type="button" disabled={loading || busy} onClick={() => setRefresh((value) => value + 1)}>รีเฟรชข้อมูล</button></div>
    <div className="tabs admin-tabs" role="tablist" aria-label="ส่วนจัดการ"><button type="button" role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => changeTab('overview')}>ภาพรวม</button><button type="button" role="tab" aria-selected={tab === 'issues'} className={tab === 'issues' ? 'active' : ''} onClick={() => changeTab('issues')}>รายการแจ้งปัญหา</button><button type="button" role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => changeTab('users')}>ผู้ใช้</button><button type="button" role="tab" aria-selected={tab === 'books'} className={tab === 'books' ? 'active' : ''} onClick={() => changeTab('books')}>หนังสือ</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    {loading ? <div className="empty-state" role="status">กำลังโหลดข้อมูลผู้ดูแล...</div> : tab === 'overview' ? <>
      <div className="admin-metrics"><article><span>ผู้ใช้ทั้งหมด</span><strong>{number(overview?.users)}</strong></article><article><span>หนังสือทั้งหมด</span><strong>{number(overview?.books)}</strong><small>พร้อมแลก {number(overview?.availableBooks)}</small></article><article><span>รายการกำลังดำเนินการ</span><strong>{number(overview?.activeRequests)}</strong><small>รอตอบรับ {number(overview?.pendingRequests)}</small></article><article className="admin-alert-metric"><span>รอตรวจสอบ</span><strong>{number(overview?.openIssues)}</strong></article></div>
      <div className="admin-section-heading"><h2>ปัญหาที่ต้องตรวจสอบ</h2><button className="text-button" type="button" onClick={() => changeTab('issues')}>ดูรายการทั้งหมด →</button></div>{issueList()}
    </> : tab === 'issues' ? <><div className="admin-filter"><label>สถานะ <select value={issueStatus} onChange={(event) => { setIssueStatus(event.target.value); setAction(null) }}><option value="open">รอตรวจสอบ</option><option value="resolved">ตรวจแล้ว</option></select></label></div>{issueList()}</> : <>
      <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }}><label htmlFor="admin-search-input">ค้นหา{tab === 'users' ? 'ผู้ใช้ด้วยชื่อหรืออีเมล' : 'หนังสือด้วยชื่อ หมวด หรือเจ้าของ'}</label><div><input id="admin-search-input" value={searchInput} maxLength="100" onChange={(event) => setSearchInput(event.target.value)} placeholder={tab === 'users' ? 'ชื่อหรืออีเมล' : 'ชื่อหนังสือ หมวด หรือเจ้าของ'} /><button className="button secondary" type="submit">ค้นหา</button></div></form>
      <p className="admin-count">พบ {number(directory.total)} รายการ · หน้า {number(page)} จาก {number(pages)}</p>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{tab === 'users' ? <><th>ผู้ใช้</th><th>อีเมล</th><th>หนังสือ</th><th>สมัครเมื่อ</th></> : <><th>หนังสือ</th><th>เจ้าของ</th><th>สถานะ</th><th>ลงเมื่อ</th></>}</tr></thead><tbody>{tab === 'users' ? directory.users?.map((user) => <tr key={user.id}><td><b>{user.name}</b></td><td>{user.email}</td><td>{number(user.bookCount)}</td><td>{date(user.createdAt)}</td></tr>) : directory.books?.map((book) => <tr key={book.id}><td><b>{book.title}</b><small>{book.category}</small></td><td>{book.owner?.name}<small>{book.owner?.email}</small></td><td>{statusLabels[book.status] || book.status}</td><td>{date(book.createdAt)}</td></tr>)}</tbody></table>{!(tab === 'users' ? directory.users?.length : directory.books?.length) && <div className="empty-state compact">ไม่พบข้อมูลที่ค้นหา</div>}</div>
      <div className="admin-pagination"><button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button><button className="button secondary" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป →</button></div>
    </>}
  </section>
}
