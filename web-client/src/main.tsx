import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle GitHub Pages 404.html redirect BEFORE React mounts
// This ensures the URL is clean before React Router initializes
(function handleGitHubPagesRedirect() {
  const windowSearch = window.location.search
  
  // Check if window.location.search starts with ?/ (from 404.html)
  if (windowSearch.startsWith('?/')) {
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
    
    // Replace the URL immediately to clean it up
    // This happens before React Router initializes, so it will pick up the clean URL
    window.history.replaceState(null, '', cleanUrl)
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
