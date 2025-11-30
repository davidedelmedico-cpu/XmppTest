import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { LoginPopup } from './components/LoginPopup'
import { ErrorBoundary } from './components/ErrorBoundary'
import './App.css'

// Lazy load delle pagine per code splitting
const ConversationsPage = lazy(() => import('./pages/ConversationsPage').then(module => ({ default: module.ConversationsPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })))

// Loading component per il lazy loading
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100vh',
    color: 'var(--text-color, #ffffff)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'var(--primary-color, #0084ff)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 1rem'
      }}></div>
      <p>Caricamento...</p>
    </div>
  </div>
)

function AppRoutes() {
  const { isConnected, isInitializing } = useXmpp()

  return (
    <>
      {/* Route sempre accessibili - no routing condizionale */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/chat/:jid" element={<ChatPage />} />
          <Route path="/" element={<Navigate to="/conversations" replace />} />
        </Routes>
      </Suspense>

      {/* Popup di login globale - appare sopra le route quando necessario */}
      {/* Mostrato durante inizializzazione O quando non connesso */}
      {(isInitializing || !isConnected) && (
        <LoginPopup isInitializing={isInitializing} />
      )}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <XmppProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </XmppProvider>
    </ErrorBoundary>
  )
}

export default App
