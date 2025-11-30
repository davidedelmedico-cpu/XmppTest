import { createContext, useContext, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ReceivedMessage } from 'stanza/protocol'
import { handleIncomingMessageAndSync } from '../services/sync'
import { useConnection } from './ConnectionContext'
import { useConversations } from './ConversationsContext'

type MessageCallback = (message: ReceivedMessage) => void

interface MessagingContextType {
  subscribeToMessages: (callback: MessageCallback) => () => void
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined)

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { client, isConnected, jid } = useConnection()
  const { reloadFromDB } = useConversations()
  const messageCallbacks = useRef<Set<MessageCallback>>(new Set())

  // Gestione messaggi in arrivo
  useEffect(() => {
    if (!client || !isConnected || !jid) return

    const handleMessage = async (message: ReceivedMessage) => {
      if (!message.body) return

      try {
        // Sincronizza dal server
        await handleIncomingMessageAndSync(client, message, jid)

        // Aggiorna lista conversazioni
        await reloadFromDB()

        // Notifica subscribers
        messageCallbacks.current.forEach((callback) => {
          callback(message)
        })
      } catch (error) {
        console.error('Errore nella gestione messaggio:', error)
      }
    }

    client.on('message', handleMessage)

    return () => {
      client.off('message', handleMessage)
    }
  }, [client, isConnected, jid, reloadFromDB])

  const subscribeToMessages = useCallback((callback: MessageCallback) => {
    messageCallbacks.current.add(callback)
    
    // Ritorna funzione per unsubscribe
    return () => {
      messageCallbacks.current.delete(callback)
    }
  }, [])

  return (
    <MessagingContext.Provider
      value={{
        subscribeToMessages,
      }}
    >
      {children}
    </MessagingContext.Provider>
  )
}

export function useMessaging() {
  const context = useContext(MessagingContext)
  if (context === undefined) {
    throw new Error('useMessaging deve essere usato dentro MessagingProvider')
  }
  return context
}
