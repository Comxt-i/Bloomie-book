import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openPath, setOpenPath] = useState(null)
  const [accountPath, setAccountPath] = useState(null)
  const menuOpen = openPath === pathname
  const accountOpen = accountPath === pathname
  function closeMenus() { setOpenPath(null); setAccountPath(null) }
  function handleLogout() { logout(); closeMenus(); navigate('/') }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">ข้ามไปเนื้อหา</a>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="PUN AAN หน้าหลัก" onClick={closeMenus}><span className="brand-icon" aria-hidden="true">◫</span><span>PUN <em>AAN</em><small>แลกกันอ่าน แล้วคืนกัน</small></span></Link>
      <button className="mobile-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => { setOpenPath(menuOpen ? null : pathname); setAccountPath(null) }}>{menuOpen ? 'ปิดเมนู ×' : 'เมนู ☰'}</button>
      <nav id="main-navigation" className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="เมนูหลัก" onKeyDown={(event) => { if (event.key === 'Escape') closeMenus() }}>
        <NavLink to="/discover" onClick={closeMenus}>ปัดหนังสือใกล้ฉัน</NavLink>
        <NavLink to="/books/new" onClick={closeMenus}>ลงหนังสือ</NavLink>
        {user ? <>
          <NavLink to="/requests" onClick={closeMenus}>แลกอ่าน / คืน</NavLink>
          <NavLink to="/chats" onClick={closeMenus}>แชท</NavLink>
          <div className="account-wrap"><button className="user-menu" type="button" aria-expanded={accountOpen} aria-controls="account-panel" onClick={() => setAccountPath(accountOpen ? null : pathname)}><span>{user.name.slice(0, 1).toUpperCase()}</span><b>{user.name}</b><span className="account-chevron" aria-hidden="true">⌄</span></button>
            {accountOpen && <div className="account-panel" id="account-panel"><Link to="/books/mine" onClick={closeMenus}>หนังสือของฉัน</Link><Link to="/location" onClick={closeMenus}>พื้นที่ค้นหาของฉัน</Link><button type="button" onClick={handleLogout}>ออกจากระบบ</button></div>}
          </div>
        </> : <><NavLink to="/login" onClick={closeMenus}>เข้าสู่ระบบ</NavLink><Link className="button button-small" to="/register" onClick={closeMenus}>เริ่มแลกอ่าน ↗</Link></>}
      </nav>
    </header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><span><b>PUN AAN</b> · หนังสือของเรา แลกกันอ่านได้</span><span>Read nearby. Return with care. ✦</span></footer>
  </div>
}
