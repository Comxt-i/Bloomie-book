import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user } = useAuth()
  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">พื้นที่แบ่งปันหนังสือเพื่อการเรียนรู้</span>
          <h1>หนังสือเล่มเดิม<br />สร้างโอกาสใหม่ได้</h1>
          <p>ค้นหาหนังสือที่ตรงกับเป้าหมาย แลกกับเล่มที่คุณอ่านจบแล้ว และส่งต่อการเรียนรู้ให้คนถัดไป</p>
          <div className="hero-actions">
            <Link className="button" to={user ? '/books' : '/register'}>{user ? 'ค้นหาหนังสือ' : 'เริ่มแบ่งปันหนังสือ'} <span>→</span></Link>
            {!user && <Link className="text-link" to="/login">มีบัญชีแล้ว เข้าสู่ระบบ</Link>}
          </div>
          <div className="trust-row"><span>✓ ไม่มีค่าธรรมเนียม</span><span>✓ จับคู่ตามความสนใจ</span><span>✓ ลดหนังสือที่ไม่ได้ใช้</span></div>
        </div>
        <div className="hero-visual" aria-label="ภาพประกอบหนังสือที่พร้อมส่งต่อ">
          <div className="floating-note note-one">อ่านจบแล้ว<br /><b>ส่งต่อได้เลย</b></div>
          <div className="book-stack">
            <div className="stack-book book-a"><span>MATH</span><b>สรุปคณิต<br />ม.ปลาย</b></div>
            <div className="stack-book book-b"><span>TGAT</span><b>English<br />Communication</b></div>
            <div className="stack-book book-c"><span>BIOLOGY</span><b>เตรียมสอบ<br />เข้ามหาวิทยาลัย</b></div>
          </div>
          <div className="floating-note note-two"><span>♥</span> มีคนสนใจหนังสือของคุณ</div>
        </div>
      </section>
      <section className="how-section">
        <div><span className="step-number">01</span><h2>ลงหนังสือ</h2><p>เพิ่มเล่มที่คุณอ่านจบแล้ว พร้อมข้อมูลสภาพหนังสือ</p></div>
        <div><span className="step-number">02</span><h2>ค้นหาคู่แลก</h2><p>ระบบเรียงหนังสือให้ตามระดับและความสนใจของคุณ</p></div>
        <div><span className="step-number">03</span><h2>ส่งคำขอ</h2><p>เลือกหนังสือของคุณเพื่อเสนอแลกและรออีกฝ่ายตอบรับ</p></div>
      </section>
    </>
  )
}
