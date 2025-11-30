import { useState } from 'react'
import { useXmpp } from '../contexts/XmppContext'
import { ConversationsList } from '../components/ConversationsList'
import './ConversationsPage.css'

export function ConversationsPage() {
  const { isConnected, disconnect, jid } = useXmpp()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = () => {
    disconnect()
    // Non serve più navigate('/') - il popup non apparirà grazie a logoutIntentional
  }

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
              <div className="conversations-page__user-info">
                <div className="conversations-page__user-avatar" aria-hidden="true">
                  {jid?.charAt(0).toUpperCase()}
                </div>
                <div className="conversations-page__user-details">
                  <div className="conversations-page__user-name">Account</div>
                  <div className="conversations-page__user-jid" aria-label={`JID: ${jid}`}>{jid}</div>
                </div>
              </div>
            </div>
            
            <nav className="conversations-page__sidebar-nav" aria-label="Navigazione principale">
              <button 
                className="conversations-page__sidebar-item conversations-page__sidebar-item--active"
                aria-current="page"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Chat</span>
              </button>
              
              <button className="conversations-page__sidebar-item" aria-label="Contatti">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Contatti</span>
              </button>
              
              <button className="conversations-page__sidebar-item" aria-label="Impostazioni">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6m-9-9h6m6 0h6"></path>
                </svg>
                <span>Impostazioni</span>
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
      <main className="conversations-page__main" role="main">
        <ConversationsList />
      </main>
    </div>
  )
}
