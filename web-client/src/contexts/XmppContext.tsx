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
  const hasAttemptedReconnect = useRef(false)

  // Carica conversazioni dal database locale all'avvio (solo se non connesso)
  useEffect(() => {
    if (!isConnected) {
      const loadCachedConversations = async () => {
        try {
          const cached = await getConversations()
          setConversations(cached)
        } catch (err) {
          console.error('Errore nel caricamento cache:', err)
        }
      }
      loadCachedConversations()
    }
  }, [isConnected])

  // Tentativo di riconnessione automatica all'avvio se ci sono credenziali salvate
  // Questo viene eseguito PRIMA di mostrare qualsiasi cosa all'utente
  useEffect(() => {
    if (!hasAttemptedReconnect.current) {
      hasAttemptedReconnect.current = true
      
      const attemptAutoReconnect = async () => {
        console.log('[INIT] Inizio inizializzazione, isInitializing:', isInitializing)
        // isInitializing parte già da true, non serve impostarlo di nuovo
        try {
          const saved = loadCredentials()
          console.log('[INIT] Credenziali caricate:', saved ? 'trovate' : 'non trovate')
          if (saved) {
            console.log('[INIT] Tentativo di riconnessione automatica...')
            try {
              await connect(saved.jid, saved.password)
              console.log('[INIT] Riconnessione automatica completata con successo')
              // Aspetta un attimo per assicurarsi che tutto sia pronto
              await new Promise(resolve => setTimeout(resolve, 200))
            } catch (error) {
              console.error('[INIT] Riconnessione automatica fallita:', error)
              // Se la riconnessione fallisce, cancella le credenziali salvate
              clearCredentials()
              setError(error instanceof Error ? error.message : 'Riconnessione automatica fallita')
            }
          } else {
            // Nessuna credenziale salvata, aspetta un attimo per mostrare lo spinner
            console.log('[INIT] Nessuna credenziale, aspetto 500ms...')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } finally {
          // Finito il tentativo di riconnessione, mostra l'interfaccia
          console.log('[INIT] Fine inizializzazione, imposto isInitializing a false')
          setIsInitializing(false)
        }
      }
      
      attemptAutoReconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Esegui solo all'avvio

  // Gestione eventi real-time quando client è connesso
  useEffect(() => {
    if (!client || !isConnected) {
      return
    }

    const handleMessage = async (message: ReceivedMessage) => {
      if (!jid) return

      // Aggiorna conversazione nel database
      if (jid) {
        await updateConversationOnNewMessage(message, jid)
      }

      // Ricarica conversazioni dal database
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

      // Salva le credenziali per la riconnessione automatica dopo refresh
      saveCredentials(jid, password)

      // Mostra SUBITO le conversazioni dalla cache locale
      const cachedConversations = await getConversations()
      if (cachedConversations.length > 0) {
        // Arricchisci con dati roster dalla cache
        const enrichedCached = await enrichWithRoster(xmppClient, cachedConversations)
        setConversations(enrichedCached)
      }

      // Poi in background carica e aggiorna dal server (asincrono)
      void (async () => {
        try {
          setIsLoading(true)
          // Carica TUTTE le conversazioni dal server (storico completo)
          const loaded = await loadAllConversations(xmppClient)

          // Arricchisci con dati roster
          const enriched = await enrichWithRoster(xmppClient, loaded)
          setConversations(enriched)
        } catch (err) {
          console.error('Errore nel caricamento conversazioni dal server:', err)
          setError(err instanceof Error ? err.message : 'Errore nel caricamento')
        } finally {
          setIsLoading(false)
        }
      })()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore di connessione'
      setError(errorMessage)
      // Se il login fallisce, cancella le credenziali salvate
      clearCredentials()
      throw err
    } finally {
      setIsLoading(false)
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
    // Cancella le credenziali salvate quando si fa logout
    clearCredentials()
  }

  const refreshConversations = async () => {
    if (!client || !isConnected) {
      return
    }

    setIsLoading(true)
    try {
      // Ricarica TUTTE le conversazioni dal server (storico completo)
      const loaded = await loadAllConversations(client)

      // Arricchisci con dati roster
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
