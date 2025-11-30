import { useState, useRef, useEffect } from 'react'
import { useXmpp } from '../contexts/XmppContext'
import './ConversationsList.css'

export function ConversationsList() {
  const { conversations, isLoading, error, refreshConversations } = useXmpp()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Usa useRef per le variabili che devono persistere tra i render
  const touchStartY = useRef<number>(0)
  const touchCurrentY = useRef<number>(0)
  const isDragging = useRef<boolean>(false)
  const isPulling = useRef<boolean>(false)
  const currentPullDistance = useRef<number>(0)
  
  // Mantieni riferimento aggiornato a refreshConversations senza causare re-render
  const refreshConversationsRef = useRef(refreshConversations)
  useEffect(() => {
    refreshConversationsRef.current = refreshConversations
  }, [refreshConversations])
  
  // Mantieni riferimento aggiornato allo stato di caricamento
  const isLoadingRef = useRef(isLoading)
  const isRefreshingRef = useRef(isRefreshing)
  useEffect(() => {
    isLoadingRef.current = isLoading
    isRefreshingRef.current = isRefreshing
  }, [isLoading, isRefreshing])

  // Pull-to-refresh handler - SENZA dipendenze che cambiano frequentemente
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      console.log('🔴 Pull-to-refresh: Container NON trovato!')
      return
    }
    
    console.log('✅ Pull-to-refresh: Registrazione event listeners sul container:', container)

    const handleTouchStart = (e: TouchEvent) => {
      console.log('👆 TouchStart - scrollTop:', container.scrollTop)
      // Solo se siamo in cima alla lista
      if (container.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
        isDragging.current = true
        isPulling.current = true
        console.log('✅ Pull iniziato da Y:', touchStartY.current)
      } else {
        console.log('❌ Non in cima, scrollTop:', container.scrollTop)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !isPulling.current) return

      touchCurrentY.current = e.touches[0].clientY
      const distance = touchCurrentY.current - touchStartY.current
      console.log('👉 TouchMove - distance:', distance, 'scrollTop:', container.scrollTop)

      // Solo se trasciniamo verso il basso
      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault() // Previeni scroll normale
        const pullDist = Math.min(distance * 0.5, 100) // Riduci sensibilità, max 100px
        currentPullDistance.current = pullDist
        setPullDistance(pullDist)
        console.log('✅ Pull distance:', pullDist)
      } else if (distance <= 0) {
        // Reset se torniamo indietro
        isDragging.current = false
        isPulling.current = false
        currentPullDistance.current = 0
        setPullDistance(0)
        console.log('⬆️ Reset - drag verso l\'alto')
      }
    }

    const handleTouchEnd = () => {
      const finalDistance = currentPullDistance.current
      console.log('👋 TouchEnd - finalDistance:', finalDistance)
      
      // Usa i ref per controllare lo stato attuale senza dipendenze
      if (finalDistance > 50 && !isRefreshingRef.current && !isLoadingRef.current) {
        // Trigger refresh se trascinato abbastanza (50px)
        console.log('🔄 Avvio refresh!')
        setIsRefreshing(true)
        window.dispatchEvent(new CustomEvent('refresh-start'))
        refreshConversationsRef.current()
          .then(() => {
            // Piccolo delay per mostrare il completamento
            setTimeout(() => {
              setIsRefreshing(false)
              setPullDistance(0)
              currentPullDistance.current = 0
              window.dispatchEvent(new CustomEvent('refresh-end'))
              console.log('✅ Refresh completato!')
            }, 300)
          })
          .catch(() => {
            setIsRefreshing(false)
            setPullDistance(0)
            currentPullDistance.current = 0
            window.dispatchEvent(new CustomEvent('refresh-end'))
            console.log('❌ Refresh fallito!')
          })
      } else {
        // Reset con animazione
        console.log('↩️ Reset senza refresh (distance:', finalDistance, ')')
        setPullDistance(0)
        currentPullDistance.current = 0
      }
      
      isDragging.current = false
      isPulling.current = false
      touchStartY.current = 0
      touchCurrentY.current = 0
    }

    // CRITICAL: touchstart deve essere passive: false per permettere preventDefault in touchmove
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
    // NESSUNA dipendenza - gli event listeners vengono registrati una sola volta
  }, [])

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
      {pullDistance > 5 && (
        <div
          className="conversations-list__pull-refresh"
          style={{
            transform: `translateY(${60 + pullDistance}px)`,
            opacity: Math.min(pullDistance / 60, 1),
          }}
        >
          {isRefreshing || isLoading ? (
            <>
              <div className="conversations-list__spinner"></div>
              <span>Aggiornamento...</span>
            </>
          ) : (
            <>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transform: pullDistance > 50 ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              </svg>
              <span>{pullDistance > 50 ? 'Rilascia per aggiornare' : 'Trascina per aggiornare'}</span>
            </>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="conversations-list__items"
        style={{
          transform: `translateY(${Math.min(pullDistance, 100)}px)`,
          transition: pullDistance === 0 && !isRefreshing ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
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
