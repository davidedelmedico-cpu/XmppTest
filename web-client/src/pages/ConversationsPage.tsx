import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { ConversationsList } from '../components/ConversationsList'
import '../App.css'

export function ConversationsPage() {
  const navigate = useNavigate()
  const { isConnected, disconnect, jid, error, isLoading } = useXmpp()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Se non connesso, reindirizza al login
  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  // Monitor refresh state from ConversationsList
  useEffect(() => {
    // Listen for refresh start/end events
    const handleRefreshStart = () => setIsRefreshing(true)
    const handleRefreshEnd = () => setIsRefreshing(false)

    window.addEventListener('refresh-start', handleRefreshStart)
    window.addEventListener('refresh-end', handleRefreshEnd)

    return () => {
      window.removeEventListener('refresh-start', handleRefreshStart)
      window.removeEventListener('refresh-end', handleRefreshEnd)
    }
  }, [])

  const handleLogout = () => {
    disconnect()
    navigate('/')
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="app-shell">
      <header className="hero" style={{ position: 'relative' }}>
        {/* Refresh spinner in alto a destra */}
        {(isRefreshing || isLoading) && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '24px',
              height: '24px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              zIndex: 10,
            }}
          />
        )}
        <div className="hero__copy">
          <h1>Alfred</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              {jid}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                background: 'rgba(248, 113, 113, 0.2)',
                border: '1px solid rgba(248, 113, 113, 0.4)',
                color: '#fecaca',
              }}
            >
              Disconnetti
            </button>
          </div>
        </div>
      </header>

      <main className="panels" style={{ maxWidth: '100%', gridTemplateColumns: '1fr' }}>
        {error && (
          <div className="status status--error" style={{ marginBottom: '1rem' }}>
            <p>Errore: {error}</p>
          </div>
        )}
        <ConversationsList />
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
