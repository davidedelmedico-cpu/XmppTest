import { lazy, Suspense, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider, useConnection } from './contexts/ConnectionContext'
import { ConversationsProvider } from './contexts/ConversationsContext'
import { MessagingProvider } from './contexts/MessagingContext'
import { AppInitializerWithCallback } from './components/AppInitializer'
import { LoginPopup } from './components/LoginPopup'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SplashScreen } from './components/SplashScreen'
import './App.css'

// Lazy load delle pagine per code splitting
const ConversationsPage = lazy(() => import('./pages/ConversationsPage').then(module => ({ default: module.ConversationsPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })))

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

function AppRoutes({ isInitializing }: { isInitializing: boolean }) {
  const { isConnected } = useConnection()

  return (
    <>
      {/* Skip link per accessibilità */}
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      {/* Route sempre accessibili - no routing condizionale */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/chat/:jid" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
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
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    // Nascondi splash screen dopo il caricamento iniziale
    if (document.readyState === 'complete') {
      setTimeout(() => setShowSplash(false), 0)
    } else {
      const handleLoad = () => setShowSplash(false)
      window.addEventListener('load', handleLoad)
      return () => window.removeEventListener('load', handleLoad)
    }
  }, [])

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      
      {/* Context orchestration: Auth → Connection → Conversations → Messaging */}
      <AuthProvider>
        <ConnectionProvider>
          <ConversationsProvider>
            <MessagingProvider>
              <HashRouter>
                <AppInitializerWithCallback>
                  {({ isInitializing }) => (
                    <AppRoutes isInitializing={isInitializing} />
                  )}
                </AppInitializerWithCallback>
              </HashRouter>
            </MessagingProvider>
          </ConversationsProvider>
        </ConnectionProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
