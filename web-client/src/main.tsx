import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Inizializza il debug logger per intercettare tutti i console.log
import { debugLogger } from './services/debug-logger'
debugLogger.initialize()
console.log('Debug Logger inizializzato - tutti i log verranno raccolti')

// Blocca il pull-to-refresh nativo del browser su TUTTO il documento
let lastTouchY = 0
let isAtTop = true

// Helper per verificare se un elemento ha scroll interno
function hasScrollableParent(element: Element | null): boolean {
  if (!element) return false
  
  let current: Element | null = element
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    
    // Se l'elemento ha overflow-y: auto o scroll, è scrollabile
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return true
    }
    
    current = current.parentElement
  }
  
  return false
}

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
  
  // Non bloccare lo scroll se il touch è su un elemento con scroll interno
  const target = e.target as Element
  if (hasScrollableParent(target)) {
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

// Registrazione Service Worker per funzionalità offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usa il path corretto basato su base URL
    const swPath = import.meta.env.BASE_URL + 'sw.js'
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        console.log('Service Worker registrato con successo:', registration.scope)
        console.log('Service Worker path:', swPath)
        
        // Controlla aggiornamenti ogni ora
        setInterval(() => {
          registration.update()
        }, 3600000)
      })
      .catch((error) => {
        console.error('Registrazione Service Worker fallita:', error)
        console.error('Tentativo di registrare:', swPath)
      })
  })
}

// Gestione orientamento schermo - previene rotazione su mobile se necessario
if (typeof screen !== 'undefined' && 'orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
  // Prova a bloccare in portrait (opzionale, può fallire se non in fullscreen)
  try {
    (screen.orientation as { lock: (orientation: string) => Promise<void> }).lock('portrait-primary').catch(() => {
      // Fallisce silenziosamente se non permesso (richiede fullscreen o user gesture)
    })
  } catch {
    // Ignora errori se lock non è supportato
  }
}

// Listener per gestire cambi di orientamento
window.addEventListener('orientationchange', () => {
  // Forza un resize per aggiornare il layout dopo la rotazione
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 100)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
