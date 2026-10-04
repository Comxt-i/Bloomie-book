import { useState } from 'react'
import { bookCategory } from '../categories'
const categoryColors = { 'นิยายและวรรณกรรม': 'purple', 'การ์ตูนและมังงะ': 'orange', 'ความรู้และพัฒนาตนเอง': 'green', 'การเรียนและสอบ': 'blue', 'ธุรกิจและการเงิน': 'teal', 'เด็กและเยาวชน': 'orange' }
const statusLabels = { AVAILABLE: 'พร้อมแลกอ่าน', RESERVED: 'รอนัดรับ', ON_LOAN: 'กำลังให้ยืมอ่าน', EXCHANGED: 'แลกแล้ว (รายการเดิม)' }
export default function BookCard({ book, actions, showScore = false }) {
  const [failedImage, setFailedImage] = useState(null)
  const category = bookCategory(book)
  return <article className="book-card">
    <div className={`book-cover book-cover-${categoryColors[category] || 'teal'}`}>
      {book.imageUrl && failedImage !== book.imageUrl ? <img src={book.imageUrl} alt={`ปก ${book.title}`} loading="lazy" onError={() => setFailedImage(book.imageUrl)} /> : <><span>{category}</span><strong>{book.title}</strong></>}
    </div>
    <div className="book-body">
      <div className="book-meta"><span>{category}</span>{book.subject !== category && <span>{book.subject}</span>}{book.educationLevel && book.educationLevel !== 'ทั่วไป' && <span>{book.educationLevel}</span>}</div>
      <h3>{book.title}</h3><p>{book.description || 'เจ้าของยังไม่ได้เพิ่มรายละเอียดหนังสือ'}</p>
      <div className="book-owner"><span className="avatar" aria-hidden="true">{book.owner?.name?.slice(0, 1) || '?'}</span><div><b>{book.owner?.name || 'คุณ'}</b><small>สภาพ{book.condition} · {statusLabels[book.status] || 'ไม่พร้อมแลก'}</small></div></div>
      {showScore && book.reasons?.length > 0 && <div className="reason">แนะนำเพราะ: {book.reasons.join(' · ')}</div>}
      {actions && <div className="book-actions">{actions}</div>}
    </div>
  </article>
}
