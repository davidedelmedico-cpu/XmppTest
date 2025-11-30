# Eccezioni e Comportamenti Speciali nel Codebase

## 📋 Riepilogo

Questo documento elenca tutte le eccezioni, filtri e comportamenti speciali trovati nel codebase che potrebbero causare comportamenti inaspettati.

---

## 🔴 Eccezioni Critiche (CORRETTE)

### 1. Filtro Selfchat - `conversations.ts:65`
**Status:** ✅ CORRETTO

**Problema originale:**
```typescript
if (!contactJid || contactJid === normalizeJid(myJid)) {
  continue // Skip messaggi a se stesso o senza contatto valido
}
```

**Correzione applicata:**
```typescript
if (!contactJid) {
  continue // Skip messaggi senza contatto valido
}
```

**Impatto:** Le selfchat ora appaiono nella lista delle conversazioni.

---

### 2. Filtro Selfchat - `conversations.ts:293`
**Status:** ✅ CORRETTO

**Problema originale:**
```typescript
if (!contactJid || contactJid === myBareJid) {
  return // Skip messaggi a se stesso
}
```

**Correzione applicata:**
```typescript
if (!contactJid) {
  return // Skip messaggi senza contatto valido
}
```

**Impatto:** Le selfchat ora si aggiornano correttamente quando arrivano nuovi messaggi.

---

### 3. Filtro Selfchat Real-time - `sync.ts:280`
**Status:** ✅ CORRETTO

**Problema originale:**
```typescript
if (!contactJid || contactJid === myBareJid) {
  return { success: false, error: 'JID contatto non valido' }
}
```

**Correzione applicata:**
```typescript
if (!contactJid) {
  return { success: false, error: 'JID contatto non valido' }
}
```

**Impatto:** Le selfchat ora ricevono aggiornamenti real-time correttamente.

---

## ⚠️ Filtri di Tipo Messaggio

### 4. Filtro Tipo Chat - `conversations.ts:56-60`
**Status:** 🔶 INTENZIONALE (da valutare)

```typescript
const chatMessages = messages.filter((msg) => {
  const type = msg.item.message?.type
  const body = msg.item.message?.body
  return (!type || type === 'chat') && body && body.trim().length > 0
})
```

**Cosa filtra:**
- ❌ Messaggi di tipo `groupchat` (chat di gruppo)
- ❌ Messaggi di tipo `headline` (notifiche)
- ❌ Messaggi di tipo `error` (errori)
- ❌ Messaggi di tipo `normal` (messaggi normali non-chat)
- ❌ Messaggi senza body o con body vuoto

**Impatto:**
- Le chat di gruppo **NON** appaiono nella lista conversazioni
- Messaggi di sistema/notifica vengono ignorati
- Messaggi vuoti (ping, typing indicators, etc.) vengono filtrati

**Nota:** Questo filtro è applicato alla funzione `groupMessagesByContact` che costruisce la lista delle conversazioni dal MAM.

---

## 🔷 Filtri Body Vuoto

### 5. Filtro Messaggi Vuoti - `messages.ts:160`
**Status:** 🔶 INTENZIONALE

```typescript
const validMessages = allMessages.filter(msg => msg.body && msg.body.trim().length > 0)
```

**Cosa filtra:**
- ❌ Messaggi senza body
- ❌ Messaggi con body vuoto o solo spazi

**Impatto:**
- Messaggi di controllo (typing indicators, read receipts) vengono salvati nel DB ma non mostrati nella UI
- Messaggi vuoti inviati accidentalmente non appaiono

**Posizioni:**
- `messages.ts:160` - Durante caricamento MAM
- `messages.ts:376` - Durante recupero messaggi locali
- `hooks/useMessages.ts:189` - Durante reload completo

---

### 6. Filtro Body nei Messaggi In Arrivo - `sync.ts:268`
**Status:** 🔶 INTENZIONALE

```typescript
if (!this.client || !message.body) {
  return { success: false, error: 'Messaggio o client non valido' }
}
```

**Impatto:**
- Messaggi real-time senza body vengono ignorati
- Non viene attivata la sincronizzazione per messaggi vuoti

**Nota:** Anche `XmppContext.tsx:124` ha un filtro simile: `if (!jid || !message.body || !client) return`

---

## 📊 Comportamenti Timestamp

### 7. Logica Timestamp "Recente" - `conversations-db.ts:230-232, 271-272`
**Status:** 🔶 INTENZIONALE (hardcoded)

```typescript
const now = new Date()
const existingIsRecent = Math.abs(existing.timestamp.getTime() - now.getTime()) < 5000
const newIsNotRecent = Math.abs(message.timestamp.getTime() - now.getTime()) > 5000
if (existingIsRecent && newIsNotRecent) {
  updated.timestamp = message.timestamp
  shouldUpdate = true
}
```

**Comportamento:**
- Se un messaggio esistente ha timestamp "recente" (< 5 secondi dall'adesso)
- E il nuovo messaggio ha timestamp "non recente" (> 5 secondi dall'adesso)
- Allora aggiorna il timestamp al valore del nuovo messaggio

**Impatto:**
- Corregge timestamp placeholder/temporanei con timestamp reali dal server
- **Hardcoded:** 5000ms (5 secondi) è il threshold

---

### 8. Arrotondamento Timestamp Selfchat - `messages.ts:76`
**Status:** 🔶 INTENZIONALE

```typescript
const timestampKey = Math.floor(msg.timestamp.getTime() / 1000)
const key = `${msg.body}:${timestampKey}`
```

**Comportamento:**
- Arrotonda i timestamp al secondo per identificare duplicati nelle selfchat
- Usa `body + timestamp` come chiave per de-duplicazione

**Impatto:**
- Messaggi con stesso body inviati nello stesso secondo potrebbero essere considerati duplicati
- Necessario per gestire la doppia apparizione dei messaggi selfchat nel MAM

---

## 🔐 Status Messaggi

### 9. Upgrade Status Only - `conversations-db.ts:222, 264`
**Status:** 🔶 INTENZIONALE

```typescript
// Aggiorna status se il nuovo è migliore (pending -> sent)
if (existing.status === 'pending' && message.status === 'sent') {
  updated.status = 'sent'
  shouldUpdate = true
}
```

**Comportamento:**
- Lo status dei messaggi può solo "migliorare", mai peggiorare
- `pending` → `sent` ✅
- `sent` → `pending` ❌ (ignorato)

**Impatto:**
- Previene regressioni di status
- Se un messaggio viene confermato, non può tornare a pending

---

### 10. Messaggi MAM Sempre "sent" - `messages.ts:53`
**Status:** 🔶 INTENZIONALE

```typescript
status: 'sent', // Messaggi MAM sono già inviati
```

**Comportamento:**
- Tutti i messaggi recuperati dal MAM sono marcati come `sent`
- Non esiste distinzione tra `sent`, `delivered`, `read` per messaggi dal MAM

**Impatto:**
- I messaggi storici non mantengono informazioni di delivery/lettura

---

### 11. Retry Solo per Status "failed" - `messages.ts:333`
**Status:** 🔶 INTENZIONALE

```typescript
if (message.status !== 'failed') {
  return { success: false, error: 'Il messaggio non è in stato failed' }
}
```

**Comportamento:**
- Si può fare retry solo di messaggi con status `failed`
- Messaggi `pending` o `sent` non possono essere re-inviati

---

## 📈 UnreadCount

### 12. UnreadCount Logica - `conversations.ts:316`
**Status:** 🔶 INTENZIONALE

```typescript
unreadCount: from.startsWith(myBareJid) ? 0 : 1
```

**Comportamento:**
- Messaggi inviati da me: `unreadCount = 0`
- Messaggi ricevuti: `unreadCount = 1`
- L'incremento è sempre 1, non accumula

**Impatto:**
- Ogni nuovo messaggio ricevuto resetta `unreadCount` a 1, non lo incrementa
- Per mostrare il conteggio corretto, serve logica aggiuntiva

**Nota:** La funzione `updateConversation` in `conversations-db.ts:100-101` mantiene il `unreadCount` esistente se non viene esplicitamente resettato.

---

## 🌐 Valori Hardcoded

### 13. Default XMPP Domain - `constants.ts:2-3`
**Status:** 🔶 CONFIGURAZIONE

```typescript
export const DEFAULT_XMPP_DOMAIN = 'jabber.hot-chilli.net';
export const DEFAULT_XMPP_WEBSOCKET = 'wss://jabber.hot-chilli.net:5281/xmpp-websocket';
```

**Impatto:**
- Server XMPP hardcoded
- Potrebbe essere necessario configurare per server diversi

---

### 14. Default Resource - `constants.ts:4`
**Status:** 🔶 CONFIGURAZIONE

```typescript
export const DEFAULT_RESOURCE = 'web-messaging-app';
```

**Impatto:**
- Risorsa XMPP hardcoded per tutti i client
- Utile per identificare connessioni web

---

### 15. Limiti Paginazione - `constants.ts:12-14`
**Status:** 🔶 CONFIGURAZIONE

```typescript
export const PAGINATION = {
  DEFAULT_MESSAGE_LIMIT: 50,
  DEFAULT_CONVERSATION_LIMIT: 100,
  LOAD_MORE_THRESHOLD: 200, // px from top to trigger load more
} as const;
```

**Impatto:**
- Carica 50 messaggi alla volta
- Carica 100 conversazioni alla volta
- Trigger load more a 200px dal top

---

### 16. Pull-to-Refresh Threshold - `constants.ts:20-22`
**Status:** 🔶 CONFIGURAZIONE

```typescript
export const PULL_TO_REFRESH = {
  THRESHOLD: 60, // px distance to trigger refresh
  MAX_DISTANCE: 100, // px max pull distance
} as const;
```

---

### 17. Timeout Connessione - `constants.ts:36`
**Status:** 🔶 CONFIGURAZIONE

```typescript
export const TIMEOUTS = {
  CONNECTION: 5000, // ms - XMPP connection timeout
} as const;
```

---

## 🎯 Roster e DisplayName

### 18. Enrichment con Roster - `conversations.ts:250-277`
**Status:** ℹ️ INFORMATIVO

```typescript
export async function enrichWithRoster(
  client: Agent,
  conversations: Conversation[]
): Promise<Conversation[]> {
  try {
    const rosterResult = await client.getRoster()
    const rosterItems = rosterData.roster?.items || []
    const rosterMap = new Map(
      rosterItems.map((item) => [normalizeJid(item.jid), item])
    )

    return conversations.map((conv) => {
      const rosterItem = rosterMap.get(conv.jid)
      return {
        ...conv,
        displayName: rosterItem?.name || conv.displayName,
      }
    })
  } catch (error) {
    console.error('Errore nel recupero roster:', error)
    return conversations // Ritorna conversazioni senza enrichment se fallisce
  }
}
```

**Comportamento:**
- Tenta di arricchire le conversazioni con nomi dal roster
- Se fallisce, ritorna le conversazioni senza nomi (usa JID come fallback)

---

## 🔄 Self-Chat Alternanza

### 19. Logica Alternanza Selfchat - `messages.ts:66-88`
**Status:** ✅ IMPLEMENTATO CORRETTAMENTE

```typescript
export function applySelfChatLogic(messages: Message[], isSelfChat: boolean): Message[] {
  if (!isSelfChat || messages.length === 0) {
    return messages
  }

  const seenMessages = new Map<string, number>()
  
  return messages.map((msg) => {
    const timestampKey = Math.floor(msg.timestamp.getTime() / 1000)
    const key = `${msg.body}:${timestampKey}`
    
    const occurrenceCount = seenMessages.get(key) || 0
    seenMessages.set(key, occurrenceCount + 1)
    
    // Prima occorrenza = sent ('me'), seconda occorrenza = received ('them')
    return {
      ...msg,
      from: occurrenceCount === 0 ? 'me' : 'them',
    }
  })
}
```

**Comportamento:**
- In selfchat, ogni messaggio appare DUE volte nel MAM
- Prima occorrenza: marcata come `'me'` (inviato)
- Seconda occorrenza: marcata come `'them'` (ricevuto)
- Usa `body + timestamp` per identificare duplicati

**Impatto:**
- Necessario per visualizzare correttamente le selfchat
- Deve essere applicato sull'array completo ordinato, non su batch singoli

---

## 📝 Riassunto Azioni

### ✅ Corretti (3)
1. Filtro selfchat in `groupMessagesByContact`
2. Filtro selfchat in `updateConversationOnNewMessage`
3. Filtro selfchat in `handleIncomingMessage` (sync)

### 🔶 Intenzionali ma da Monitorare (16)
4. Filtro tipo chat (esclude groupchat)
5-6. Filtri body vuoto (multipli file)
7. Logica timestamp "recente" (5 secondi hardcoded)
8. Arrotondamento timestamp selfchat
9. Upgrade-only status messaggi
10. Messaggi MAM sempre "sent"
11. Retry solo per "failed"
12. UnreadCount logica (non accumula)
13-17. Valori hardcoded configurazione
18. Enrichment roster con fallback
19. Alternanza selfchat

---

## 🎯 Raccomandazioni

### Breve Termine
1. ✅ **FATTO:** Rimuovere filtri selfchat
2. 📋 Documentare chiaramente i filtri tipo messaggio
3. 📋 Valutare se supportare groupchat in futuro

### Lungo Termine
1. 🔧 Considerare configurazione dinamica per:
   - Server XMPP
   - Limiti paginazione
   - Threshold timeout
2. 🔧 Implementare accumulo corretto di unreadCount
3. 🔧 Considerare supporto per status `delivered` e `read` (XEP-0184, XEP-0333)
4. 🔧 Valutare logica timestamp più flessibile

---

**Documento generato automaticamente**
**Data:** $(date)
**Branch:** cursor/investigate-selfchat-visibility-issue-claude-4.5-sonnet-thinking-af44
