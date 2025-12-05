/**
 * Componente per gestire le impostazioni Push Notifications (XEP-0357)
 */

import { useState, useEffect } from 'react'
import { useXmpp } from '../contexts/XmppContext'
import './PushNotificationsSettings.css'

export function PushNotificationsSettings() {
  const {
    pushSupported,
    pushEnabled,
    pushPermission,
    isConnected,
    enablePush,
    disablePush,
    requestPushPermission,
  } = useXmpp()

  const [pushJid, setPushJid] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [node, setNode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    // Carica configurazione salvata se disponibile
    const savedConfig = localStorage.getItem('push_config')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        setPushJid(config.pushJid || '')
        setPublicKey(config.publicKey || '')
        setNode(config.node || '')
      } catch (error) {
        console.error('Errore nel caricamento configurazione push:', error)
      }
    }
  }, [])

  const handleEnable = async () => {
    if (!pushJid || !publicKey) {
      setMessage({ type: 'error', text: 'Inserisci JID push e chiave pubblica VAPID' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      // Richiedi permesso se necessario
      if (pushPermission !== 'granted') {
        const permission = await requestPushPermission()
        if (permission !== 'granted') {
          setMessage({
            type: 'error',
            text: 'Permesso notifiche negato. Abilita le notifiche nelle impostazioni del browser.',
          })
          setIsLoading(false)
          return
        }
      }

      // Abilita push notifications
      const success = await enablePush(pushJid, publicKey, node || undefined)

      if (success) {
        setMessage({ type: 'success', text: 'Push Notifications abilitate con successo!' })
      } else {
        setMessage({
          type: 'error',
          text: 'Errore nell\'abilitazione push notifications. Verifica che il server supporti XEP-0357.',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore sconosciuto',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const success = await disablePush()

      if (success) {
        setMessage({ type: 'success', text: 'Push Notifications disabilitate con successo!' })
        // Reset form
        setPushJid('')
        setPublicKey('')
        setNode('')
      } else {
        setMessage({ type: 'error', text: 'Errore nella disabilitazione push notifications' })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore sconosciuto',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!pushSupported) {
    return (
      <div className="push-notifications-container">
        <div className="push-notifications-not-supported">
          <p>Le Push Notifications non sono supportate dal tuo browser.</p>
          <p className="push-notifications-hint">
            Assicurati di usare un browser moderno che supporta Web Push API (Chrome, Firefox, Edge, Safari 16+).
          </p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="push-notifications-container">
        <div className="push-notifications-not-connected">
          <p>Connettiti al server XMPP per abilitare le Push Notifications.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="push-notifications-container">
      <h2 className="push-notifications-title">Push Notifications (XEP-0357)</h2>

      <div className="push-notifications-status">
        <div className="push-notifications-status-item">
          <span className="push-notifications-status-label">Stato:</span>
          <span className={pushEnabled ? 'push-notifications-status-enabled' : 'push-notifications-status-disabled'}>
            {pushEnabled ? 'Abilitate' : 'Disabilitate'}
          </span>
        </div>
        <div className="push-notifications-status-item">
          <span className="push-notifications-status-label">Permesso browser:</span>
          <span
            className={
              pushPermission === 'granted'
                ? 'push-notifications-status-granted'
                : pushPermission === 'denied'
                  ? 'push-notifications-status-denied'
                  : 'push-notifications-status-default'
            }
          >
            {pushPermission === 'granted'
              ? 'Concesso'
              : pushPermission === 'denied'
                ? 'Negato'
                : 'Non richiesto'}
          </span>
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'push-notifications-message-success' : 'push-notifications-message-error'}>
          {message.text}
        </div>
      )}

      <div className="push-notifications-form">
        <div className="push-notifications-form-group">
          <label htmlFor="pushJid" className="push-notifications-label">
            Push Service JID *
          </label>
          <input
            id="pushJid"
            type="text"
            value={pushJid}
            onChange={(e) => setPushJid(e.target.value)}
            placeholder="push.example.com"
            className="push-notifications-input"
            disabled={isLoading || pushEnabled}
          />
          <p className="push-notifications-hint">
            JID del servizio push notifications fornito dal server XMPP
          </p>
        </div>

        <div className="push-notifications-form-group">
          <label htmlFor="publicKey" className="push-notifications-label">
            Chiave Pubblica VAPID *
          </label>
          <textarea
            id="publicKey"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="Chiave pubblica VAPID (base64url)"
            className="push-notifications-textarea"
            rows={3}
            disabled={isLoading || pushEnabled}
          />
          <p className="push-notifications-hint">
            Chiave pubblica VAPID per autenticare le richieste push. Deve essere generata lato server.
          </p>
        </div>

        <div className="push-notifications-form-group">
          <label htmlFor="node" className="push-notifications-label">
            Node (opzionale)
          </label>
          <input
            id="node"
            type="text"
            value={node}
            onChange={(e) => setNode(e.target.value)}
            placeholder="node-id"
            className="push-notifications-input"
            disabled={isLoading || pushEnabled}
          />
          <p className="push-notifications-hint">
            Node ID per PubSub (XEP-0060), se richiesto dal server
          </p>
        </div>

        <div className="push-notifications-actions">
          {!pushEnabled ? (
            <button
              onClick={handleEnable}
              disabled={isLoading || !pushJid || !publicKey}
              className="push-notifications-button-primary"
            >
              {isLoading ? 'Abilitazione...' : 'Abilita Push Notifications'}
            </button>
          ) : (
            <button
              onClick={handleDisable}
              disabled={isLoading}
              className="push-notifications-button-danger"
            >
              {isLoading ? 'Disabilitazione...' : 'Disabilita Push Notifications'}
            </button>
          )}
        </div>
      </div>

      <div className="push-notifications-info">
        <h3 className="push-notifications-info-title">Informazioni</h3>
        <ul className="push-notifications-info-list">
          <li>
            Le Push Notifications permettono di ricevere notifiche anche quando l'app non è aperta
          </li>
          <li>
            Il server XMPP deve supportare XEP-0357 (Push Notifications)
          </li>
          <li>
            È necessario un servizio push compatibile con Web Push Protocol
          </li>
          <li>
            Le chiavi VAPID devono essere generate e configurate lato server
          </li>
        </ul>
      </div>
    </div>
  )
}
