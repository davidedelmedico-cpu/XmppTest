import { useState, useEffect, useRef } from 'react'
import { useXmpp } from '../contexts/XmppContext'
import './PushNotificationStatus.css'

export function PushNotificationStatus() {
  const { pushSupported, pushEnabled, pushPermission, enablePushAuto } = useXmpp()
  const [showStatus, setShowStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info' | 'warning'
    title: string
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const previousPushEnabled = useRef<boolean>(false)
  const previousPushPermission = useRef<NotificationPermission>('default')

  // Mostra status automaticamente quando cambia lo stato delle push (solo una volta)
  const [hasShownInitialStatus, setHasShownInitialStatus] = useState(false)
  
  useEffect(() => {
    // Mostra lo status iniziale solo dopo il login e una volta sola
    if (hasShownInitialStatus) return
    
    // Aspetta che la connessione sia stabilita
    const timer = setTimeout(() => {
      if (!pushSupported) {
        setStatusMessage({
          type: 'warning',
          title: 'Push Not Supportate',
          message: 'Il tuo browser non supporta le notifiche push. Usa un browser moderno come Chrome o Firefox.'
        })
        setShowStatus(true)
        setHasShownInitialStatus(true)
        return
      }

      if (pushPermission === 'denied') {
        setStatusMessage({
          type: 'error',
          title: 'Permesso Negato',
          message: 'Le notifiche push sono state negate. Vai nelle impostazioni del browser per abilitarle.'
        })
        setShowStatus(true)
        setHasShownInitialStatus(true)
        return
      }

      if (pushPermission === 'default') {
        setStatusMessage({
          type: 'info',
          title: 'Permesso Richiesto',
          message: 'Per ricevere notifiche push, devi concedere il permesso quando richiesto.'
        })
        setShowStatus(true)
        setHasShownInitialStatus(true)
        return
      }

      if (pushEnabled) {
        setStatusMessage({
          type: 'success',
          title: 'Push Abilitate',
          message: 'Le notifiche push sono attive. Riceverai notifiche quando arriveranno nuovi messaggi.'
        })
        setShowStatus(true)
        setHasShownInitialStatus(true)
        return
      }
    }, 3000) // Aspetta 3 secondi dopo il login
    
    return () => clearTimeout(timer)
  }, [pushSupported, pushEnabled, pushPermission, hasShownInitialStatus])

  // Mostra notifica quando le push vengono abilitate automaticamente
  useEffect(() => {
    // Se le push sono state appena abilitate (da false a true)
    if (pushEnabled && !previousPushEnabled.current && pushPermission === 'granted') {
      const timer = setTimeout(() => {
        setStatusMessage({
          type: 'success',
          title: 'Push Abilitate',
          message: 'Le notifiche push sono state abilitate automaticamente! Riceverai notifiche quando arriveranno nuovi messaggi.'
        })
        setShowStatus(true)
        // Auto-chiudi dopo 5 secondi
        setTimeout(() => setShowStatus(false), 5000)
      }, 2000)
      
      previousPushEnabled.current = true
      return () => clearTimeout(timer)
    }
    
    // Se il permesso cambia
    if (pushPermission !== previousPushPermission.current) {
      if (pushPermission === 'granted' && !pushEnabled) {
        // Permesso concesso ma push non ancora abilitate
        const timer = setTimeout(() => {
          setStatusMessage({
            type: 'info',
            title: 'Permesso Concesso',
            message: 'Permesso notifiche concesso. Le push notifications verranno abilitate automaticamente...'
          })
          setShowStatus(true)
          setTimeout(() => setShowStatus(false), 4000)
        }, 1000)
        
        previousPushPermission.current = pushPermission
        return () => clearTimeout(timer)
      } else if (pushPermission === 'denied') {
        setStatusMessage({
          type: 'error',
          title: 'Permesso Negato',
          message: 'Le notifiche push sono state negate. Vai nelle impostazioni del browser per abilitarle.'
        })
        setShowStatus(true)
        previousPushPermission.current = pushPermission
      }
    }
  }, [pushEnabled, pushPermission])

  const testPushNotifications = async () => {
    setIsTesting(true)
    setStatusMessage({
      type: 'info',
      title: 'Test in Corso',
      message: 'Verifica dello stato delle push notifications...'
    })
    setShowStatus(true)

    try {
      // Verifica Service Worker
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        setStatusMessage({
          type: 'error',
          title: 'Test Fallito',
          message: 'Service Worker non registrato. Ricarica la pagina.'
        })
        setShowStatus(true)
        setIsTesting(false)
        return
      }

      // Verifica Push Subscription
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setStatusMessage({
          type: 'warning',
          title: 'Subscription Assente',
          message: 'Nessuna subscription push trovata. Provo ad abilitare automaticamente...'
        })
        setShowStatus(true)

        // Prova ad abilitare automaticamente
        const success = await enablePushAuto()
        if (success) {
          setStatusMessage({
            type: 'success',
            title: 'Push Abilitate',
            message: 'Le push notifications sono state abilitate con successo!'
          })
        } else {
          setStatusMessage({
            type: 'error',
            title: 'Abilitazione Fallita',
            message: 'Impossibile abilitare le push notifications. Il server potrebbe non supportarle.'
          })
        }
        setShowStatus(true)
        setIsTesting(false)
        return
      }

      // Verifica Configurazione
      const configStr = localStorage.getItem('push_config')
      const config = configStr ? JSON.parse(configStr) : null

      if (!config) {
        setStatusMessage({
          type: 'warning',
          title: 'Configurazione Assente',
          message: 'Subscription presente ma configurazione non salvata. Provo ad abilitare...'
        })
        setShowStatus(true)

        const success = await enablePushAuto()
        if (success) {
          setStatusMessage({
            type: 'success',
            title: 'Push Abilitate',
            message: 'Le push notifications sono state abilitate con successo!'
          })
        } else {
          setStatusMessage({
            type: 'error',
            title: 'Abilitazione Fallita',
            message: 'Impossibile abilitare le push notifications.'
          })
        }
        setShowStatus(true)
        setIsTesting(false)
        return
      }

      // Tutto OK
      setStatusMessage({
        type: 'success',
        title: 'Test Completato',
        message: `Push notifications configurate correttamente!\n\nEndpoint: ${subscription.endpoint.substring(0, 50)}...\nServer: ${config.pushJid || 'N/A'}`
      })
      setShowStatus(true)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        title: 'Errore nel Test',
        message: `Errore durante il test: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
      })
      setShowStatus(true)
    } finally {
      setIsTesting(false)
    }
  }

  if (!showStatus && !statusMessage) {
    return null
  }

  return (
    <>
      {/* Bottone per aprire il test */}
      <button
        className="push-status-button"
        onClick={testPushNotifications}
        disabled={isTesting}
        aria-label="Testa push notifications"
        title="Testa lo stato delle push notifications"
      >
        {isTesting ? '⏳' : '🔔'}
      </button>

      {/* Popup di status */}
      {showStatus && statusMessage && (
        <div className="push-status-overlay" onClick={() => setShowStatus(false)}>
          <div className="push-status-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`push-status-icon push-status-icon-${statusMessage.type}`}>
              {statusMessage.type === 'success' && '✓'}
              {statusMessage.type === 'error' && '✗'}
              {statusMessage.type === 'warning' && '⚠'}
              {statusMessage.type === 'info' && 'ℹ'}
            </div>
            <h3 className="push-status-title">{statusMessage.title}</h3>
            <p className="push-status-message">{statusMessage.message}</p>
            <div className="push-status-details">
              <div className="push-status-row">
                <span>Supporto Browser:</span>
                <span className={pushSupported ? 'push-status-ok' : 'push-status-fail'}>
                  {pushSupported ? '✓ Sì' : '✗ No'}
                </span>
              </div>
              <div className="push-status-row">
                <span>Permesso:</span>
                <span className={
                  pushPermission === 'granted' ? 'push-status-ok' :
                  pushPermission === 'denied' ? 'push-status-fail' :
                  'push-status-warning'
                }>
                  {pushPermission === 'granted' ? '✓ Concesso' :
                   pushPermission === 'denied' ? '✗ Negato' :
                   '⚠ Non richiesto'}
                </span>
              </div>
              <div className="push-status-row">
                <span>Push Abilitate:</span>
                <span className={pushEnabled ? 'push-status-ok' : 'push-status-fail'}>
                  {pushEnabled ? '✓ Sì' : '✗ No'}
                </span>
              </div>
            </div>
            <button
              className="push-status-close"
              onClick={() => setShowStatus(false)}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </>
  )
}
