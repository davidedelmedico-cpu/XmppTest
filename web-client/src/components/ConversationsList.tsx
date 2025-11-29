import { useState, useRef, useEffect } from 'react'
import { useXmpp } from '../contexts/XmppContext'
import './ConversationsList.css'

export function ConversationsList() {
  const { conversations, isLoading, error, refreshConversations } = useXmpp()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number>(0)
  const isPulling = useRef(false)

  // Pull-to-refresh handler
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
        isPulling.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return

      const currentY = e.touches[0].clientY
      const distance = Math.max(0, currentY - touchStartY.current)

      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault() // Previeni scroll normale
        setPullDistance(Math.min(distance, 80)) // Max 80px
      } else {
        isPulling.current = false
        setPullDistance(0)
      }
    }

    const handleTouchEnd = () => {
      if (pullDistance > 40 && !isRefreshing && !isLoading) {
        // Trigger refresh se trascinato abbastanza
        setIsRefreshing(true)
        refreshConversations().finally(() => {
          setIsRefreshing(false)
          setPullDistance(0)
        })
      } else {
        // Reset se non abbastanza
        setPullDistance(0)
      }
      isPulling.current = false
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, isRefreshing, isLoading, refreshConversations])

  const formatTimestamp = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      // Oggi: mostra solo l'ora
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Ieri'
    } else if (days < 7) {
      return `${days}g fa`
    } else {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    }
  }

  const truncateMessage = (body: string, maxLength = 50): string => {
    if (body.length <= maxLength) {
      return body
    }
    return body.substring(0, maxLength).trim() + '...'
  }

  const getInitials = (jid: string, displayName?: string): string => {
    if (displayName) {
      const parts = displayName.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return displayName[0]?.toUpperCase() || '?'
    }
    return jid.split('@')[0][0]?.toUpperCase() || '?'
  }

  if (error && conversations.length === 0) {
    return (
      <div className="conversations-list">
        <div className="conversations-list__error">
          <p>Errore: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conversations-list">
      <div className="conversations-list__header">
        <h2>Chat</h2>
      </div>

      {/* Pull-to-refresh indicator */}
      <div
        className="conversations-list__pull-refresh"
        style={{
          transform: `translateY(${pullDistance - 60}px)`,
          opacity: pullDistance > 10 ? Math.min(pullDistance / 60, 1) : 0,
        }}
      >
        {isRefreshing || isLoading ? (
          <div className="conversations-list__spinner"></div>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: pullDistance > 40 ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          </svg>
        )}
        <span>{isRefreshing || isLoading ? 'Aggiornamento...' : 'Trascina per aggiornare'}</span>
      </div>

      <div
        ref={containerRef}
        className="conversations-list__items"
        style={{
          transform: `translateY(${Math.min(pullDistance, 80)}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {isLoading && conversations.length === 0 ? (
          <div className="conversations-list__loading">
            <div className="conversations-list__spinner"></div>
            <p>Caricamento conversazioni...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="conversations-list__empty">
            <p>Nessuna conversazione</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div key={conv.jid} className="conversation-item">
              <div className="conversation-item__avatar">
                {getInitials(conv.jid, conv.displayName)}
              </div>
              <div className="conversation-item__content">
                <div className="conversation-item__header">
                  <span className="conversation-item__name">
                    {conv.displayName || conv.jid.split('@')[0]}
                  </span>
                  <span className="conversation-item__time">
                    {formatTimestamp(conv.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="conversation-item__preview">
                  <span className={`conversation-item__sender ${conv.lastMessage.from}`}>
                    {conv.lastMessage.from === 'me' ? 'Tu: ' : ''}
                  </span>
                  <span className="conversation-item__body">
                    {truncateMessage(conv.lastMessage.body)}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="conversation-item__unread">{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
