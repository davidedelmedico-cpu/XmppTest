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
    console.log('[DEBUG RedirectHandler] Location changed:', {
      pathname: location.pathname,
      search: location.search,
      windowPathname: window.location.pathname,
      windowSearch: window.location.search,
      windowHref: window.location.href
    })
    
    // Ensure URL stays clean - remove any query params that might have been added
    if (window.location.search && (location.pathname === '/' || location.pathname === '/conversations')) {
      const basePath = '/XmppTest'
      const cleanUrl = basePath + location.pathname
      const currentUrl = window.location.pathname + window.location.search
      
      console.log('[DEBUG RedirectHandler] Cleaning URL:', {
        currentUrl,
        cleanUrl,
        needsCleanup: currentUrl !== cleanUrl
      })
      
      // Only replace if URL is different
      if (currentUrl !== cleanUrl) {
        window.history.replaceState(null, '', cleanUrl)
        console.log('[DEBUG RedirectHandler] URL cleaned:', window.location.href)
      }
    }
  }, [location.pathname, location.search])

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
  // Double-check URL is clean before React Router initializes
  useEffect(() => {
    const windowSearch = window.location.search
    if (windowSearch.startsWith('?/')) {
      console.log('[DEBUG App] Found query params before Router init, cleaning...')
      let path = windowSearch.substring(2)
      const queryIndex = path.indexOf('&')
      if (queryIndex !== -1 && !path.substring(0, queryIndex).includes('~and~')) {
        path = path.substring(0, queryIndex)
      }
      path = path.replace(/~and~/g, '&').replace(/^\/+|\/+$/g, '')
      if (path.startsWith('XmppTest')) {
        path = path.substring('XmppTest'.length).replace(/^\/+/, '')
      }
      const targetPath = path === '' ? '/' : '/' + path
      const cleanUrl = '/XmppTest' + targetPath
      window.history.replaceState(null, '', cleanUrl)
      console.log('[DEBUG App] Cleaned URL to:', cleanUrl)
    }
  }, [])

  return (
    <XmppProvider>
      <BrowserRouter basename="/XmppTest">
        <AppRoutes />
      </BrowserRouter>
    </XmppProvider>
  )
}

export default App
