import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle GitHub Pages 404.html redirect: clean URL before React mounts
if (window.location.search.startsWith('?/')) {
  const path = window.location.search.substring(2) // Remove '?/'
  const cleanPath = path.replace(/~and~/g, '&').replace(/^\/+|\/+$/g, '')
  const routePath = cleanPath.startsWith('XmppTest') 
    ? cleanPath.substring('XmppTest'.length).replace(/^\/+/, '')
    : cleanPath
  const targetPath = routePath === '' ? '/' : '/' + routePath
  window.location.replace('/XmppTest' + targetPath)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
