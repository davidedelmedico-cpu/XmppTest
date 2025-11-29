import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPage } from './pages/LoginPage'
import { ConversationsPage } from './pages/ConversationsPage'
import './App.css'

function AppRoutes() {
  const { isConnected } = useXmpp()
  const location = useLocation()
  const navigate = useNavigate()

  // Redirect to conversations if connected and on root
  useEffect(() => {
    if (location.pathname === '/' && isConnected) {
      navigate('/conversations', { replace: true })
    }
  }, [location.pathname, isConnected, navigate])

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/conversations" element={<ConversationsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <XmppProvider>
      <BrowserRouter basename="/XmppTest">
        <AppRoutes />
      </BrowserRouter>
    </XmppProvider>
  )
}

export default App
