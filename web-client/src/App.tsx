import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { ConversationsPage } from './pages/ConversationsPage'
import { LoginPopup } from './components/LoginPopup'
import './App.css'

function AppRoutes() {
  const { isConnected, isInitializing, logoutIntentional } = useXmpp()

  // Debug logging
  console.log('[AppRoutes] State:', { isConnected, isInitializing, logoutIntentional })
  console.log('[AppRoutes] Should show popup?', (isInitializing || !isConnected) && !logoutIntentional)

  return (
    <>
      {/* Route sempre accessibili - no routing condizionale */}
      <Routes>
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/" element={<Navigate to="/conversations" replace />} />
        {/* Altre route future vanno qui */}
      </Routes>

      {/* Popup di login globale - appare sopra le route quando necessario */}
      {/* Mostrato durante inizializzazione O quando non connesso (ma non dopo logout volontario) */}
      {(isInitializing || !isConnected) && !logoutIntentional && (
        <LoginPopup isInitializing={isInitializing} />
      )}
    </>
  )
}

function App() {
  return (
    <XmppProvider>
      <BrowserRouter basename="/XmppTest">
        <AppRoutes />
      </BrowserRouter>
    </XmppProvider>
  )
}

export default App
