/**
 * Mediator Pattern per coordinare Auth → Connection → Conversations → Messaging
 * Elimina dipendenze circolari tra context e centralizza orchestrazione
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import type { Conversation } from '../services/conversations-db'
import { XmppStateMachine, type XmppState } from './XmppStateMachine'
import { SyncContext } from '../services/sync/SyncStrategy'
import { ConversationRepository } from '../services/repositories'
import { login as xmppLogin } from '../services/xmpp'
import { saveCredentials, loadCredentials, clearCredentials } from '../services/auth-storage'

type MessageCallback = (message: ReceivedMessage) => void

interface XmppMediatorContextType {
  // Stato
  state: XmppState
  client: Agent | null
  jid: string | null
  conversations: Conversation[]
  isLoading: boolean
  error: string | null

  // Auth
  login: (jid: string, password: string) => Promise<boolean>
  logout: () => void
  hasCredentials: () => boolean

  // Connection
  isConnected: boolean
  isConnecting: boolean

  // Conversations
  refreshAllConversations: () => Promise<void>
  refreshSingleConversation: (jid: string) => Promise<void>
  markAsRead: (jid: string) => Promise<void>

  // Messaging
  subscribeToMessages: (callback: MessageCallback) => () => void

  // Utility
  clearError: () => void
}

const XmppMediatorContext = createContext<XmppMediatorContextType | undefined>(undefined)

export function XmppMediatorProvider({ children }: { children: ReactNode }) {
  // State Machine
  const stateMachine = useRef(new XmppStateMachine('disconnected'))
  const [state, setState] = useState<XmppState>('disconnected')

  // XMPP State
  const [client, setClient] = useState<Agent | null>(null)
  const [jid, setJid] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync Context
  const syncContext = useRef(new SyncContext())
  const conversationRepo = useRef(new ConversationRepository())

  // Message callbacks
  const messageCallbacks = useRef<Set<MessageCallback>>(new Set())
  
  // Flag per auto-login (esegue solo una volta)
  const autoLoginExecuted = useRef(false)

  // Inizializzazione State Machine listener
  useEffect(() => {
    const unsubscribe = stateMachine.current.onStateChange((newState) => {
      console.log('[XmppMediator] State changed to:', newState)
      setState(newState)
    })

    return unsubscribe
  }, [])

  // Auto-login rimosso da qui - viene fatto dopo la definizione di login

  // Gestione eventi XMPP
  useEffect(() => {
    if (!client || !stateMachine.current.isConnected()) return

    const handleMessage = async (message: ReceivedMessage) => {
      if (!message.body || !jid) return

      try {
        // Usa strategy per messaggio in arrivo
        const strategy = syncContext.current.createIncomingMessageSync()
        await syncContext.current.executeStrategy(strategy, client, message, jid)

        // Ricarica conversazioni
        const updated = await conversationRepo.current.getAll()
        setConversations(updated)

        // Notifica subscribers
        messageCallbacks.current.forEach((callback) => {
          callback(message)
        })
      } catch (error) {
        console.error('[XmppMediator] Errore gestione messaggio:', error)
      }
    }

    const handleDisconnected = () => {
      stateMachine.current.transition('DISCONNECT')
      setClient(null)
      setJid(null)
    }

    client.on('message', handleMessage)
    client.on('disconnected', handleDisconnected)

    return () => {
      client.off('message', handleMessage)
      client.off('disconnected', handleDisconnected)
    }
  }, [client, jid])

  // === AUTH ===

  const login = useCallback(async (userJid: string, password: string): Promise<boolean> => {
    if (!stateMachine.current.transition('CONNECT')) {
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await xmppLogin({ jid: userJid, password })

      if (!result.success || !result.client) {
        stateMachine.current.transition('ERROR')
        throw new Error(result.message || 'Login fallito')
      }

      // Transizione: connecting → authenticating → connected
      stateMachine.current.transition('AUTH_SUCCESS')
      stateMachine.current.transition('AUTH_SUCCESS')

      const xmppClient = result.client
      setClient(xmppClient)
      setJid(result.jid || userJid)

      // Salva credenziali
      saveCredentials(userJid, password)

      // Carica conversazioni dalla cache
      const cached = await conversationRepo.current.getAll()
      if (cached.length > 0) {
        setConversations(cached)
      }

      // Carica dal server in background
      setIsLoading(false)
      void (async () => {
        try {
          setIsLoading(true)
          const strategy = syncContext.current.createAllConversationsSync()
          await syncContext.current.executeStrategy(strategy, xmppClient)

          const updated = await conversationRepo.current.getAll()
          setConversations(updated)
        } catch (err) {
          console.error('[XmppMediator] Errore caricamento conversazioni:', err)
          setError(err instanceof Error ? err.message : 'Errore caricamento')
        } finally {
          setIsLoading(false)
        }
      })()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore di connessione'
      setError(errorMessage)
      clearCredentials()
      setIsLoading(false)
      stateMachine.current.transition('ERROR')
      return false
    }
  }, [])

  // Auto-login con credenziali salvate (esegue solo una volta)
  useEffect(() => {
    if (autoLoginExecuted.current) return
    autoLoginExecuted.current = true
    
    const saved = loadCredentials()
    console.log('[XmppMediator] Auto-login check:', { hasSaved: !!saved })
    if (saved) {
      console.log('[XmppMediator] Starting auto-login for:', saved.jid)
      void login(saved.jid, saved.password)
    }
  }, [login])

  const logout = useCallback(() => {
    if (client) {
      client.disconnect()
    }
    setClient(null)
    setJid(null)
    setConversations([])
    clearCredentials()
    stateMachine.current.reset()
  }, [client])

  const hasCredentials = useCallback(() => {
    return loadCredentials() !== null
  }, [])

  // === CONVERSATIONS ===

  const refreshAllConversations = useCallback(async () => {
    if (!client || !stateMachine.current.isConnected()) return

    setIsLoading(true)
    setError(null)

    try {
      const strategy = syncContext.current.createAllConversationsSync()
      const result = await syncContext.current.executeStrategy(strategy, client)

      if (!result.success) {
        throw new Error(result.error || 'Errore sincronizzazione')
      }

      const updated = await conversationRepo.current.getAll()
      setConversations(updated)
    } catch (err) {
      console.error('[XmppMediator] Errore refresh conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore refresh')
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const refreshSingleConversation = useCallback(
    async (contactJid: string) => {
      if (!client || !stateMachine.current.isConnected()) return

      try {
        const strategy = syncContext.current.createCompleteConversationSync()
        const result = await syncContext.current.executeStrategy(strategy, client, contactJid)

        if (!result.success) {
          throw new Error(result.error || 'Errore sincronizzazione')
        }

        const updated = await conversationRepo.current.getAll()
        setConversations(updated)
      } catch (err) {
        console.error('[XmppMediator] Errore refresh conversazione:', err)
        setError(err instanceof Error ? err.message : 'Errore refresh')
      }
    },
    [client]
  )

  const markAsRead = useCallback(async (conversationJid: string) => {
    try {
      await conversationRepo.current.update(conversationJid, { unreadCount: 0 })
      const updated = await conversationRepo.current.getAll()
      setConversations(updated)
    } catch (error) {
      console.error('[XmppMediator] Errore marcatura lettura:', error)
    }
  }, [])

  // === MESSAGING ===

  const subscribeToMessages = useCallback((callback: MessageCallback) => {
    messageCallbacks.current.add(callback)

    return () => {
      messageCallbacks.current.delete(callback)
    }
  }, [])

  // === UTILITY ===

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Deriva isConnected e isConnecting dallo stato (reattivo)
  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting' || state === 'authenticating'
  
  console.log('[XmppMediator] Render:', { state, isConnected, isConnecting })

  const contextValue: XmppMediatorContextType = useMemo(() => ({
    // Stato
    state,
    client,
    jid,
    conversations,
    isLoading,
    error,

    // Auth
    login,
    logout,
    hasCredentials,

    // Connection
    isConnected,
    isConnecting,

    // Conversations
    refreshAllConversations,
    refreshSingleConversation,
    markAsRead,

    // Messaging
    subscribeToMessages,

    // Utility
    clearError,
  }), [
    state,
    client,
    jid,
    conversations,
    isLoading,
    error,
    login,
    logout,
    hasCredentials,
    isConnected,
    isConnecting,
    refreshAllConversations,
    refreshSingleConversation,
    markAsRead,
    subscribeToMessages,
    clearError,
  ])

  return (
    <XmppMediatorContext.Provider value={contextValue}>
      {children}
    </XmppMediatorContext.Provider>
  )
}

/**
 * Hook per accedere al Mediator
 * Questo è il punto di accesso unificato per tutti i componenti
 */
export function useXmppMediator() {
  const context = useContext(XmppMediatorContext)
  if (context === undefined) {
    throw new Error('useXmppMediator deve essere usato dentro XmppMediatorProvider')
  }
  return context
}

/**
 * Facade Hook - API semplificata per i componenti
 * Espone solo le funzioni più comuni con nomi intuitivi
 */
export function useXmpp() {
  const mediator = useXmppMediator()

  return {
    // Stato semplificato
    isConnected: mediator.isConnected,
    isConnecting: mediator.isConnecting,
    isLoading: mediator.isLoading,
    error: mediator.error,

    // Dati
    jid: mediator.jid,
    client: mediator.client,
    conversations: mediator.conversations,

    // Azioni principali
    login: mediator.login,
    logout: mediator.logout,
    refresh: mediator.refreshAllConversations,
    markAsRead: mediator.markAsRead,

    // Messaging
    subscribeToMessages: mediator.subscribeToMessages,

    // Utility
    clearError: mediator.clearError,
  }
}
