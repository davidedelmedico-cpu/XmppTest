import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPage } from './pages/LoginPage'
import { ConversationsPage } from './pages/ConversationsPage'
import './App.css'

function InitializingScreen() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a1a',
      zIndex: 9999
    }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <p style={{ color: '#707579', fontSize: '0.9rem' }}>Caricamento...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function AppRoutes() {
  const { isConnected, isInitializing } = useXmpp()
  const location = useLocation()
  const navigate = useNavigate()

  // Show initializing screen while checking credentials
  if (isInitializing) {
    return <InitializingScreen />
  }

  // After initialization, route appropriately
  useEffect(() => {
    if (isConnected && location.pathname === '/') {
      // Connected and on login page -> go to conversations
      navigate('/conversations', { replace: true })
    } else if (!isConnected && location.pathname === '/conversations') {
      // Not connected and on conversations -> go to login
      navigate('/', { replace: true })
    }
  }, [isConnected, location.pathname, navigate])

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
