// Import ส่วนที่จำเป็นสำหรับ routing, auth context และหน้า UI
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import BooksPage from './pages/BooksPage'
import NewBookPage from './pages/NewBookPage'
import RequestsPage from './pages/RequestsPage'
import MyBooksPage from './pages/MyBooksPage'
import DiscoverPage from './pages/DiscoverPage'
import LocationPage from './pages/LocationPage'
import ChatsPage from './pages/ChatsPage'
import AdminPage from './pages/AdminPage'

// ป้องกัน route ที่ต้อง login โดยเช็กว่าผู้ใช้ login แล้วหรือยัง
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authError, retrySession } = useAuth()
  const location = useLocation()
  if (loading) return <div className="page-loading">กำลังเตรียมพื้นที่อ่าน...</div>
  if (authError) return <div className="page-loading" role="alert">{authError} <button className="button secondary" onClick={retrySession}>ลองใหม่</button></div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (adminOnly && !user.isAdmin) return <div className="page-container"><div className="empty-state"><h2>ไม่มีสิทธิ์เข้า Admin Dashboard</h2><p>หน้านี้เปิดให้เฉพาะบัญชีผู้ดูแลที่ได้รับสิทธิ์</p></div></div>
  return children
}

// กำหนดเส้นทางหลักของแอปและ route ที่ต้องใช้งาน
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
            <Route path="/location" element={<ProtectedRoute><LocationPage /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/mine" element={<ProtectedRoute><MyBooksPage /></ProtectedRoute>} />
            <Route path="/books/new" element={<ProtectedRoute><NewBookPage /></ProtectedRoute>} />
            <Route path="/books/:id/edit" element={<ProtectedRoute><NewBookPage /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
