import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPage } from './pages/LoginPage'
import { ConversationsPage } from './pages/ConversationsPage'
import './App.css'

// Redirect logic for GitHub Pages SPA routing
function RedirectHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const hasRedirected = useRef(false)

  useEffect(() => {
    // Check if we have a redirect query parameter (from 404.html)
    // The 404.html creates URLs like /?/XmppTest/conversations
    const windowSearch = window.location.search
    
    // Check if window.location.search starts with ?/ (direct check)
    if (windowSearch.startsWith('?/') && !hasRedirected.current) {
      hasRedirected.current = true
      
      // Extract path directly from window.location.search
      let path = windowSearch.substring(2) // Remove '?/'
      
      // Handle additional query parameters (if any) - split on & but preserve ~and~
      const queryIndex = path.indexOf('&')
      if (queryIndex !== -1) {
        // Check if it's a real & or a ~and~
        const beforeQuery = path.substring(0, queryIndex)
        if (!beforeQuery.includes('~and~')) {
          // It's a real query parameter, stop here
          path = beforeQuery
        }
      }
      
      // Replace ~and~ with & in the path (for paths that had & encoded)
      path = path.replace(/~and~/g, '&')
      
      // Remove leading/trailing slashes and normalize
      path = path.replace(/^\/+|\/+$/g, '')
      
      // Remove the basePath (XmppTest) from the path since basename handles it
      if (path.startsWith('XmppTest')) {
        path = path.substring('XmppTest'.length)
        // Remove leading slash if present
        path = path.replace(/^\/+/, '')
      }
      
      // Build target path: empty string for root, or /path for sub-routes
      const targetPath = path === '' ? '/' : '/' + path
      
      // Build the full clean URL with basePath
      const basePath = '/XmppTest'
      const cleanUrl = basePath + targetPath
      
      // First, clean up the URL in the browser (remove query params)
      window.history.replaceState(null, '', cleanUrl)
      
      // Then navigate with React Router to update the internal state
      // This ensures React Router is in sync with the clean URL
      navigate(targetPath, { replace: true })
    }
    
    // Reset the flag when search params are cleared
    if (!windowSearch) {
      hasRedirected.current = false
    }
  }, [location.pathname, location.search, navigate])

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
