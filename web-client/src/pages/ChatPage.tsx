import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { useMessages } from '../hooks/useMessages'
import { useChatScroll } from '../hooks/useChatScroll'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useBackButton } from '../hooks/useBackButton'
import { formatDateSeparator, formatMessageTime, isSameDay } from '../utils/date'
import { isValidJid } from '../utils/jid'
import { TEXT_LIMITS } from '../config/constants'
import './ChatPage.css'

/**
 * Pagina principale per la visualizzazione e gestione di una chat
 * Utilizza custom hooks per separare le responsabilità:
 * - useMessages: gestione stato e operazioni sui messaggi
 * - useChatScroll: gestione scroll e paginazione
 * - usePullToRefresh: gestione pull-to-refresh
 */
export function ChatPage() {
  const { jid: encodedJid } = useParams<{ jid: string }>()
  const navigate = useNavigate()
  const { client, isConnected, conversations, subscribeToMessages, markConversationAsRead, reloadConversationsFromDB, jid: myJid } = useXmpp()
  
  const jid = useMemo(() => encodedJid ? decodeURIComponent(encodedJid) : '', [encodedJid])
  const conversation = useMemo(() => conversations.find((c) => c.jid === jid), [conversations, jid])
  
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Validate JID format - redirect if invalid
  useEffect(() => {
    if (jid && !isValidJid(jid)) {
      console.error('JID non valido:', jid)
      navigate('/conversations', { replace: true })
    }
  }, [jid, navigate])

  // Gestione back button
  useBackButton()

  // Custom hook per gestione messaggi
  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMoreMessages,
    error,
    sendMessage: sendMessageHook,
    loadMoreMessages,
    reloadAllMessages,
    setError,
  } = useMessages({
    jid,
    client,
    isConnected,
  })

  // Custom hook per gestione scroll
  const {
    messagesContainerRef,
    messagesEndRef,
    isAtBottomRef,
    handleScroll,
    scrollToBottom,
  } = useChatScroll({
    messages,
    isLoadingMore,
    hasMoreMessages,
    onLoadMore: loadMoreMessages,
  })

  // Custom hook per pull-to-refresh
  const {
    isRefreshing: isPullRefreshing,
    pullIndicatorRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh({
    onRefresh: async () => {
      // Ricarica messaggi dal server
      await reloadAllMessages()
      
      // Aggiorna vCard del contatto (forza refresh) e ricarica conversazioni
      if (client && jid) {
        try {
          const { getVCard, getDisplayName } = await import('../services/vcard')
          const { updateConversation } = await import('../services/conversations-db')
          
          // Scarica il vCard aggiornato dal server
          const vcard = await getVCard(client, jid, true) // forceRefresh = true
          
          // Aggiorna la conversazione nel database con i nuovi dati vCard
          if (vcard) {
            const displayName = getDisplayName(jid, conversation?.displayName, vcard)
            await updateConversation(jid, {
              displayName,
              avatarData: vcard.photoData,
              avatarType: vcard.photoType,
            })
            
            // Ricarica le conversazioni dal database per aggiornare la UI
            await reloadConversationsFromDB()
          }
        } catch (error) {
          console.error('Errore nel refresh vCard durante pull-to-refresh:', error)
        }
      }
      
      setTimeout(() => {
        scrollToBottom('smooth')
      }, 100)
    },
    enabled: !isLoadingMore,
  })

  // Handle virtual keyboard on mobile
  useEffect(() => {
    // Prevent viewport resize when keyboard opens on mobile
    const handleResize = () => {
      // On mobile devices, use visualViewport if available
      if (window.visualViewport && messagesContainerRef.current) {
        const viewport = window.visualViewport
        const viewportHeight = viewport.height
        
        // Adjust messages container to account for keyboard
        const messagesContainer = messagesContainerRef.current
        if (messagesContainer) {
          // Calculate new bottom position accounting for keyboard
          const inputHeight = 68
          const keyboardHeight = window.innerHeight - viewportHeight
          
          // Only adjust if keyboard is actually open (significant height difference)
          if (keyboardHeight > 50) {
            // Keyboard is open - adjust the bottom to keep messages visible
            messagesContainer.style.bottom = `${inputHeight}px`
            messagesContainer.style.paddingBottom = `${keyboardHeight}px`
          } else {
            // Keyboard is closed - reset to normal
            messagesContainer.style.bottom = '68px'
            messagesContainer.style.paddingBottom = '1rem'
          }
          
          // If user was at bottom, keep them at bottom after keyboard opens
          if (isAtBottomRef.current && messagesEndRef.current) {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }
        }
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      window.visualViewport.addEventListener('scroll', handleResize)
      
      // Initial call to set correct state
      handleResize()
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
        window.visualViewport?.removeEventListener('scroll', handleResize)
      }
    }
  }, [messagesContainerRef, isAtBottomRef, messagesEndRef])

  // Subscribe a messaggi real-time
  useEffect(() => {
    if (!jid || !myJid) return

    const unsubscribe = subscribeToMessages(async (message) => {
      // Controlla se il messaggio è per questa conversazione
      const myBareJid = myJid.split('/')[0].toLowerCase()
      const from = message.from?.split('/')[0].toLowerCase() || ''
      const to = message.to?.split('/')[0].toLowerCase() || ''
      const contactJid = from === myBareJid ? to : from

      if (contactJid === jid.toLowerCase()) {
        // Aggiorna messaggi (gestito internamente da useMessages tramite subscribe)
        // Marca come letta
        markConversationAsRead(jid)
      }
    })

    return unsubscribe
  }, [jid, myJid, subscribeToMessages, markConversationAsRead])

  // Marca conversazione come letta quando si apre
  useEffect(() => {
    if (jid && client && isConnected) {
      markConversationAsRead(jid)
    }
  }, [jid, client, isConnected, markConversationAsRead])

  // Auto-focus su input quando la chat si carica
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, TEXT_LIMITS.MAX_TEXTAREA_HEIGHT) + 'px'
    }

    textarea.addEventListener('input', adjustHeight)
    return () => textarea.removeEventListener('input', adjustHeight)
  }, [])

  // Handler per invio messaggio
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isSending) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsSending(true)
    setError(null)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const result = await sendMessageHook(messageText)

      if (!result.success) {
        // Ripristina il messaggio in caso di errore
        setInputValue(messageText)
      }
    } catch (err) {
      console.error('Errore nell\'invio:', err)
      setError('Errore nell\'invio del messaggio')
      // Ripristina il messaggio in caso di errore
      setInputValue(messageText)
    } finally {
      setIsSending(false)
    }
  }, [inputValue, isSending, sendMessageHook, setError])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const getContactName = useCallback(() => {
    return conversation?.displayName || jid.split('@')[0] || 'Chat'
  }, [conversation, jid])

  // Memoizza il rendering dei messaggi per performance
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const isMe = message.from === 'me'
      const showDate = index === 0 || !isSameDay(messages[index - 1].timestamp, message.timestamp)

      return (
        <div key={message.messageId}>
          {showDate && (
            <div className="chat-page__date-separator">
              {formatDateSeparator(message.timestamp)}
            </div>
          )}
          <div className={`chat-page__message ${isMe ? 'chat-page__message--me' : 'chat-page__message--them'}`}>
            <div className="chat-page__message-bubble">
              <p className="chat-page__message-body">{message.body}</p>
              <div className="chat-page__message-meta">
                <span className="chat-page__message-time">
                  {formatMessageTime(message.timestamp)}
                </span>
                {isMe && (
                  <span className="chat-page__message-status" aria-label={`Messaggio ${message.status}`}>
                    {message.status === 'pending' && '🕐'}
                    {message.status === 'sent' && '✓'}
                    {message.status === 'failed' && '✗'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    })
  }, [messages])

  return (
    <div id="main-content" className="chat-page" role="main" tabIndex={-1}>
      {/* Header */}
      <header className="chat-page__header">
        <button 
          className="chat-page__back-btn"
          onClick={() => navigate('/conversations')}
          aria-label="Torna alla lista conversazioni"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="chat-page__contact-avatar">
          {conversation?.avatarData && conversation?.avatarType ? (
            <img 
              src={`data:${conversation.avatarType};base64,${conversation.avatarData}`}
              alt={`Avatar di ${getContactName()}`}
              className="chat-page__avatar-img"
            />
          ) : (
            <span className="chat-page__avatar-initials">
              {getContactName().slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="chat-page__contact-info">
          <h1 className="chat-page__contact-name">{getContactName()}</h1>
          <p className="chat-page__contact-status" aria-live="polite">Online</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="chat-page__error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Chiudi messaggio di errore">✕</button>
        </div>
      )}

      {/* Messages Area */}
      <main 
        className="chat-page__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="log"
        aria-label="Messaggi della conversazione"
      >
        {isLoadingMore && !isPullRefreshing && (
          <div className="chat-page__load-more" aria-live="polite">
            <div className="chat-page__spinner" aria-hidden="true"></div>
            <span>Caricamento...</span>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div className="chat-page__loading" role="status" aria-live="polite">
            <div className="chat-page__spinner" aria-hidden="true"></div>
            <p>Caricamento messaggi...</p>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="chat-page__error" role="alert">
            <p>{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-page__empty">
            <p>Nessun messaggio. Inizia la conversazione!</p>
          </div>
        ) : (
          <>
            {renderedMessages}
            <div ref={messagesEndRef} aria-hidden="true" />
          </>
        )}
        
        {/* Pull to refresh indicator (at bottom) */}
        <div 
          ref={pullIndicatorRef}
          className="chat-page__pull-refresh-bottom"
          style={{ opacity: 0 }}
          aria-live="polite"
          aria-label={isPullRefreshing ? 'Ricaricamento in corso' : 'Rilascia per ricaricare'}
        >
          {isPullRefreshing ? (
            <>
              <div className="chat-page__spinner" aria-hidden="true"></div>
              <span>Ricaricamento storico...</span>
            </>
          ) : (
            <>
              <span>↑ Rilascia per ricaricare</span>
            </>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="chat-page__input-area" role="complementary">
        <textarea
          ref={inputRef}
          className="chat-page__input"
          placeholder="Scrivi un messaggio..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isSending}
          aria-label="Campo di testo per scrivere un messaggio"
          aria-describedby="send-button"
        />
        <button
          id="send-button"
          className="chat-page__send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          aria-label={isSending ? 'Invio in corso...' : 'Invia messaggio'}
          aria-disabled={!inputValue.trim() || isSending}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </footer>
    </div>
  )
}
