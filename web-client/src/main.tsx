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
}, { passive: false })

document.addEventListener('touchmove', (e) => {
  const touchY = e.touches[0].clientY
  const touchDelta = touchY - lastTouchY
  
  // Se siamo in cima E stiamo trascinando verso il basso, blocca
  if (isAtTop && touchDelta > 0) {
    e.preventDefault()
  }
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
