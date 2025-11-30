import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConnection } from '../contexts/ConnectionContext'
import { ConversationsList } from '../components/ConversationsList'
import { NewConversationPopup } from '../components/NewConversationPopup'
import './ConversationsPage.css'

export function ConversationsPage() {
  const navigate = useNavigate()
  const { isConnected, disconnect, jid, client } = useConnection()
  const [showMenu, setShowMenu] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [userAvatar, setUserAvatar] = useState<{ data?: string; type?: string } | null>(null)

  const handleLogout = () => {
    // Chiudi prima il menu
    setShowMenu(false)
    // Poi esegui la disconnessione dopo un breve delay per permettere l'animazione di chiusura
    setTimeout(() => {
      disconnect()
    }, 200) // Delay per permettere l'animazione di chiusura del menu
  }

  const handleNewConversation = (jid: string) => {
    setShowNewConversation(false)
    // Naviga alla chat con il JID inserito
    navigate(`/chat/${encodeURIComponent(jid)}`)
  }

  const handleNavigateToProfile = () => {
    setShowMenu(false)
    navigate('/profile')
  }

  // Carica il vCard dell'utente per l'avatar
  useEffect(() => {
    const loadUserAvatar = async () => {
      if (!client || !jid) return
      
      try {
        const { getVCard } = await import('../services/vcard')
        const vcard = await getVCard(client, jid, false)
        if (vcard?.photoData && vcard?.photoType) {
          setUserAvatar({ data: vcard.photoData, type: vcard.photoType })
        }
      } catch (error) {
        console.error('Errore nel caricamento avatar utente:', error)
      }
    }
    
    loadUserAvatar()
  }, [client, jid])

  return (
    <div className="conversations-page">
      {/* Header Telegram-style */}
      <header className="conversations-page__header">
        <button 
          className="conversations-page__menu-btn"
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Apri menu"
          aria-expanded={showMenu}
          aria-controls="sidebar-menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <h1 className="conversations-page__title">Alfred</h1>
        <div className="conversations-page__header-actions">
          {!isConnected && (
            <div className="conversations-page__connection-status" role="status" aria-live="polite">
              <span className="conversations-page__status-dot" aria-hidden="true"></span>
              <span className="conversations-page__status-text">Non connesso</span>
            </div>
          )}
        </div>
      </header>

      {/* Menu laterale */}
      {showMenu && (
        <>
          <div 
            className="conversations-page__overlay"
            onClick={() => setShowMenu(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowMenu(false)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Chiudi menu"
          />
          <aside 
            className="conversations-page__sidebar"
            id="sidebar-menu"
            role="complementary"
            aria-label="Menu laterale"
          >
            <div className="conversations-page__sidebar-header">
              <div 
                className="conversations-page__user-info"
                onClick={handleNavigateToProfile}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNavigateToProfile()
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Vai al profilo"
                style={{ cursor: 'pointer' }}
              >
                <div className="conversations-page__user-avatar" aria-hidden="true">
                  {userAvatar?.data && userAvatar?.type ? (
                    <img 
                      src={`data:${userAvatar.type};base64,${userAvatar.data}`}
                      alt="Il tuo avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    jid?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="conversations-page__user-details">
                  <div className="conversations-page__user-name">Account</div>
                  <div className="conversations-page__user-jid" aria-label={`JID: ${jid}`}>{jid}</div>
                </div>
              </div>
            </div>
            
            <nav className="conversations-page__sidebar-nav scrollable-container" aria-label="Navigazione principale">
              <button 
                className="conversations-page__sidebar-item conversations-page__sidebar-item--active"
                aria-current="page"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Chat</span>
              </button>
              
              <button 
                className="conversations-page__sidebar-item" 
                aria-label="Profilo"
                onClick={handleNavigateToProfile}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Profilo</span>
              </button>
            </nav>
            
            <div className="conversations-page__sidebar-footer">
              <button 
                className="conversations-page__logout-btn"
                onClick={handleLogout}
                aria-label="Disconnetti dall'account"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Disconnetti</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Lista conversazioni - occupa tutto lo spazio rimanente */}
      <main id="main-content" className="conversations-page__main" role="main" tabIndex={-1}>
        <ConversationsList />
      </main>

      {/* Floating Action Button */}
      <button
        className="conversations-page__fab"
        onClick={() => setShowNewConversation(true)}
        aria-label="Nuova conversazione"
        title="Nuova conversazione"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          <line x1="9" y1="10" x2="15" y2="10"></line>
          <line x1="12" y1="7" x2="12" y2="13"></line>
        </svg>
      </button>

      {/* Popup nuova conversazione */}
      {showNewConversation && (
        <NewConversationPopup
          onClose={() => setShowNewConversation(false)}
          onSubmit={handleNewConversation}
        />
      )}
    </div>
  )
}
