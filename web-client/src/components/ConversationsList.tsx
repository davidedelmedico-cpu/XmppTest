import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConversations } from '../contexts/ConversationsContext'
import { truncateMessage, getInitials } from '../utils/message'
import { formatConversationTimestamp } from '../utils/date'
import { PULL_TO_REFRESH } from '../config/constants'
import './ConversationsList.css'

// formatConversationTimestamp è usato alla riga 234 nel rendering del timestamp

export function ConversationsList() {
  const navigate = useNavigate()
  const { conversations, isLoading, error, refreshAll } = useConversations()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  // Usa useRef per le variabili che devono persistere tra i render
  const touchStartY = useRef<number>(0)
  const touchCurrentY = useRef<number>(0)
  const isDragging = useRef<boolean>(false)
  const currentPullDistance = useRef<number>(0)
  
  // Mantieni riferimento aggiornato a refreshAll senza causare re-render
  const refreshAllRef = useRef(refreshAll)
  useEffect(() => {
    refreshAllRef.current = refreshAll
  }, [refreshAll])
  
  // Mantieni riferimento aggiornato allo stato di caricamento
  const isLoadingRef = useRef(isLoading)
  const isRefreshingRef = useRef(isRefreshing)
  useEffect(() => {
    isLoadingRef.current = isLoading
    isRefreshingRef.current = isRefreshing
  }, [isLoading, isRefreshing])

  // Pull-to-refresh handler - ascolta sul wrapper principale
  useEffect(() => {
    const wrapper = wrapperRef.current
    const scrollContainer = scrollContainerRef.current
    if (!wrapper || !scrollContainer) return

    const handleTouchStart = (e: TouchEvent) => {
      // Solo se siamo in cima alla lista
      if (scrollContainer.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
        isDragging.current = true
        currentPullDistance.current = 0
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      
      const scrollTop = scrollContainer.scrollTop
      touchCurrentY.current = e.touches[0].clientY
      const distance = touchCurrentY.current - touchStartY.current

      // Solo se trasciniamo verso il basso E siamo in cima
      if (distance > 0 && scrollTop === 0) {
        // Previeni SEMPRE lo scroll nativo quando siamo in pull mode
        e.preventDefault()
        e.stopPropagation()
        
        // Riduci la sensibilità: usa radice quadrata per effetto "gomma"
        // Limita a 100px max per evitare di andare troppo in basso
        const pullDist = Math.min(Math.sqrt(distance * 30), 100)
        currentPullDistance.current = pullDist
        setPullDistance(pullDist)
      } else if (distance <= 0) {
        // Se si torna su, resetta
        isDragging.current = false
        currentPullDistance.current = 0
        setPullDistance(0)
      }
    }

    const handleTouchEnd = () => {
      if (!isDragging.current) return
      
      const finalDistance = currentPullDistance.current
      
      // Usa i ref per controllare lo stato attuale senza dipendenze
      if (finalDistance > PULL_TO_REFRESH.THRESHOLD && !isRefreshingRef.current && !isLoadingRef.current) {
        // Trigger refresh se trascinato abbastanza
        setIsRefreshing(true)
        window.dispatchEvent(new CustomEvent('refresh-start'))
        refreshAllRef.current()
          .then(() => {
            setTimeout(() => {
              setIsRefreshing(false)
              setPullDistance(0)
              currentPullDistance.current = 0
              window.dispatchEvent(new CustomEvent('refresh-end'))
            }, PULL_TO_REFRESH.ANIMATION_DURATION)
          })
          .catch(() => {
            setIsRefreshing(false)
            setPullDistance(0)
            currentPullDistance.current = 0
            window.dispatchEvent(new CustomEvent('refresh-end'))
          })
      } else {
        // Reset con animazione
        setPullDistance(0)
        currentPullDistance.current = 0
      }
      
      isDragging.current = false
      touchStartY.current = 0
      touchCurrentY.current = 0
    }

    // Ascolta sul wrapper, NON sul container scrollabile
    wrapper.addEventListener('touchstart', handleTouchStart, { passive: false })
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: false })
    wrapper.addEventListener('touchend', handleTouchEnd, { passive: true })
    wrapper.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      wrapper.removeEventListener('touchstart', handleTouchStart)
      wrapper.removeEventListener('touchmove', handleTouchMove)
      wrapper.removeEventListener('touchend', handleTouchEnd)
      wrapper.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])


  const handleConversationClick = (jid: string) => {
    navigate(`/chat/${encodeURIComponent(jid)}`)
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
    <div ref={wrapperRef} className="conversations-list">

      {/* Pull-to-refresh indicator - mostrato solo durante pull o refresh */}
        {(pullDistance > 5 || isRefreshing) && (
        <div
          className="conversations-list__pull-refresh"
          role="status"
          aria-live="polite"
          aria-label={isRefreshing ? 'Aggiornamento in corso' : pullDistance > PULL_TO_REFRESH.THRESHOLD ? 'Rilascia per aggiornare' : 'Trascina per aggiornare'}
          style={{
            transform: `translateY(${60 + (isRefreshing ? 50 : pullDistance)}px)`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 60, 1),
          }}
        >
          {isRefreshing ? (
            <>
              <div className="conversations-list__spinner" aria-hidden="true"></div>
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
                aria-hidden="true"
                style={{
                  transform: pullDistance > 60 ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              </svg>
              <span>{pullDistance > PULL_TO_REFRESH.THRESHOLD ? 'Rilascia per aggiornare' : 'Trascina per aggiornare'}</span>
            </>
          )}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="conversations-list__items scrollable-container"
        role="list"
        aria-label="Lista conversazioni"
      >
        {isLoading && conversations.length === 0 ? (
          <div className="conversations-list__loading" role="status" aria-live="polite">
            <div className="conversations-list__spinner" aria-hidden="true"></div>
            <p>Caricamento conversazioni...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="conversations-list__empty" role="status">
            <p>Nessuna conversazione</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div 
              key={conv.jid} 
              className="conversation-item"
              role="listitem"
              onClick={() => handleConversationClick(conv.jid)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleConversationClick(conv.jid)
                }
              }}
              tabIndex={0}
              aria-label={`Conversazione con ${conv.displayName || conv.jid}. ${conv.unreadCount > 0 ? `${conv.unreadCount} messaggi non letti.` : ''} Ultimo messaggio: ${conv.lastMessage.body}`}
            >
              <div className="conversation-item__avatar">
                {conv.avatarData && conv.avatarType ? (
                  <img 
                    src={`data:${conv.avatarType};base64,${conv.avatarData}`}
                    alt={`Avatar di ${conv.displayName || conv.jid}`}
                    className="conversation-item__avatar-img"
                  />
                ) : (
                  <span className="conversation-item__avatar-initials">
                    {getInitials(conv.jid, conv.displayName)}
                  </span>
                )}
              </div>
              <div className="conversation-item__content">
                <div className="conversation-item__header">
                  <span className="conversation-item__name">
                    {conv.displayName || conv.jid}
                  </span>
                  <time 
                    className="conversation-item__time"
                    dateTime={conv.lastMessage.timestamp.toISOString()}
                  >
                    {formatConversationTimestamp(conv.lastMessage.timestamp)}
                  </time>
                </div>
                <div className="conversation-item__preview">
                  <span className={`conversation-item__sender ${conv.lastMessage.from}`} aria-hidden="true">
                    {conv.lastMessage.from === 'me' ? 'Tu: ' : ''}
                  </span>
                  <span className="conversation-item__body">
                    {truncateMessage(conv.lastMessage.body, 50)}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span 
                      className="conversation-item__unread"
                      aria-label={`${conv.unreadCount} messaggi non letti`}
                    >
                      {conv.unreadCount}
                    </span>
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
