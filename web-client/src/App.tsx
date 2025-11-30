import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { XmppProvider, useXmpp } from './contexts/XmppContext'
import { ConversationsPage } from './pages/ConversationsPage'
import { ChatPage } from './pages/ChatPage'
import { LoginPopup } from './components/LoginPopup'
import { ErrorBoundary } from './components/ErrorBoundary'
import './App.css'

function AppRoutes() {
  const { isConnected, isInitializing, logoutIntentional } = useXmpp()

  return (
    <>
      {/* Route sempre accessibili - no routing condizionale */}
      <Routes>
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/chat/:jid" element={<ChatPage />} />
        <Route path="/" element={<Navigate to="/conversations" replace />} />
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
