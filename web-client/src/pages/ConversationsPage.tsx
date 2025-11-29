import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { ConversationsList } from '../components/ConversationsList'
import '../App.css'

export function ConversationsPage() {
  const navigate = useNavigate()
  const { isConnected, disconnect, jid, error } = useXmpp()

  // Se non connesso, reindirizza al login
  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleLogout = () => {
    disconnect()
    navigate('/')
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="app-shell">
      <header className="hero">
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
    </div>
  )
}
