import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { loadMessagesForContact, sendMessage, getLocalMessages, type Message } from '../services/messages'
import './ChatPage.css'

export function ChatPage() {
  const { jid: encodedJid } = useParams<{ jid: string }>()
  const navigate = useNavigate()
  const { client, isConnected, conversations, subscribeToMessages, markConversationAsRead, jid: myJid } = useXmpp()
  
  const jid = encodedJid ? decodeURIComponent(encodedJid) : ''
  const conversation = conversations.find((c) => c.jid === jid)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstToken, setFirstToken] = useState<string | undefined>(undefined) // Token per caricare messaggi più vecchi
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)
  const lastScrollHeightRef = useRef(0)
  const isMountedRef = useRef(true) // Previene setState dopo unmount

  // Cleanup al unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Subscribe a messaggi real-time
  useEffect(() => {
    if (!jid || !myJid) return

    const unsubscribe = subscribeToMessages(async (message) => {
      if (!isMountedRef.current) return

      // Controlla se il messaggio è per questa conversazione
      const myBareJid = myJid.split('/')[0].toLowerCase()
      const from = message.from?.split('/')[0].toLowerCase() || ''
      const to = message.to?.split('/')[0].toLowerCase() || ''
      const contactJid = from === myBareJid ? to : from

      if (contactJid === jid.toLowerCase()) {
        // Ricarica messaggi locali e merge con esistenti
        const updatedMessages = await getLocalMessages(jid)
        if (isMountedRef.current) {
          safeSetMessages(prev => mergeMessages(prev, updatedMessages))
          
          // Marca come letta
          markConversationAsRead(jid)
        }
      }
    })

    return unsubscribe
  }, [jid, myJid, subscribeToMessages, markConversationAsRead])

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

  // Helper: De-duplica e merge messaggi
  const mergeMessages = (existing: Message[], newMessages: Message[]): Message[] => {
    const messageMap = new Map<string, Message>()
    
    // Aggiungi messaggi esistenti
    existing.forEach(msg => messageMap.set(msg.messageId, msg))
    
    // Merge/sovrascrivi con nuovi messaggi (più recenti hanno priorità)
    newMessages.forEach(msg => {
      const existingMsg = messageMap.get(msg.messageId)
      
      // Se esiste già, mantieni lo status più aggiornato
      if (existingMsg) {
        // Se il nuovo messaggio ha status 'sent' e quello esistente era 'pending', aggiorna
        if (msg.status === 'sent' && existingMsg.status === 'pending') {
          messageMap.set(msg.messageId, msg)
        }
        // Altrimenti mantieni quello esistente (evita downgrade di status)
      } else {
        messageMap.set(msg.messageId, msg)
      }
    })
    
    // Converti in array e ordina per timestamp
    return Array.from(messageMap.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )
  }

  // Helper: Update messages in modo safe
  const safeSetMessages = (updater: (prev: Message[]) => Message[]) => {
    if (isMountedRef.current) {
      setMessages(updater)
    }
  }

  // Funzione per caricare messaggi iniziali
  const loadInitialMessages = async () => {
    if (!client) return

    if (!isMountedRef.current) return // Check prima di iniziare

    setIsLoading(true)
    setError(null)

    try {
      // Prima carica dalla cache locale (veloce)
      const localMessages = await getLocalMessages(jid, { limit: 50 })
      if (localMessages.length > 0 && isMountedRef.current) {
        safeSetMessages(() => localMessages)
        setIsLoading(false)
      }

      // Poi carica dal server in background
      const result = await loadMessagesForContact(client, jid, { maxResults: 50 })
      
      if (!isMountedRef.current) return // Check prima di setState
      
      // Merge con messaggi esistenti per evitare sostituzione brusca
      safeSetMessages(prev => mergeMessages(prev, result.messages))
      setHasMoreMessages(!result.complete)
      setFirstToken(result.firstToken) // Salva token per paginazione
    } catch (err) {
      console.error('Errore nel caricamento messaggi:', err)
      if (isMountedRef.current) {
        setError('Impossibile caricare i messaggi')
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  const loadMoreMessages = async () => {
    if (!client || isLoadingMore || !hasMoreMessages || !firstToken) return
    if (!isMountedRef.current) return

    setIsLoadingMore(true)

    try {
      // Usa il token RSM corretto per caricare messaggi PRIMA del primo attuale
      const result = await loadMessagesForContact(client, jid, {
        maxResults: 50,
        beforeToken: firstToken, // Usa il token salvato, non messageId!
      })

      if (!isMountedRef.current) return

      if (result.messages.length > 0) {
        // Merge invece di semplice concatenazione per evitare duplicati
        safeSetMessages(prev => mergeMessages(result.messages, prev))
        setHasMoreMessages(!result.complete)
        setFirstToken(result.firstToken) // Aggiorna token per il prossimo caricamento
      } else {
        setHasMoreMessages(false)
      }
    } catch (err) {
      console.error('Errore nel caricamento messaggi precedenti:', err)
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false)
      }
    }
  }

  // Carica messaggi iniziali
  useEffect(() => {
    if (!client || !isConnected || !jid) {
      navigate('/conversations')
      return
    }

    loadInitialMessages()
    
    // Marca conversazione come letta
    markConversationAsRead(jid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jid, client, isConnected])

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
      
      if (!isMountedRef.current) return

      if (result.success) {
        // Ricarica messaggi locali e merge
        const updatedMessages = await getLocalMessages(jid)
        if (isMountedRef.current) {
          safeSetMessages(prev => mergeMessages(prev, updatedMessages))
        }
      } else {
        setError(result.error || 'Invio fallito')
        // Ripristina il messaggio in caso di errore
        setInputValue(messageText)
      }
    } catch (err) {
      console.error('Errore nell\'invio:', err)
      if (isMountedRef.current) {
        setError('Errore nell\'invio del messaggio')
        // Ripristina il messaggio in caso di errore
        setInputValue(messageText)
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false)
      }
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
