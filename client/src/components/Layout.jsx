import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="PUN AAN หน้าหลัก">
          <span className="brand-icon">◫</span>
          <span>PUN <em>AAN</em></span>
        </Link>
        <nav className="main-nav" aria-label="เมนูหลัก">
          {user ? (
            <>
              <NavLink to="/books">ค้นหาหนังสือ</NavLink>
              <NavLink to="/books/new">ลงหนังสือ</NavLink>
              <NavLink to="/requests">คำขอแลก</NavLink>
              <button className="user-menu" type="button" onClick={handleLogout} title="ออกจากระบบ">
                <span>{user.name.slice(0, 1).toUpperCase()}</span>
                <b>{user.name}</b>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">เข้าสู่ระบบ</NavLink>
              <Link className="button button-small" to="/register">เริ่มแบ่งปัน</Link>
            </>
          )}
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">
        <span>ทุกการอ่าน คือโอกาสเรียนรู้ที่ส่งต่อได้</span>
        <span>PUN AAN · Sharing Books, Sharing Opportunities</span>
      </footer>
    </div>
  )
}
