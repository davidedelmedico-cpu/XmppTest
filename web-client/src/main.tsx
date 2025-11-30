import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Blocca il pull-to-refresh nativo del browser su TUTTO il documento
let lastTouchY = 0
let isAtTop = true

document.addEventListener('touchstart', (e) => {
  lastTouchY = e.touches[0].clientY
  // Controlla se siamo in cima alla pagina
  isAtTop = window.scrollY === 0 || document.documentElement.scrollTop === 0
  
  // Blocca il pinch-zoom: se ci sono più di un tocco, previeni il comportamento predefinito
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}, { passive: false })

document.addEventListener('touchmove', (e) => {
  const touchY = e.touches[0].clientY
  const touchDelta = touchY - lastTouchY
  
  // Blocca il pinch-zoom: se ci sono più di un tocco, previeni il comportamento predefinito
  if (e.touches.length > 1) {
    e.preventDefault()
    return
  }
  
  // Se siamo in cima E stiamo trascinando verso il basso, blocca
  if (isAtTop && touchDelta > 0) {
    e.preventDefault()
  }
}, { passive: false })

// Blocca anche il gesto di zoom con doppio tap
let lastTouchEnd = 0
document.addEventListener('touchend', (e) => {
  const now = Date.now()
  if (now - lastTouchEnd < 300 && e.touches.length === 0) {
    e.preventDefault()
  }
  lastTouchEnd = now
}, { passive: false })

// Blocca lo zoom con la rotella del mouse (Ctrl + scroll)
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault()
  }
}, { passive: false })

// Blocca lo zoom con i gesti del trackpad (pinch)
document.addEventListener('gesturestart', (e) => {
  e.preventDefault()
}, { passive: false })

document.addEventListener('gesturechange', (e) => {
  e.preventDefault()
}, { passive: false })

document.addEventListener('gestureend', (e) => {
  e.preventDefault()
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
