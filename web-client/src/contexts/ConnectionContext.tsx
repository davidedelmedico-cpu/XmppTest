import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Agent } from 'stanza'
import { login as xmppLogin } from '../services/xmpp'
import { useAuth } from './AuthContext'

interface ConnectionContextType {
  client: Agent | null
  isConnected: boolean
  isConnecting: boolean
  jid: string | null
  error: string | null
  connect: (jid: string, password: string) => Promise<boolean>
  disconnect: () => void
  clearError: () => void
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { login: saveAuth, logout: clearAuth } = useAuth()
  const [client, setClient] = useState<Agent | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [jid, setJid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Handler per disconnessione
  useEffect(() => {
    if (!client || !isConnected) return

    const handleDisconnected = () => {
      setIsConnected(false)
      setClient(null)
      setJid(null)
    }

    client.on('disconnected', handleDisconnected)

    return () => {
      client.off('disconnected', handleDisconnected)
    }
  }, [client, isConnected])

  const connect = useCallback(async (userJid: string, password: string): Promise<boolean> => {
    setIsConnecting(true)
    setError(null)

    try {
      const result = await xmppLogin({ jid: userJid, password })

      if (!result.success || !result.client) {
        throw new Error(result.message || 'Login fallito')
      }

      const xmppClient = result.client
      setClient(xmppClient)
      setIsConnected(true)
      setJid(result.jid || userJid)
      
      // Salva credenziali
      saveAuth(userJid, password)
      
      setIsConnecting(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore di connessione'
      setError(errorMessage)
      clearAuth()
      setIsConnecting(false)
      return false
    }
  }, [saveAuth, clearAuth])

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect()
    }
    setClient(null)
    setIsConnected(false)
    setJid(null)
    clearAuth()
  }, [client, clearAuth])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <ConnectionContext.Provider
      value={{
        client,
        isConnected,
        isConnecting,
        jid,
        error,
        connect,
        disconnect,
        clearError,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  const context = useContext(ConnectionContext)
  if (context === undefined) {
    throw new Error('useConnection deve essere usato dentro ConnectionProvider')
  }
  return context
}
