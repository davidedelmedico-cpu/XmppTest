import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { login, type XmppResult } from '../services/xmpp'
import {
  loadAllConversations,
  enrichWithRoster,
} from '../services/conversations'
import { getConversations, type Conversation, updateConversation } from '../services/conversations-db'
import { saveCredentials, loadCredentials, clearCredentials } from '../services/auth-storage'
import { handleIncomingMessageAndSync } from '../services/sync'

type MessageCallback = (message: ReceivedMessage) => void

interface XmppContextType {
  client: Agent | null
  isConnected: boolean
  jid: string | null
  conversations: Conversation[]
  isLoading: boolean
  isInitializing: boolean
  error: string | null
  logoutIntentional: boolean
  connect: (jid: string, password: string) => Promise<void>
  disconnect: () => void
  refreshAllConversations: () => Promise<void>  // Rinominato da refreshConversations
  refreshSingleConversation: (jid: string) => Promise<void>  // NUOVO
  reloadConversationsFromDB: () => Promise<void>
  subscribeToMessages: (callback: MessageCallback) => () => void
  markConversationAsRead: (jid: string) => Promise<void>
}

const XmppContext = createContext<XmppContextType | undefined>(undefined)

export function XmppProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Agent | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [jid, setJid] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logoutIntentional, setLogoutIntentional] = useState(false)
  const hasInitialized = useRef(false)
  const messageCallbacks = useRef<Set<MessageCallback>>(new Set())

  // Inizializzazione al caricamento: controlla credenziali e tenta login
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const initialize = async () => {
      setIsInitializing(true)
      setError(null)

      // Controlla se ci sono credenziali salvate
      const saved = loadCredentials()
      
      if (saved) {
        // Ci sono credenziali: tenta il login
        try {
          setIsLoading(true)
          const result: XmppResult = await login({ jid: saved.jid, password: saved.password })

          if (!result.success || !result.client) {
            throw new Error(result.message || 'Login fallito')
          }

          // Login riuscito
          const xmppClient = result.client
          setClient(xmppClient)
          setIsConnected(true)
          setJid(result.jid || saved.jid)

          // Carica conversazioni dalla cache locale
          const cachedConversations = await getConversations()
          if (cachedConversations.length > 0) {
            const enrichedCached = await enrichWithRoster(xmppClient, cachedConversations)
            setConversations(enrichedCached)
          }

          // Carica conversazioni dal server in background
          void (async () => {
            try {
              setIsLoading(true)
              const loaded = await loadAllConversations(xmppClient)
              const enriched = await enrichWithRoster(xmppClient, loaded)
              setConversations(enriched)
            } catch (err) {
              console.error('Errore nel caricamento conversazioni:', err)
              setError(err instanceof Error ? err.message : 'Errore nel caricamento')
            } finally {
              setIsLoading(false)
            }
          })()
        } catch (err) {
          // Login fallito: cancella credenziali e vai a login page
          console.error('Login automatico fallito:', err)
          clearCredentials()
          setError(err instanceof Error ? err.message : 'Login fallito')
          setIsConnected(false)
        } finally {
          setIsLoading(false)
        }
      } else {
        // Nessuna credenziale: vai a login page
        setIsConnected(false)
      }

      // Fine inizializzazione
      setIsInitializing(false)
    }

    initialize()
  }, [])

  // Gestione eventi real-time quando client è connesso
  useEffect(() => {
    if (!client || !isConnected) {
      return
    }

    const handleMessage = async (message: ReceivedMessage) => {
      if (!jid || !message.body || !client) return

      try {
        // Usa il sistema di sincronizzazione: sincronizza tutto dal server
        // NON scriviamo direttamente nel database - la sincronizzazione lo fa
        // handleIncomingMessageAndSync determina il JID del contatto internamente
        await handleIncomingMessageAndSync(client, message, jid)

        // 3. Aggiorna lista conversazioni dal database (ora sincronizzato)
        const updated = await getConversations()
        setConversations(updated)

        // 4. Notifica i callback registrati con il messaggio completo (per ChatPage attiva)
        messageCallbacks.current.forEach((callback) => {
          callback(message)
        })
      } catch (error) {
        console.error('Errore nella gestione del messaggio in arrivo:', error)
      }
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      setClient(null)
      setJid(null)
      // Reset logoutIntentional per permettere al popup di login di apparire
      setLogoutIntentional(false)
    }

    client.on('message', handleMessage)
    client.on('disconnected', handleDisconnected)

    return () => {
      client.off('message', handleMessage)
      client.off('disconnected', handleDisconnected)
    }
  }, [client, isConnected, jid])

  const connect = async (jid: string, password: string) => {
    // Reset flag quando l'utente fa login manualmente
    setLogoutIntentional(false)
    setIsLoading(true)
    setError(null)

    try {
      const result: XmppResult = await login({ jid, password })

      if (!result.success || !result.client) {
        throw new Error(result.message || 'Login fallito')
      }

      const xmppClient = result.client
      setClient(xmppClient)
      setIsConnected(true)
      setJid(result.jid || jid)

      // Salva le credenziali
      saveCredentials(jid, password)

      // Carica conversazioni dalla cache locale
      const cachedConversations = await getConversations()
      if (cachedConversations.length > 0) {
        const enrichedCached = await enrichWithRoster(xmppClient, cachedConversations)
        setConversations(enrichedCached)
      }

      setIsLoading(false)

      // Carica conversazioni dal server in background
      void (async () => {
        try {
          setIsLoading(true)
          const loaded = await loadAllConversations(xmppClient)
          const enriched = await enrichWithRoster(xmppClient, loaded)
          setConversations(enriched)
        } catch (err) {
          console.error('Errore nel caricamento conversazioni:', err)
          setError(err instanceof Error ? err.message : 'Errore nel caricamento')
        } finally {
          setIsLoading(false)
        }
      })()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore di connessione'
      setError(errorMessage)
      clearCredentials()
      setIsLoading(false)
      throw err
    }
  }

  const disconnect = () => {
    if (client) {
      client.disconnect()
    }
    setClient(null)
    setIsConnected(false)
    setJid(null)
    setConversations([])
    clearCredentials()
    // Reset logoutIntentional per permettere al popup di login di apparire
    setLogoutIntentional(false)
  }

  const refreshAllConversations = async () => {
    if (!client || !isConnected) {
      return
    }

    setIsLoading(true)
    try {
      // Usa la nuova funzione di sincronizzazione completa
      // Questa scarica TUTTO: conversazioni, messaggi e vCard
      const { syncAllConversationsComplete } = await import('../services/sync')
      const result = await syncAllConversationsComplete(client)
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nella sincronizzazione')
      }
      
      // Ricarica conversazioni dal database (ora complete con messaggi e vCard)
      const updated = await getConversations()
      setConversations(updated)
    } catch (err) {
      console.error('Errore nel refresh completo conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel refresh')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshSingleConversation = useCallback(async (contactJid: string) => {
    if (!client || !isConnected) {
      return
    }

    try {
      // Usa la nuova funzione di sincronizzazione completa per singola conversazione
      // Questa scarica messaggi e vCard solo per quel contatto
      const { syncSingleConversationComplete } = await import('../services/sync')
      const result = await syncSingleConversationComplete(client, contactJid)
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nella sincronizzazione')
      }
      
      // Ricarica conversazioni dal database (la conversazione aggiornata sarà inclusa)
      const updated = await getConversations()
      setConversations(updated)
    } catch (err) {
      console.error('Errore nel refresh conversazione singola:', err)
      setError(err instanceof Error ? err.message : 'Errore nel refresh')
    }
  }, [client, isConnected])

  const subscribeToMessages = useCallback((callback: MessageCallback) => {
    messageCallbacks.current.add(callback)
    
    // Ritorna una funzione per unsubscribe
    return () => {
      messageCallbacks.current.delete(callback)
    }
  }, []) // Nessuna dependency: usa solo ref

  const reloadConversationsFromDB = useCallback(async () => {
    try {
      const updated = await getConversations()
      setConversations(updated)
    } catch (error) {
      console.error('Errore nel ricaricamento conversazioni dal DB:', error)
    }
  }, [])

  const markConversationAsRead = useCallback(async (conversationJid: string) => {
    try {
      await updateConversation(conversationJid, { unreadCount: 0 })
      const updated = await getConversations()
      setConversations(updated)
    } catch (error) {
      console.error('Errore nel marcare conversazione come letta:', error)
    }
  }, []) // Nessuna dependency: funzioni pure

  return (
    <XmppContext.Provider
      value={{
        client,
        isConnected,
        jid,
        conversations,
        isLoading,
        isInitializing,
        error,
        logoutIntentional,
        connect,
        disconnect,
        refreshAllConversations,
        refreshSingleConversation,
        reloadConversationsFromDB,
        subscribeToMessages,
        markConversationAsRead,
      }}
    >
      {children}
    </XmppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useXmpp() {
  const context = useContext(XmppContext)
  if (context === undefined) {
    throw new Error('useXmpp deve essere usato dentro XmppProvider')
  }
  return context
}
