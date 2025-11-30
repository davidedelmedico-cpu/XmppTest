import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Conversation } from '../services/conversations-db'
import { ConversationRepository } from '../services/repositories'
import { loadAllConversations, enrichWithRoster } from '../services/conversations'
import { useConnection } from './ConnectionContext'

interface ConversationsContextType {
  conversations: Conversation[]
  isLoading: boolean
  error: string | null
  refreshAll: () => Promise<void>
  reloadFromDB: () => Promise<void>
  markAsRead: (jid: string) => Promise<void>
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined)

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { client, isConnected } = useConnection()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conversationRepo = new ConversationRepository()

  // Carica conversazioni dalla cache al mount
  useEffect(() => {
    const loadFromCache = async () => {
      try {
        const cached = await conversationRepo.getAll()
        setConversations(cached)
      } catch (err) {
        console.error('Errore caricamento cache conversazioni:', err)
      }
    }

    loadFromCache()
  }, [])

  // Carica conversazioni dal server quando connesso
  useEffect(() => {
    if (!client || !isConnected) return

    const loadFromServer = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Carica conversazioni dalla cache prima (fast)
        const cached = await conversationRepo.getAll()
        if (cached.length > 0) {
          const enrichedCached = await enrichWithRoster(client, cached)
          setConversations(enrichedCached)
        }

        // Poi carica dal server (aggiornato)
        const loaded = await loadAllConversations(client)
        const enriched = await enrichWithRoster(client, loaded)
        setConversations(enriched)
      } catch (err) {
        console.error('Errore caricamento conversazioni:', err)
        setError(err instanceof Error ? err.message : 'Errore nel caricamento')
      } finally {
        setIsLoading(false)
      }
    }

    loadFromServer()
  }, [client, isConnected])

  const refreshAll = useCallback(async () => {
    if (!client || !isConnected) return

    setIsLoading(true)
    setError(null)

    try {
      // Usa la sincronizzazione completa
      const { syncAllConversationsComplete } = await import('../services/sync')
      const result = await syncAllConversationsComplete(client)
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nella sincronizzazione')
      }
      
      // Ricarica dal database
      const updated = await conversationRepo.getAll()
      setConversations(updated)
    } catch (err) {
      console.error('Errore refresh conversazioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel refresh')
    } finally {
      setIsLoading(false)
    }
  }, [client, isConnected])

  const reloadFromDB = useCallback(async () => {
    try {
      const updated = await conversationRepo.getAll()
      setConversations(updated)
    } catch (error) {
      console.error('Errore ricaricamento conversazioni:', error)
    }
  }, [])

  const markAsRead = useCallback(async (conversationJid: string) => {
    try {
      await conversationRepo.update(conversationJid, { unreadCount: 0 })
      const updated = await conversationRepo.getAll()
      setConversations(updated)
    } catch (error) {
      console.error('Errore marcatura conversazione:', error)
    }
  }, [])

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        isLoading,
        error,
        refreshAll,
        reloadFromDB,
        markAsRead,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  )
}

export function useConversations() {
  const context = useContext(ConversationsContext)
  if (context === undefined) {
    throw new Error('useConversations deve essere usato dentro ConversationsProvider')
  }
  return context
}
