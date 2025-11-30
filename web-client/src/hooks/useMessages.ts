import { useState, useEffect, useRef, useCallback } from 'react'
import type { Agent } from 'stanza'
import {
  loadMessagesForContact,
  sendMessage as sendMessageService,
  getLocalMessages,
  reloadAllMessagesFromServer,
  type Message,
} from '../services/messages'
import { mergeMessages } from '../utils/message'
import { PAGINATION } from '../config/constants'

interface UseMessagesOptions {
  jid: string
  client: Agent | null
  isConnected: boolean
  onNewMessage?: (message: Message) => void
}

interface UseMessagesReturn {
  messages: Message[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreMessages: boolean
  error: string | null
  firstToken: string | undefined
  sendMessage: (body: string) => Promise<{ success: boolean; error?: string }>
  loadMoreMessages: () => Promise<void>
  reloadAllMessages: () => Promise<void>
  setError: (error: string | null) => void
}

/**
 * Custom hook per gestire i messaggi di una conversazione
 * Gestisce caricamento, invio, paginazione e sincronizzazione con il server
 * 
 * @param options - Opzioni di configurazione
 * @param options.jid - JID del contatto per cui gestire i messaggi
 * @param options.client - Client XMPP connesso
 * @param options.isConnected - Flag di connessione
 * @param options.onNewMessage - Callback chiamato quando arriva un nuovo messaggio
 * @returns Oggetto con stato e funzioni per gestire i messaggi
 * 
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading } = useMessages({
 *   jid: 'user@example.com',
 *   client,
 *   isConnected: true
 * })
 * ```
 */
export function useMessages({
  jid,
  client,
  isConnected,
  onNewMessage,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firstToken, setFirstToken] = useState<string | undefined>(undefined)
  
  const isMountedRef = useRef(true)

  // Cleanup al unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Helper: Update messages in modo safe
  const safeSetMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    if (isMountedRef.current) {
      setMessages(updater)
    }
  }, [])

  // Carica messaggi iniziali
  const loadInitialMessages = useCallback(async () => {
    if (!client || !jid) return
    if (!isMountedRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      // Prima carica dalla cache locale (veloce)
      const localMessages = await getLocalMessages(jid, { limit: PAGINATION.DEFAULT_MESSAGE_LIMIT })
      if (localMessages.length > 0 && isMountedRef.current) {
        safeSetMessages(() => localMessages)
        setIsLoading(false)
      }

      // Poi carica dal server in background
      const result = await loadMessagesForContact(client, jid, {
        maxResults: PAGINATION.DEFAULT_MESSAGE_LIMIT,
      })

      if (!isMountedRef.current) return

      // Merge con messaggi esistenti per evitare sostituzione brusca
      safeSetMessages((prev) => mergeMessages(prev, result.messages))
      setHasMoreMessages(!result.complete)
      setFirstToken(result.firstToken)
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
  }, [client, jid, safeSetMessages])

  // Carica messaggi iniziali quando cambia jid o client
  useEffect(() => {
    if (client && isConnected && jid) {
      loadInitialMessages()
    }
  }, [client, isConnected, jid, loadInitialMessages])

  // Carica più messaggi (paginazione)
  const loadMoreMessages = useCallback(async () => {
    if (!client || isLoadingMore || !hasMoreMessages || !firstToken) return
    if (!isMountedRef.current) return

    setIsLoadingMore(true)

    try {
      // Usa il token RSM corretto per caricare messaggi PRIMA del primo attuale
      const result = await loadMessagesForContact(client, jid, {
        maxResults: PAGINATION.DEFAULT_MESSAGE_LIMIT,
        beforeToken: firstToken,
      })

      if (!isMountedRef.current) return

      if (result.messages.length > 0) {
        // Merge invece di semplice concatenazione per evitare duplicati
        safeSetMessages((prev) => mergeMessages(result.messages, prev))
        setHasMoreMessages(!result.complete)
        setFirstToken(result.firstToken)
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
  }, [client, jid, isLoadingMore, hasMoreMessages, firstToken, safeSetMessages])

  // Ricarica tutti i messaggi dal server
  const reloadAllMessages = useCallback(async () => {
    if (!client || !jid) return
    if (!isMountedRef.current) return

    setError(null)

    try {
      // Ricarica tutto dal server (salva TUTTI i messaggi nel DB, inclusi ping/token/visualizzazioni)
      const serverMessages = await reloadAllMessagesFromServer(client, jid)

      if (isMountedRef.current) {
        // Filtra solo messaggi con body per la visualizzazione nella UI
        // (i messaggi vuoti rimangono salvati nel DB per altre funzionalità)
        const messagesToShow = serverMessages.filter(msg => msg.body && msg.body.trim().length > 0)
        setMessages(messagesToShow)
        setHasMoreMessages(false)
        setFirstToken(undefined)
      }
    } catch (err) {
      console.error('Errore nel reload completo messaggi:', err)
      if (isMountedRef.current) {
        setError('Impossibile ricaricare i messaggi')
      }
    }
  }, [client, jid])

  // Invia un messaggio usando il sistema di sincronizzazione
  const sendMessage = useCallback(
    async (body: string): Promise<{ success: boolean; error?: string }> => {
      if (!client || !body.trim()) {
        return { success: false, error: 'Messaggio vuoto o client non disponibile' }
      }

      setError(null)

      try {
        // sendMessageService ora usa il sistema di sincronizzazione:
        // 1. Invia al server
        // 2. Aspetta conferma
        // 3. Sincronizza tutto dal server (scaricando e salvando nel DB)
        const result = await sendMessageService(client, jid, body)

        if (!isMountedRef.current) return { success: false }

        if (result.success) {
          // Dopo la sincronizzazione, ricarica tutti i messaggi dal DB locale
          // (che ora contiene i dati sincronizzati dal server)
          const allMessages = await getLocalMessages(jid)

          if (isMountedRef.current) {
            safeSetMessages(() => allMessages)
          }

          // Notifica nuovo messaggio se callback presente
          if (onNewMessage && allMessages.length > 0) {
            const newMsg = allMessages[allMessages.length - 1]
            onNewMessage(newMsg)
          }
        } else {
          setError(result.error || 'Invio fallito')
        }

        return result
      } catch (err) {
        console.error('Errore nell\'invio:', err)
        const errorMsg = err instanceof Error ? err.message : 'Errore nell\'invio del messaggio'
        if (isMountedRef.current) {
          setError(errorMsg)
        }
        return { success: false, error: errorMsg }
      }
    },
    [client, jid, safeSetMessages, onNewMessage]
  )


  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMoreMessages,
    error,
    firstToken,
    sendMessage,
    loadMoreMessages,
    reloadAllMessages,
    setError,
  }
}
