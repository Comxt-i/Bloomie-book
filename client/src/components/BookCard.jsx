const subjectColors = {
  คณิตศาสตร์: 'blue',
  ชีววิทยา: 'green',
  ภาษาอังกฤษ: 'orange',
  TGAT: 'purple',
}

export default function BookCard({ book, actions, showScore = false }) {
  const tone = subjectColors[book.subject] || 'teal'
  return (
    <article className="book-card">
      <div className={`book-cover book-cover-${tone}`}>
        {book.imageUrl ? <img src={book.imageUrl} alt={`ปก ${book.title}`} /> : <><span>{book.subject}</span><strong>{book.title}</strong></>}
      </div>
      <div className="book-body">
        <div className="book-meta">
          <span>{book.subject}</span>
          <span>{book.educationLevel}</span>
          {showScore && <span className="match-score">เข้ากัน {Math.min(99, 60 + book.score * 4)}%</span>}
        </div>
        <h3>{book.title}</h3>
        <p>{book.description || 'เจ้าของยังไม่ได้เพิ่มรายละเอียดหนังสือ'}</p>
        <div className="book-owner">
          <span className="avatar">{book.owner?.name?.slice(0, 1) || '?'}</span>
          <div><b>{book.owner?.name || 'คุณ'}</b><small>สภาพ{book.condition} · {book.status === 'AVAILABLE' ? 'พร้อมแลก' : book.status}</small></div>
        </div>
        {showScore && book.reasons?.length > 0 && <div className="reason">✓ {book.reasons[0]}</div>}
        {actions && <div className="book-actions">{actions}</div>}
      </div>
    </article>
  )
}
