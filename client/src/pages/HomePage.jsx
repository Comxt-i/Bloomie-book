import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import BookCard from '../components/BookCard'

const steps = [
  ['01', 'เริ่มจากใกล้กัน', 'เลือกพื้นที่ที่สะดวกนัดรับและคืน แล้วค้นหาหนังสือในรัศมีของคุณ'],
  ['02', 'ปัดเจอเล่มที่ใช่', 'สนใจตรงกันเปิดแชทได้เลย หรือส่งคำขอแลกอ่านถ้าสนใจฝ่ายเดียว'],
  ['03', 'แลกอ่าน แล้วนัดคืน', 'ตกลงจุดนัดและระยะเวลาอ่าน ยืนยันรับและคืนทั้งสองฝ่าย'],
]

export default function HomePage() {
  const [books, setBooks] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => {
    let active = true
    api('/books').then(({ books: items }) => {
      if (active) { setBooks(items.filter((book) => book.status === 'AVAILABLE').slice(0, 3)); setState('ready') }
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [])

  return <>
    <section className="hero-section">
      <div className="hero-copy">
        <span className="eyebrow">✦ หนังสือใกล้ตัว เพื่อนอ่านใกล้กัน</span>
        <h1>เล่มที่ใช่ อยู่ใกล้ตัว<br /><span className="underlined">แลกกันอ่าน</span> แล้วส่งคืน</h1>
        <p>ไม่ว่าจะชอบนิยาย การ์ตูน หรือหนังสือความรู้ <br className="desktop-break" />ปัดเจอเล่มใกล้ตัว นัดแลกกันอ่าน </p>
        <div className="hero-actions">
          <Link className="button" to="/discover">เริ่มปัดหนังสือใกล้ฉัน <span aria-hidden="true">↗</span></Link>
          <Link className="text-link" to="/books/new">ลงหนังสือของฉัน <span aria-hidden="true">→</span></Link>
        </div>
        <div className="trust-row"><span>✓ ไม่มีค่าธรรมเนียม</span><span>✓ ได้อ่านหนังสือใหม่</span></div>
      </div>
      <div className="hero-visual" role="img" aria-label="ภาพวาดหนังสือหลายแนวในกรอบโค้ง พร้อมข้อความแลกอ่านแล้วคืนกัน">
        <div className="arch-panel"><span className="arch-label">A NEW CHAPTER, TOGETHER.</span><div className="book-stack">
          <div className="stack-book book-a"><span>STORIES TO SHARE</span><b>นิยาย<br />ที่อยากส่งต่อ</b><i aria-hidden="true">✦</i></div>
          <div className="stack-book book-b"><span>GOOD THINGS AHEAD</span><b>อ่านแล้ว<br />เติบโตไปด้วยกัน</b><i aria-hidden="true">Aa</i></div>
          <div className="stack-book book-c"><span>READ • MEET • RETURN</span><b>การ์ตูน<br />บทต่อไปของเรา</b><i aria-hidden="true">❀</i></div>
        </div></div>
        <div className="star-sticker">อยู่ใกล้กัน<br /><b>แลกอ่านเลย!</b></div>
        <span className="doodle doodle-one" aria-hidden="true">✧</span><span className="doodle doodle-two" aria-hidden="true">〰</span>
        <div className="floating-note">นัดรับง่าย นัดคืนใกล้ ๆ <span aria-hidden="true">♡</span></div>
      </div>
    </section>
    <section className="home-section" id="how-it-works">
      <div className="section-heading"><span className="eyebrow">HOW IT WORKS</span><h2>จากพิกัดใกล้กัน สู่เพื่อนแลกอ่าน</h2><p>เจอเล่มใหม่ โดยไม่ต้องบอกลาเล่มเดิม</p></div>
      <div className="how-section">{steps.map(([number, title, description]) => <article key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>
    <section className="home-section featured-section">
      <div className="section-heading section-heading-row"><div><span className="eyebrow">FIND YOUR NEXT READ</span><h2>ตัวอย่างหนังสือที่พร้อมให้แลกอ่าน</h2></div><Link className="text-link" to="/books">ดูหนังสือทั้งหมด ↗</Link></div>
      {state === 'loading' ? <p className="empty-state" role="status">กำลังเปิดชั้นหนังสือ...</p> : state === 'error' ? <div className="empty-state"><p>ยังโหลดชั้นหนังสือไม่ได้ ลองเปิดหน้าค้นหาอีกครั้ง</p><Link className="button secondary" to="/books">ไปหน้าค้นหา</Link></div> : books.length ? <div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} actions={<Link className="button button-card secondary" to="/books">ไปเลือกหนังสือ ↗</Link>} />)}</div> : <div className="empty-state"><h3>ชั้นหนังสือกำลังรอเล่มแรก</h3><Link className="button" to="/books/new">ลงเล่มที่พร้อมให้ยืมอ่าน</Link></div>}
    </section>
    <section className="sharing-note"><span aria-hidden="true">✳</span><div><h2>รับมาอ่าน แล้วคืนด้วยความใส่ใจ</h2><p>บอกสภาพตามจริง · นัดรับและคืนในที่สาธารณะ · ยืนยันเมื่อได้หนังสือของตัวเองคืน</p></div></section>
  </>
}
