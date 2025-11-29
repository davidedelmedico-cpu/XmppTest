import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { XmppProvider } from './contexts/XmppContext'
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
      // Ensure path starts with /
      if (!path.startsWith('/')) {
        path = '/' + path
      }
      // Only navigate if the path is different from current location
      if (location.pathname !== path) {
        navigate(path, { replace: true })
      }
    }
  }, [location.search, location.pathname, navigate])

  return null
}

function App() {
  return (
    <XmppProvider>
      <BrowserRouter basename="/XmppTest">
        <RedirectHandler />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </XmppProvider>
  )
}

export default App
