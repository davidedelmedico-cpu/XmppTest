import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPage } from './pages/LoginPage'
import { ConversationsPage } from './pages/ConversationsPage'
import './App.css'

// Redirect logic for GitHub Pages SPA routing
function RedirectHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have a redirect query parameter (from 404.html)
    const searchParams = new URLSearchParams(location.search)
    const redirectPath = searchParams.get('/')
    
    if (redirectPath) {
      // Replace ~and~ with & in the path
      let path = redirectPath.replace(/~and~/g, '&')
      
      // Remove the basePath (/XmppTest) from the path since basename handles it
      if (path.startsWith('/XmppTest')) {
        path = path.substring('/XmppTest'.length)
      }
      
      // Ensure path starts with / (or is empty for root)
      if (path && !path.startsWith('/')) {
        path = '/' + path
      }
      
      // If path is empty or just '/', navigate to root (basename will add /XmppTest)
      const targetPath = path === '/XmppTest' || path === '' ? '/' : path
      
      // Only navigate if the path is different from current location
      // Use setTimeout to avoid navigation during render
      const timer = setTimeout(() => {
        if (location.pathname !== targetPath) {
          navigate(targetPath, { replace: true })
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [location.search, location.pathname, navigate])

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
