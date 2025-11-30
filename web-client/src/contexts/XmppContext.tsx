import { createContext, useContext, useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { login, type XmppResult } from '../services/xmpp'
import {
  loadAllConversations,
  enrichWithRoster,
  updateConversationOnNewMessage,
} from '../services/conversations'
import { getConversations, type Conversation } from '../services/conversations-db'
import { saveCredentials, loadCredentials, clearCredentials } from '../services/auth-storage'

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
  refreshConversations: () => Promise<void>
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
      if (!jid) return

      await updateConversationOnNewMessage(message, jid)
      const updated = await getConversations()
      setConversations(updated)
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      setClient(null)
      setJid(null)
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
    // Setta flag per indicare che è un logout volontario
    setLogoutIntentional(true)
    
    if (client) {
      client.disconnect()
    }
    setClient(null)
    setIsConnected(false)
    setJid(null)
    setConversations([])
    clearCredentials()
  }

  const refreshConversations = async () => {
    if (!client || !isConnected) {
      return
    }

    setIsLoading(true)
    try {
      const loaded = await loadAllConversations(client)
      const enriched = await enrichWithRoster(client, loaded)
      setConversations(enriched)
    } catch (err) {
      console.error('Errore nel refresh conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel refresh')
    } finally {
      setIsLoading(false)
    }
  }

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
        refreshConversations,
      }}
    >
      {children}
    </XmppContext.Provider>
  )
}

export function useXmpp() {
  const context = useContext(XmppContext)
  if (context === undefined) {
    throw new Error('useXmpp deve essere usato dentro XmppProvider')
  }
  return context
}
