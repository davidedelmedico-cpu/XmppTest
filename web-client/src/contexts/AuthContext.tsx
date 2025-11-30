import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { saveCredentials, loadCredentials, clearCredentials } from '../services/auth-storage'

interface AuthContextType {
  isAuthenticated: boolean
  credentials: { jid: string; password: string } | null
  login: (jid: string, password: string) => void
  logout: () => void
  loadSavedCredentials: () => { jid: string; password: string } | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<{ jid: string; password: string } | null>(null)

  const login = useCallback((jid: string, password: string) => {
    saveCredentials(jid, password)
    setCredentials({ jid, password })
  }, [])

  const logout = useCallback(() => {
    clearCredentials()
    setCredentials(null)
  }, [])

  const loadSavedCredentials = useCallback(() => {
    const saved = loadCredentials()
    if (saved) {
      setCredentials(saved)
    }
    return saved
  }, [])

  const isAuthenticated = credentials !== null

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        credentials,
        login,
        logout,
        loadSavedCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve essere usato dentro AuthProvider')
  }
  return context
}
