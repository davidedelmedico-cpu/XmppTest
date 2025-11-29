import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle GitHub Pages 404.html redirect BEFORE React mounts
// This ensures the URL is clean before React Router initializes
(function handleGitHubPagesRedirect() {
  const windowSearch = window.location.search
  const currentPath = window.location.pathname
  
  console.log('[DEBUG] Initial URL:', {
    pathname: currentPath,
    search: windowSearch,
    href: window.location.href
  })
  
  // Check if window.location.search starts with ?/ (from 404.html)
  if (windowSearch.startsWith('?/')) {
    console.log('[DEBUG] Detected GitHub Pages redirect pattern')
    
    // Extract path directly from window.location.search
    let path = windowSearch.substring(2) // Remove '?/'
    console.log('[DEBUG] Extracted path from query:', path)
    
    // Handle additional query parameters (if any) - split on & but preserve ~and~
    const queryIndex = path.indexOf('&')
    if (queryIndex !== -1) {
      // Check if it's a real & or a ~and~
      const beforeQuery = path.substring(0, queryIndex)
      if (!beforeQuery.includes('~and~')) {
        // It's a real query parameter, stop here
        path = beforeQuery
        console.log('[DEBUG] Found real query param, using path:', path)
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
    
    console.log('[DEBUG] Cleaning URL:', {
      original: window.location.href,
      targetPath,
      cleanUrl
    })
    
    // Replace the URL immediately to clean it up
    // Use window.location.replace to ensure a clean navigation (without full reload)
    // This ensures React Router sees the clean URL when it initializes
    if (window.location.pathname + window.location.search !== cleanUrl) {
      console.log('[DEBUG] Replacing URL to:', cleanUrl)
      window.location.replace(cleanUrl)
      // Don't continue - let the page reload with clean URL
      return
    }
    
    console.log('[DEBUG] URL after cleanup:', {
      pathname: window.location.pathname,
      search: window.location.search,
      href: window.location.href
    })
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
