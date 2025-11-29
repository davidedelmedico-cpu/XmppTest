import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { login, type XmppResult } from '../services/xmpp'
import {
  loadConversations,
  loadMoreConversations,
  enrichWithRoster,
  updateConversationOnNewMessage,
} from '../services/conversations'
import { getConversations, getMetadata, type Conversation } from '../services/conversations-db'

interface XmppContextType {
  client: Agent | null
  isConnected: boolean
  jid: string | null
  conversations: Conversation[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  connect: (jid: string, password: string) => Promise<void>
  disconnect: () => void
  refreshConversations: () => Promise<void>
  loadMore: () => Promise<void>
}

const XmppContext = createContext<XmppContextType | undefined>(undefined)

export function XmppProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Agent | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [jid, setJid] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRSMToken, setLastRSMToken] = useState<string | undefined>()

  // Carica conversazioni dal database locale all'avvio
  useEffect(() => {
    const loadCachedConversations = async () => {
      try {
        const cached = await getConversations()
        setConversations(cached)
      } catch (err) {
        console.error('Errore nel caricamento cache:', err)
      }
    }
    loadCachedConversations()
  }, [])

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

      setClient(result.client)
      setIsConnected(true)
      setJid(result.jid || jid)

      // Carica conversazioni dal server
      const loaded = await loadConversations(result.client, {
        limit: 20, // Prime 20 conversazioni
      })

      // Arricchisci con dati roster
      const enriched = await enrichWithRoster(result.client, loaded.conversations)
      setConversations(enriched)

      // Imposta token per paginazione
      if (loaded.nextToken) {
        setLastRSMToken(loaded.nextToken)
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore di connessione'
      setError(errorMessage)
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
    setHasMore(true)
    setLastRSMToken(undefined)
  }

  const refreshConversations = async () => {
    if (!client || !isConnected) {
      return
    }

    setIsLoading(true)
    try {
      // Ricarica conversazioni dal server (query completa)
      const loaded = await loadConversations(client, {
        limit: conversations.length || 20, // Mantieni stesso numero o default
      })

      // Arricchisci con dati roster
      const enriched = await enrichWithRoster(client, loaded.conversations)
      
      setConversations(enriched)
    } catch (err) {
      console.error('Errore nel refresh conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel refresh')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = async () => {
    if (!client || !isConnected || isLoadingMore || !hasMore) {
      return
    }

    // Se non c'è token, prova a caricare dal database
    let tokenToUse = lastRSMToken
    if (!tokenToUse) {
      const metadata = await getMetadata()
      if (!metadata?.lastRSMToken) {
        setHasMore(false)
        return
      }
      tokenToUse = metadata.lastRSMToken
      setLastRSMToken(tokenToUse)
    }

    setIsLoadingMore(true)
    try {
      if (!tokenToUse) {
        setHasMore(false)
        setIsLoadingMore(false)
        return
      }
      const result = await loadMoreConversations(client, tokenToUse, 20)

      // Arricchisci con dati roster
      const enriched = await enrichWithRoster(client, result.conversations)

      // Merge intelligente: aggiorna conversazioni esistenti o aggiungi nuove
      const conversationMap = new Map(conversations.map((c) => [c.jid, c]))
      
      for (const newConv of enriched) {
        const existing = conversationMap.get(newConv.jid)
        if (!existing) {
          // Nuova conversazione
          conversationMap.set(newConv.jid, newConv)
        } else {
          // Conversazione esistente: aggiorna solo se nuovo messaggio è più recente
          const newTimestamp = newConv.lastMessage.timestamp.getTime()
          const oldTimestamp = existing.lastMessage.timestamp.getTime()
          
          if (newTimestamp > oldTimestamp) {
            // Aggiorna mantenendo unreadCount esistente
            conversationMap.set(newConv.jid, {
              ...newConv,
              unreadCount: existing.unreadCount,
            })
          }
        }
      }
      
      // Converti in array e riordina
      const combined = Array.from(conversationMap.values()).sort(
        (a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
      )
      
      setConversations(combined)
      setHasMore(result.hasMore)
      setLastRSMToken(result.nextToken)
    } catch (err) {
      console.error('Errore nel caricamento altre conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento')
      setHasMore(false) // Stop trying if error
    } finally {
      setIsLoadingMore(false)
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
        isLoadingMore,
        hasMore,
        error,
        connect,
        disconnect,
        refreshConversations,
        loadMore,
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
