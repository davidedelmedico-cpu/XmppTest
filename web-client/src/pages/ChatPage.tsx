import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { loadMessagesForContact, sendMessage, getLocalMessages, type Message } from '../services/messages'
import './ChatPage.css'

export function ChatPage() {
  const { jid: encodedJid } = useParams<{ jid: string }>()
  const navigate = useNavigate()
  const { client, isConnected, conversations, subscribeToMessages, markConversationAsRead } = useXmpp()
  
  const jid = encodedJid ? decodeURIComponent(encodedJid) : ''
  const conversation = conversations.find((c) => c.jid === jid)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)
  const lastScrollHeightRef = useRef(0)

  // Carica messaggi iniziali
  useEffect(() => {
    if (!client || !isConnected || !jid) {
      navigate('/conversations')
      return
    }

    loadInitialMessages()
    
    // Marca conversazione come letta
    markConversationAsRead(jid)
  }, [jid, client, isConnected])

  // Subscribe a messaggi real-time
  useEffect(() => {
    if (!jid) return

    const unsubscribe = subscribeToMessages(async (message) => {
      // Controlla se il messaggio è per questa conversazione
      const myBareJid = client?.jid?.split('/')[0].toLowerCase()
      const from = message.from?.split('/')[0].toLowerCase() || ''
      const to = message.to?.split('/')[0].toLowerCase() || ''
      const contactJid = from === myBareJid ? to : from

      if (contactJid === jid.toLowerCase()) {
        // Ricarica messaggi locali per mostrare il nuovo messaggio
        const updatedMessages = await getLocalMessages(jid)
        setMessages(updatedMessages)
        
        // Marca come letta
        markConversationAsRead(jid)
      }
    })

    return unsubscribe
  }, [jid, subscribeToMessages])

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
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }

    textarea.addEventListener('input', adjustHeight)
    return () => textarea.removeEventListener('input', adjustHeight)
  }, [])

  const loadInitialMessages = async () => {
    if (!client) return

    setIsLoading(true)
    setError(null)

    try {
      // Prima carica dalla cache locale (veloce)
      const localMessages = await getLocalMessages(jid, { limit: 50 })
      if (localMessages.length > 0) {
        setMessages(localMessages)
        setIsLoading(false)
      }

      // Poi carica dal server in background
      const result = await loadMessagesForContact(client, jid, { maxResults: 50 })
      setMessages(result.messages)
      setHasMoreMessages(!result.complete)
    } catch (err) {
      console.error('Errore nel caricamento messaggi:', err)
      setError('Impossibile caricare i messaggi')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMoreMessages = async () => {
    if (!client || isLoadingMore || !hasMoreMessages || messages.length === 0) return

    setIsLoadingMore(true)
    const oldestMessage = messages[0]

    try {
      const result = await loadMessagesForContact(client, jid, {
        maxResults: 50,
        beforeToken: oldestMessage.messageId,
      })

      if (result.messages.length > 0) {
        setMessages((prev) => [...result.messages, ...prev])
        setHasMoreMessages(!result.complete)
      } else {
        setHasMoreMessages(false)
      }
    } catch (err) {
      console.error('Errore nel caricamento messaggi precedenti:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Auto-scroll al bottom solo se già in fondo
  useEffect(() => {
    if (isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Traccia se l'utente è in fondo
  const handleScroll = () => {
    if (!messagesContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    // Considera "in fondo" se entro 100px dal bottom
    isAtBottomRef.current = distanceFromBottom < 100

    // Trigger load more se vicino al top
    if (scrollTop < 200 && hasMoreMessages && !isLoadingMore) {
      const currentScrollHeight = scrollHeight
      lastScrollHeightRef.current = currentScrollHeight
      loadMoreMessages()
    }
  }

  // Mantieni posizione scroll dopo loadMore
  useEffect(() => {
    if (messagesContainerRef.current && lastScrollHeightRef.current > 0) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight
      const heightDifference = newScrollHeight - lastScrollHeightRef.current
      messagesContainerRef.current.scrollTop = heightDifference
      lastScrollHeightRef.current = 0
    }
  }, [messages.length])

  const handleSend = async () => {
    if (!client || !inputValue.trim() || isSending) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsSending(true)
    setError(null)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const result = await sendMessage(client, jid, messageText)
      
      if (result.success) {
        // Ricarica messaggi locali per mostrare il nuovo messaggio
        const updatedMessages = await getLocalMessages(jid)
        setMessages(updatedMessages)
      } else {
        setError(result.error || 'Invio fallito')
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
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getContactName = () => {
    return conversation?.displayName || jid.split('@')[0] || 'Chat'
  }

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-page__header">
        <button 
          className="chat-page__back-btn"
          onClick={() => navigate('/conversations')}
          aria-label="Indietro"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="chat-page__contact-info">
          <h1 className="chat-page__contact-name">{getContactName()}</h1>
          <p className="chat-page__contact-status">Online</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="chat-page__error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Chiudi">✕</button>
        </div>
      )}

      {/* Messages Area */}
      <main 
        className="chat-page__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {isLoadingMore && (
          <div className="chat-page__load-more">
            <div className="chat-page__spinner"></div>
            <span>Caricamento...</span>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div className="chat-page__loading">
            <div className="chat-page__spinner"></div>
            <p>Caricamento messaggi...</p>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="chat-page__error">
            <p>{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-page__empty">
            <p>Nessun messaggio. Inizia la conversazione!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isMe = message.from === 'me'
              const showDate = index === 0 || 
                !isSameDay(messages[index - 1].timestamp, message.timestamp)

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
                          <span className="chat-page__message-status">
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
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      {/* Input Area */}
      <footer className="chat-page__input-area">
        <textarea
          ref={inputRef}
          className="chat-page__input"
          placeholder="Scrivi un messaggio..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isSending}
        />
        <button
          className="chat-page__send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          aria-label="Invia"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </footer>
    </div>
  )
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function formatDateSeparator(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return 'Oggi'
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Ieri'
  } else {
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  }
}
