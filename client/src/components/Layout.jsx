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
      <Link className="brand" to="/" aria-label="Bloomie Book หน้าหลัก" onClick={closeMenus}>
        <span className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" focusable="false">
            <path d="M24 13.5C18.7 9.3 12.9 8.6 6 10.6v24.6c7-1.8 12.8-.9 18 3.3V13.5Z" fill="#fff" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M24 13.5c5.3-4.2 11.1-4.9 18-2.9v24.6c-7-1.8-12.8-.9-18 3.3V13.5Z" fill="#f7e8f3" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M24 13.5v25M10 16c3.8-.5 7.2.2 10 2.1m-10 4.5c3.8-.5 7.2.2 10 2.1m8-6.6c2.8-1.9 6.2-2.6 10-2.1m-10 8.7c2.8-1.9 6.2-2.6 10-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="brand-name">Bloomie <em>Book</em></span>
      </Link>
      <button className="mobile-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => { setOpenPath(menuOpen ? null : pathname); setAccountPath(null) }}>{menuOpen ? 'ปิดเมนู ×' : 'เมนู ☰'}</button>
      <nav id="main-navigation" className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="เมนูหลัก" onKeyDown={(event) => { if (event.key === 'Escape') closeMenus() }}>
        <NavLink to="/discover" onClick={closeMenus}>ปัดหนังสือใกล้ฉัน</NavLink>
        <NavLink to="/books/new" onClick={closeMenus}>ลงหนังสือ</NavLink>
        {user ? <>
          <NavLink to="/requests" onClick={closeMenus}>แลกอ่าน / คืน</NavLink>
          <NavLink to="/chats" onClick={closeMenus}>แชท</NavLink>
          {user.isAdmin && <NavLink to="/admin" onClick={closeMenus}>Admin Dashboard</NavLink>}
          <div className="account-wrap"><button className="user-menu" type="button" aria-expanded={accountOpen} aria-controls="account-panel" onClick={() => setAccountPath(accountOpen ? null : pathname)}><span>{user.name.slice(0, 1).toUpperCase()}</span><b>{user.name}</b><span className="account-chevron" aria-hidden="true">⌄</span></button>
            {accountOpen && <div className="account-panel" id="account-panel"><Link to="/books/mine" onClick={closeMenus}>หนังสือของฉัน</Link><Link to="/location" onClick={closeMenus}>พื้นที่ค้นหาของฉัน</Link>{user.isAdmin && <Link to="/admin" onClick={closeMenus}>Admin Dashboard</Link>}<button type="button" onClick={handleLogout}>ออกจากระบบ</button></div>}
          </div>
        </> : <><NavLink to="/login" onClick={closeMenus}>เข้าสู่ระบบ</NavLink><Link className="button button-small" to="/register" onClick={closeMenus}>เริ่มแลกอ่าน ↗</Link></>}
      </nav>
    </header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><span>Bloomie Book</span><span>Read nearby. Return with care. ✦</span></footer>
  </div>
}
