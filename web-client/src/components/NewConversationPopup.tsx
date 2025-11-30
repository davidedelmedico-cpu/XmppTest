import { useState, type FormEvent } from 'react'
import './NewConversationPopup.css'

interface NewConversationPopupProps {
  onClose: () => void
  onSubmit: (jid: string) => void
}

export function NewConversationPopup({ onClose, onSubmit }: NewConversationPopupProps) {
  const [jid, setJid] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    const trimmedJid = jid.trim()
    
    if (!trimmedJid) {
      setError('Inserisci un JID')
      return
    }

    // Validazione base: almeno controllare che non sia vuoto
    // Il server/backend farà la validazione vera
    setError(null)
    onSubmit(trimmedJid)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Chiudi solo se si clicca sull'overlay, non sul modal
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="new-conversation-popup-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conversation-title"
    >
      <div className="new-conversation-popup-modal">
        <div className="new-conversation-popup-header">
          <h2 id="new-conversation-title">Nuova conversazione</h2>
          <button
            className="new-conversation-popup-close"
            onClick={onClose}
            aria-label="Chiudi"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="new-conversation-popup-form">
          <div className="new-conversation-popup-field">
            <label htmlFor="jid-input">
              <span>JID del contatto</span>
            </label>
            <input
              id="jid-input"
              type="text"
              value={jid}
              onChange={(e) => {
                setJid(e.target.value)
                setError(null)
              }}
              placeholder="esempio: utente@server.com"
              autoFocus
              autoComplete="off"
            />
            {error && (
              <span className="new-conversation-popup-error" role="alert">
                {error}
              </span>
            )}
          </div>

          <div className="new-conversation-popup-actions">
            <button
              type="button"
              onClick={onClose}
              className="new-conversation-popup-button new-conversation-popup-button--secondary"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="new-conversation-popup-button new-conversation-popup-button--primary"
            >
              Inizia chat
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
