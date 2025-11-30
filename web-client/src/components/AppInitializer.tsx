import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConnection } from '../contexts/ConnectionContext'

/**
 * Componente che gestisce l'inizializzazione automatica dell'app
 * - Carica credenziali salvate
 * - Tenta auto-login se presenti
 * - Mostra LoginPopup se necessario
 */
export function AppInitializer({ children }: { children: React.ReactNode }) {
  const { loadSavedCredentials } = useAuth()
  const { connect } = useConnection()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const initialize = async () => {
      // Carica credenziali salvate
      const saved = loadSavedCredentials()
      
      if (saved) {
        // Tenta auto-login
        try {
          await connect(saved.jid, saved.password)
        } catch (err) {
          console.error('Auto-login fallito:', err)
        }
      }
    }

    initialize()
  }, [loadSavedCredentials, connect])

  return <>{children}</>
}

interface AppInitializerWithCallbackProps {
  children: (props: { isInitializing: boolean; isConnected: boolean; isConnecting: boolean }) => React.ReactNode
}

export function AppInitializerWithCallback({ children }: AppInitializerWithCallbackProps) {
  const { loadSavedCredentials } = useAuth()
  const { connect, isConnected, isConnecting } = useConnection()
  const [isInitializing, setIsInitializing] = useState(true)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const initialize = async () => {
      setIsInitializing(true)

      const saved = loadSavedCredentials()
      
      if (saved) {
        try {
          await connect(saved.jid, saved.password)
        } catch (err) {
          console.error('Auto-login fallito:', err)
        }
      }

      setIsInitializing(false)
    }

    initialize()
  }, [loadSavedCredentials, connect])

  return <>{children({ isInitializing, isConnected, isConnecting })}</>
}
