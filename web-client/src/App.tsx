import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPage } from './pages/LoginPage'
import { ConversationsPage } from './pages/ConversationsPage'
import './App.css'

// Redirect logic for GitHub Pages SPA routing (fallback)
// Most redirects are handled in main.tsx before React mounts,
// but this ensures URL stays clean after React Router navigation
function RedirectHandler() {
  const location = useLocation()

  useEffect(() => {
    // Ensure URL stays clean - remove any query params that might have been added
    if (window.location.search && (location.pathname === '/' || location.pathname === '/conversations')) {
      const basePath = '/XmppTest'
      const cleanUrl = basePath + location.pathname
      // Only replace if URL is different
      if (window.location.pathname + window.location.search !== cleanUrl) {
        window.history.replaceState(null, '', cleanUrl)
      }
    }
  }, [location.pathname])

  return null
}

// Component to handle initial routing based on connection status
function InitialRouteHandler() {
  const { isConnected } = useXmpp()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Only redirect if we're at the root path and not already navigating
    if (location.pathname === '/') {
      if (isConnected) {
        // If connected, redirect to conversations
        navigate('/conversations', { replace: true })
      }
      // If not connected, stay on login page (no redirect needed)
    }
  }, [isConnected, location.pathname, navigate])

  return null
}

function AppRoutes() {
  return (
    <>
      <RedirectHandler />
      <InitialRouteHandler />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
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
