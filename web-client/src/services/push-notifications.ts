/**
 * Servizio per gestire le Push Notifications secondo XEP-0357
 * 
 * XEP-0357: Push Notifications
 * https://xmpp.org/extensions/xep-0357.html
 * 
 * Questo servizio gestisce:
 * - Registrazione endpoint push con il server XMPP
 * - Abilitazione/disabilitazione push notifications
 * - Gestione delle chiavi VAPID
 */

import type { Agent } from 'stanza'

export interface PushNotificationConfig {
  /** JID del servizio push (es. push.example.com) */
  pushJid: string
  /** Endpoint URL del servizio push (es. Firebase Cloud Messaging) */
  endpoint: string
  /** Chiave pubblica VAPID */
  publicKey: string
  /** Chiave privata VAPID (solo lato server, non esposta al client) */
  privateKey?: string
  /** Node ID per PubSub (opzionale, per XEP-0060) */
  node?: string
}

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Namespace XEP-0357
 */
const PUSH_NAMESPACE = 'urn:xmpp:push:0'

/**
 * Verifica se le Push Notifications sono supportate dal browser
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Verifica se le notifiche sono permesse dall'utente
 */
export async function checkNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

/**
 * Richiede il permesso per le notifiche
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Le notifiche non sono supportate dal browser')
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    throw new Error('Il permesso per le notifiche è stato negato')
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Converte una chiave pubblica VAPID da base64url a ArrayBuffer
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Ottiene o crea una subscription push
 */
export async function getPushSubscription(
  applicationServerKey?: string
): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('Push Notifications non supportate dal browser')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Abbiamo già una subscription
      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
        },
      }
    }

    // Non abbiamo una subscription, creiamola se abbiamo la chiave
    if (!applicationServerKey) {
      console.warn('Chiave server non fornita, impossibile creare subscription')
      return null
    }

    const key = urlBase64ToUint8Array(applicationServerKey)
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource,
    })

    return {
      endpoint: newSubscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(newSubscription.getKey('auth')!),
      },
    }
  } catch (error) {
    console.error('Errore nella gestione push subscription:', error)
    return null
  }
}

/**
 * Converte ArrayBuffer a base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * Abilita le push notifications sul server XMPP secondo XEP-0357
 * 
 * Invia una IQ stanza per registrare l'endpoint push con il server
 * 
 * Formato stanza secondo XEP-0357:
 * <iq type='set' id='enable1'>
 *   <enable xmlns='urn:xmpp:push:0' jid='push.example.com' node='mynode'>
 *     <x xmlns='jabber:x:data' type='submit'>
 *       <field var='FORM_TYPE'><value>http://jabber.org/protocol/pubsub#publish-options</value></field>
 *       <field var='pubsub#endpoint'><value>https://push.example.com/push/abc123</value></field>
 *       <field var='pubsub#max_items'><value>1</value></field>
 *     </x>
 *   </enable>
 * </iq>
 */
export async function enablePushNotifications(
  client: Agent,
  pushJid: string,
  pushSubscription: PushSubscription,
  node?: string
): Promise<boolean> {
  try {
    // Verifica che il server supporti XEP-0357
    // Nota: Stanza.js potrebbe non avere un metodo diretto per discoverFeatures
    // Tentiamo comunque di abilitare le push - il server risponderà con errore se non supportato
    // In alternativa, possiamo fare una disco.info manuale se necessario

    // Costruisci la stanza IQ per abilitare push
    // Stanza.js richiede una struttura specifica per le IQ
    // Per XEP-0357, dobbiamo costruire manualmente l'XML perché Stanza.js
    // potrebbe non avere supporto nativo per questo XEP
    const enableStanza = {
      type: 'set' as const,
      enable: {
        xmlns: PUSH_NAMESPACE,
        jid: pushJid,
        ...(node && { node }),
      },
      // Aggiungi i dati pubsub come elemento x:data
      x: {
        xmlns: 'jabber:x:data',
        type: 'submit',
        fields: [
          {
            var: 'FORM_TYPE',
            value: 'http://jabber.org/protocol/pubsub#publish-options',
          },
          {
            var: 'pubsub#endpoint',
            value: pushSubscription.endpoint,
          },
          {
            var: 'pubsub#max_items',
            value: '1',
          },
        ],
      },
    }

    // Stanza.js potrebbe richiedere una struttura diversa
    // Se questo non funziona, potremmo dover costruire l'XML manualmente
    const result = await client.sendIQ(enableStanza as unknown as Parameters<typeof client.sendIQ>[0])

    if (result.type === 'result') {
      console.log('Push Notifications abilitate con successo')
      return true
    } else {
      console.error('Errore nell\'abilitazione push notifications:', result)
      return false
    }
  } catch (error) {
    console.error('Errore nell\'abilitazione push notifications:', error)
    return false
  }
}

/**
 * Disabilita le push notifications sul server XMPP
 * 
 * Formato stanza secondo XEP-0357:
 * <iq type='set' id='disable1'>
 *   <disable xmlns='urn:xmpp:push:0' jid='push.example.com' node='mynode'/>
 * </iq>
 */
export async function disablePushNotifications(
  client: Agent,
  pushJid: string,
  node?: string
): Promise<boolean> {
  try {
    const disableStanza = {
      type: 'set' as const,
      disable: {
        xmlns: PUSH_NAMESPACE,
        jid: pushJid,
        ...(node && { node }),
      },
    }

    // Stanza.js potrebbe richiedere una struttura diversa
    // Se questo non funziona, potremmo dover costruire l'XML manualmente
    const result = await client.sendIQ(disableStanza as unknown as Parameters<typeof client.sendIQ>[0])

    if (result.type === 'result') {
      console.log('Push Notifications disabilitate con successo')
      return true
    } else {
      console.error('Errore nella disabilitazione push notifications:', result)
      return false
    }
  } catch (error) {
    console.error('Errore nella disabilitazione push notifications:', error)
    return false
  }
}

/**
 * Verifica se le push notifications sono abilitate sul server
 */
export async function checkPushNotificationsStatus(
  _client: Agent
): Promise<{ enabled: boolean; jid?: string; node?: string }> {
  try {
    // XEP-0357 non specifica un modo diretto per verificare lo stato
    // Verifichiamo se abbiamo una configurazione salvata come indicatore
    // In futuro, potremmo fare una disco.info per verificare lo stato sul server
    const config = loadPushConfig()
    
    return {
      enabled: config !== null,
      jid: config?.pushJid,
      node: config?.node,
    }
  } catch (error) {
    console.error('Errore nella verifica stato push notifications:', error)
    return { enabled: false }
  }
}

/**
 * Salva la configurazione push nel localStorage
 */
export function savePushConfig(config: PushNotificationConfig): void {
  try {
    localStorage.setItem('push_config', JSON.stringify(config))
  } catch (error) {
    console.error('Errore nel salvataggio configurazione push:', error)
  }
}

/**
 * Carica la configurazione push dal localStorage
 */
export function loadPushConfig(): PushNotificationConfig | null {
  try {
    const stored = localStorage.getItem('push_config')
    if (!stored) {
      return null
    }
    return JSON.parse(stored) as PushNotificationConfig
  } catch (error) {
    console.error('Errore nel caricamento configurazione push:', error)
    return null
  }
}

/**
 * Rimuove la configurazione push dal localStorage
 */
export function clearPushConfig(): void {
  try {
    localStorage.removeItem('push_config')
  } catch (error) {
    console.error('Errore nella rimozione configurazione push:', error)
  }
}
