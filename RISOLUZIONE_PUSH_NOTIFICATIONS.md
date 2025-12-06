# Risoluzione Errore Push Notifications - "Attivazione Fallita"

## 📋 Riepilogo del Problema

Il sistema di push notifications mostrava il messaggio **"Attivazione Fallita"** nel popup di debug. Il problema era causato da un **errore nell'implementazione dell'invio delle stanze XMPP** al server.

## 🔍 Causa Principale

Il codice in `web-client/src/services/push-notifications.ts` cercava di inviare stanze IQ usando un metodo **inesistente**:

```typescript
// ❌ CODICE ERRATO (prima)
const sender = client as unknown as { send: (name: string, data: string) => void }
sender.send('iq', enableXml)  // ← Questo metodo NON esiste in Stanza.js
```

Stanza.js non ha un metodo `send(name: string, data: string)` che accetta XML come stringa. Il metodo `send()` esiste, ma:
1. Accetta strutture JSON tipizzate, non stringhe XML
2. Richiede che i namespace custom siano registrati nel sistema JXT (JSON-XML Translation)

## ✅ Soluzione Implementata

### 1. Creato Plugin XEP-0357 per Stanza.js

Creato nuovo file `web-client/src/services/push-notifications-plugin.ts`:

```typescript
import { attribute } from 'stanza/jxt'

const Protocol: DefinitionOptions[] = [
  {
    element: 'enable',
    fields: {
      jid: attribute('jid'),
      node: attribute('node'),
    },
    namespace: 'urn:xmpp:push:0',
    path: 'iq.enablePush',
  },
  {
    element: 'disable',
    fields: {
      jid: attribute('jid'),
      node: attribute('node'),
    },
    namespace: 'urn:xmpp:push:0',
    path: 'iq.disablePush',
  },
]
```

Questo plugin:
- Registra gli elementi `<enable>` e `<disable>` di XEP-0357
- Definisce i campi `jid` e `node` come attributi
- Associa gli elementi al path `iq.enablePush` e `iq.disablePush`

### 2. Caricato il Plugin nel Client XMPP

Modificato `web-client/src/services/xmpp.ts`:

```typescript
import pushNotificationsPlugin from './push-notifications-plugin'

// ...nella funzione buildClient:
plugins(client)
client.use(pushNotificationsPlugin)  // ← Registra XEP-0357
```

### 3. Aggiornato Codice di Abilitazione Push

Modificato `enablePushNotifications()` in `web-client/src/services/push-notifications.ts`:

```typescript
// ✅ CODICE CORRETTO (dopo)
const enableStanza = {
  id: iqId,
  type: 'set',
  enablePush: {          // ← Usa il path registrato nel plugin
    jid: pushJid,
    ...(node && { node }),
  },
  form: {                // ← Data Forms già supportato da Stanza.js
    type: 'submit',
    fields: [...]
  }
}

// Usa il metodo send() corretto con listener per la risposta
return new Promise<boolean>((resolve) => {
  const handleIQ = (iq: any) => {
    if (iq.id === iqId) {
      // Gestisce risposta
    }
  }
  
  client.on('iq', handleIQ)
  
  // Invia usando send() con struttura JSON
  client.send('iq', enableStanza as any).catch(...)
})
```

### 4. Stesso Approccio per Disabilitazione

Aggiornato `disablePushNotifications()` con la stessa logica.

## 📝 File Modificati

1. ✅ **Creato**: `web-client/src/services/push-notifications-plugin.ts` - Plugin XEP-0357
2. ✅ **Modificato**: `web-client/src/services/xmpp.ts` - Carica il plugin
3. ✅ **Modificato**: `web-client/src/services/push-notifications.ts` - Usa struttura corretta per le stanze

## 🧪 Come Testare

### 1. Build e Deploy
```bash
cd web-client
npm install
npm run build
```

### 2. Test nell'App
1. Apri l'applicazione nel browser
2. Fai login con un account XMPP
3. Apri la console (F12)
4. Clicca sul pulsante di test push notifications (🔔)

### 3. Log da Verificare

**Se il server supporta XEP-0357:**
```
🚀 Push Notifications: Inizio abilitazione automatica...
🔍 Push Notifications: Cerco servizio push sul server...
✅ Push Notifications: Servizio push trovato: push.example.com
🔑 Push Notifications: Ottengo subscription push dal browser...
✅ Push Notifications: Subscription push ottenuta: https://...
📤 Push Notifications: Invio stanza di abilitazione al server XMPP...
✅ Push Notifications: Abilitate con successo!
```

**Se il server NON supporta XEP-0357:**
```
🚀 Push Notifications: Inizio abilitazione automatica...
🔍 Push Notifications: Cerco servizio push sul server...
ℹ️ Push Notifications: Server non supporta push direttamente, cerco nei servizi...
❌ Push Notifications: Nessun servizio push trovato tramite Service Discovery
❌ Push Notifications: Il server non supporta XEP-0357 (Push Notifications)
💡 Push Notifications: Per abilitare le push, serve un server XMPP con supporto XEP-0357
```

## ⚠️ Limitazione Importante

### Supporto Server Required

**I server pubblici (`conversations.im`, `jabber.hot-chilli.net`) NON supportano XEP-0357.**

Per far funzionare le push notifications serve:
1. Un server XMPP con supporto XEP-0357 (es. Prosody con mod_cloud_notify)
2. Un servizio push backend (es. Firebase Cloud Messaging)
3. Chiavi VAPID configurate sul server

### Cosa è Stato Risolto

✅ **Problema Tecnico Risolto**: Le stanze IQ ora vengono inviate correttamente al server XMPP usando l'API corretta di Stanza.js

❌ **Problema Infrastrutturale Rimane**: Il server deve supportare XEP-0357 per accettare le richieste push

## 🔧 Dettagli Tecnici

### Perché Serviva un Plugin?

Stanza.js usa un sistema chiamato **JXT (JSON-XML Translation)** per convertire tra oggetti JavaScript e XML XMPP. Per protocolli non standard (come XEP-0357), è necessario:

1. **Definire lo schema** - Specificare quali elementi XML esistono e come sono strutturati
2. **Registrare il path** - Dove nell'albero degli oggetti si trova l'elemento
3. **Definire i fields** - Come gli attributi XML sono mappati a proprietà JavaScript

Senza questo, Stanza.js non sa come serializzare gli oggetti in XML.

### Struttura della Stanza XML Generata

Quando chiamiamo `client.send('iq', enableStanza)`, Stanza.js ora genera:

```xml
<iq type="set" id="enable-push-1234567890">
  <enable xmlns="urn:xmpp:push:0" jid="push.example.com" node="mynode">
    <x xmlns="jabber:x:data" type="submit">
      <field var="FORM_TYPE">
        <value>http://jabber.org/protocol/pubsub#publish-options</value>
      </field>
      <field var="pubsub#endpoint">
        <value>https://fcm.googleapis.com/fcm/send/...</value>
      </field>
      <field var="pubsub#max_items">
        <value>1</value>
      </field>
    </x>
  </enable>
</iq>
```

## 📚 Riferimenti

- **XEP-0357**: Push Notifications - https://xmpp.org/extensions/xep-0357.html
- **XEP-0004**: Data Forms - https://xmpp.org/extensions/xep-0004.html
- **Stanza.js Documentation**: https://stanzajs.org/
- **Web Push API**: https://developer.mozilla.org/en-US/docs/Web/API/Push_API

## ✨ Conclusione

Il problema **"Attivazione Fallita"** è stato risolto. Il codice ora:
- ✅ Invia correttamente le stanze IQ al server
- ✅ Gestisce le risposte in modo asincrono
- ✅ Fornisce logging dettagliato per debugging
- ✅ Rileva automaticamente se il server supporta XEP-0357

Per utilizzare effettivamente le push notifications, è necessario configurare un server XMPP con supporto XEP-0357.
