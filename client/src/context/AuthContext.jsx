import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, getToken, setToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const sessionVersion = useRef(0)

  useEffect(() => {
    let active = true
    const version = ++sessionVersion.current
    setLoading(true)
    setAuthError('')
    if (!getToken()) {
      setLoading(false)
      return
    }
    api('/auth/me')
      .then(({ user: currentUser }) => { if (active && sessionVersion.current === version) setUser(currentUser) })
      .catch((error) => {
        if (!active || sessionVersion.current !== version) return
        if (error.status === 401) setToken(null)
        else setAuthError('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง')
      })
      .finally(() => { if (active && sessionVersion.current === version) setLoading(false) })
    return () => { active = false }
  }, [retryKey])

  function acceptSession(session) {
    sessionVersion.current += 1
    setToken(session.token)
    setUser(session.user)
    setAuthError('')
    setLoading(false)
  }

  function logout() {
    sessionVersion.current += 1
    setToken(null)
    setUser(null)
    setAuthError('')
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, retrySession: () => setRetryKey((key) => key + 1), acceptSession, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
