// Service Worker per funzionalità offline base
const CACHE_NAME = 'alfred-chat-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Le risorse statiche verranno cachate automaticamente durante l'installazione
]

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperto')
        return cache.addAll(urlsToCache)
      })
      .catch((err) => {
        console.log('Service Worker: Errore durante cache', err)
      })
  )
  // Forza l'attivazione immediata del nuovo service worker
  self.skipWaiting()
})

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Rimuovi cache vecchie
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Rimozione cache vecchia', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Prendi il controllo di tutte le pagine immediatamente
  return self.clients.claim()
})

// Strategia: Network First, fallback a Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET
  if (event.request.method !== 'GET') {
    return
  }

  // Ignora richieste XMPP/WebSocket
  if (event.request.url.includes('ws://') || 
      event.request.url.includes('wss://') ||
      event.request.url.includes('/xmpp') ||
      event.request.url.includes('/bosh')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta perché può essere consumata solo una volta
        const responseToCache = response.clone()

        // Cache solo risposte valide
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }

        return response
      })
      .catch(() => {
        // Se la rete fallisce, prova a servire dalla cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Se non c'è cache, restituisci una pagina offline base
            if (event.request.destination === 'document') {
              return caches.match('/index.html')
            }
          })
      })
  )
})

// Gestione messaggi dal client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ============================================
// Push Notifications (XEP-0357)
// ============================================

/**
 * Gestisce le notifiche push in arrivo
 * Quando il server XMPP invia una notifica push, viene chiamato questo handler
 */
self.addEventListener('push', (event) => {
  console.log('Push notification ricevuta:', event)

  let notificationData = {
    title: 'Nuovo messaggio',
    body: 'Hai ricevuto un nuovo messaggio',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'xmpp-message',
    data: {},
  }

  // Se il payload contiene dati, usali
  if (event.data) {
    try {
      const payload = event.data.json()
      if (payload.title) notificationData.title = payload.title
      if (payload.body) notificationData.body = payload.body
      if (payload.icon) notificationData.icon = payload.icon
      if (payload.data) notificationData.data = payload.data
    } catch (error) {
      // Se non è JSON, prova come testo
      const text = event.data.text()
      if (text) {
        notificationData.body = text
      }
    }
  }

  // Mostra la notifica
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  )
})

/**
 * Gestisce il click su una notifica push
 * Apre l'applicazione quando l'utente clicca sulla notifica
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Notifica cliccata:', event)

  event.notification.close()

  // Apri l'applicazione
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra aperta, portala in primo piano
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }

      // Altrimenti, apri una nuova finestra
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

/**
 * Gestisce la chiusura di una notifica
 */
self.addEventListener('notificationclose', (event) => {
  console.log('Notifica chiusa:', event)
  // Qui puoi tracciare statistiche o fare altre azioni
})
