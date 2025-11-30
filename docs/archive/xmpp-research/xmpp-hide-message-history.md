# XMPP: Nascondere Storico Messaggi (non il contatto)

## Problema Correttamente Definito

**Obiettivo:** "Eliminare/nascondere conversazione" significa:
1. ❌ Nascondere tutti i messaggi VECCHI scambiati con un contatto
2. ✅ Continuare a ricevere e vedere NUOVI messaggi da quel contatto
3. ✅ La conversazione riappare "fresca" se arriva un nuovo messaggio

**Non significa:**
- ❌ Bloccare il contatto
- ❌ Nascondere il contatto dalla lista (filtro per JID)

## Esempio Scenario

```
Timeline:

2024-01-01  │ Inizio conversazione con Alice
    ...     │ 1000 messaggi scambiati
2025-11-30  │ Tu: "Rimuovi conversazione" 🗑️
            │
            ├─ Storico (1000 msg): NASCOSTO ❌
            │
2025-12-01  │ Alice: "Ciao!" 
            │ Tu: ✅ VEDI il messaggio (conversazione nuova)
            │
2025-12-02  │ Tu: "Ciao Alice!"
            │ Conversazione continua normalmente
            │
            └─ Storico vecchio: ANCORA NASCOSTO ❌
```

## Soluzioni Possibili

### Soluzione 1: XEP-0049 + Timestamp Cutoff ⭐⭐⭐ MIGLIORE

**Concetto:**
Salva sul server una "data di taglio" per ogni contatto. Quando carichi messaggi, ignora quelli prima di quella data.

**Implementazione:**

```typescript
// Struttura dati salvata sul server (XEP-0049)
interface HiddenMessagesConfig {
  cutoffs: {
    [jid: string]: string  // ISO timestamp
  }
}

// Esempio:
{
  cutoffs: {
    'alice@example.com': '2025-11-30T14:30:00Z',
    'bob@example.com': '2025-10-15T08:00:00Z'
  }
}
```

**Funzionamento:**

```typescript
// 1. Nascondi storico conversazione
async function hideConversationHistory(
  client: Agent,
  contactJid: string
): Promise<void> {
  // Salva timestamp corrente come cutoff
  const cutoffDate = new Date().toISOString()
  
  // Recupera config dal server
  const config = await getHiddenMessagesConfig(client)
  
  // Aggiungi/aggiorna cutoff per questo contatto
  config.cutoffs[contactJid] = cutoffDate
  
  // Salva sul server (XEP-0049)
  await saveHiddenMessagesConfig(client, config)
  
  // Elimina messaggi locali vecchi
  await clearMessagesForConversation(contactJid)
}

// 2. Carica messaggi con filtro cutoff
async function loadMessagesForContact(
  client: Agent,
  contactJid: string,
  options?: { maxResults?: number }
): Promise<Message[]> {
  // Recupera config cutoff dal server
  const config = await getHiddenMessagesConfig(client)
  const cutoffDate = config.cutoffs[contactJid]
  
  // Query MAM con filtro temporale
  const result = await client.searchHistory({
    with: normalizeJid(contactJid),
    start: cutoffDate ? new Date(cutoffDate) : undefined,  // ⭐ FILTRO
    paging: {
      max: options?.maxResults || 50,
    },
  })
  
  // MAM restituisce solo messaggi DOPO il cutoff
  return result.results.map(msg => mamResultToMessage(msg, contactJid, client.jid))
}

// 3. Carica conversazioni (per la lista)
async function loadAllConversations(client: Agent): Promise<Conversation[]> {
  // Recupera config cutoff
  const config = await getHiddenMessagesConfig(client)
  
  // Per ogni contatto con cutoff, query MAM solo DOPO il cutoff
  const conversations: Conversation[] = []
  
  for (const [jid, cutoff] of Object.entries(config.cutoffs)) {
    const result = await client.searchHistory({
      with: jid,
      start: new Date(cutoff),  // ⭐ Solo messaggi nuovi
      paging: { max: 1 },       // Solo l'ultimo
    })
    
    if (result.results.length > 0) {
      // Ci sono messaggi DOPO il cutoff → mostra conversazione
      conversations.push(/* ... */)
    }
    // Altrimenti: nessun messaggio nuovo → conversazione non appare
  }
  
  // Query MAM per contatti SENZA cutoff (normalmente)
  // ...
  
  return conversations
}

// 4. Nuovo messaggio ricevuto in realtime
client.on('message', async (msg) => {
  const contactJid = normalizeJid(msg.from)
  
  // Il messaggio è DOPO il cutoff (è nuovo) → viene salvato e mostrato normalmente
  await handleIncomingMessage(msg, client.jid, contactJid)
  
  // La conversazione riappare nella lista automaticamente
})
```

**Pro:**
- ✅ Sincronizzato tra dispositivi (cutoff salvato su server)
- ✅ MAM rispetta il filtro temporale (`start` parameter)
- ✅ Nuovi messaggi vengono ricevuti normalmente
- ✅ Storico vecchio NON viene mai scaricato (risparmio banda)
- ✅ Reversibile (puoi rimuovere il cutoff e vedere di nuovo lo storico)

**Contro:**
- ⚠️ I messaggi vecchi esistono ancora sul server (non eliminati)
- ⚠️ Se rimuovi il cutoff, riappaiono tutti
- ⚠️ Richiede implementare XEP-0049 custom in Stanza.js

---

### Soluzione 2: XEP-0424 Message Retraction Massiva ⭐ PARZIALE

**Concetto:**
Invia una retraction per OGNI messaggio vecchio che hai inviato tu.

```typescript
async function retractAllMyMessages(
  client: Agent,
  contactJid: string
): Promise<void> {
  // 1. Carica tutti i messaggi
  const messages = await downloadAllMessagesFromServer(client, contactJid)
  
  // 2. Filtra solo messaggi inviati da te
  const myMessages = messages.filter(m => m.from === 'me')
  
  // 3. Invia retraction per ognuno
  for (const msg of myMessages) {
    await sendMessageRetraction(client, contactJid, msg.messageId)
  }
}
```

**Pro:**
- ⚠️ I client moderni nasconderanno i tuoi messaggi vecchi

**Contro:**
- ❌ NON cancella dal server (messaggi ancora in MAM)
- ❌ Non puoi "ritirare" messaggi RICEVUTI (solo quelli inviati da te)
- ❌ Storico mostra ancora i messaggi dell'altra persona
- ❌ Client incompatibili vedono ancora tutto
- ❌ Lento (migliaia di retraction)
- ❌ Molti server limitano retraction a messaggi recenti

**Verdetto:** ❌ Non risolve il problema (lo storico dell'altra persona rimane)

---

### Soluzione 3: Eliminazione Locale + Filtro Timestamp Locale ⭐⭐ SEMPLICE

**Concetto:**
Salva nel database locale una data di cutoff. Filtra messaggi quando li carichi.

```typescript
// Database locale (IndexedDB)
interface Conversation {
  jid: string
  // ...
  hiddenBefore?: Date  // ⭐ NUOVO CAMPO
}

// 1. Nascondi storico
async function hideConversationHistory(
  conversationJid: string
): Promise<void> {
  const cutoffDate = new Date()
  
  // Salva cutoff nel database locale
  await updateConversation(conversationJid, {
    hiddenBefore: cutoffDate
  })
  
  // Elimina messaggi locali vecchi
  await clearMessagesForConversation(conversationJid)
}

// 2. Carica messaggi con filtro
async function loadMessagesForContact(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  // Controlla se c'è un cutoff locale
  const conv = await getConversationByJid(contactJid)
  const cutoffDate = conv?.hiddenBefore
  
  // Query MAM con filtro temporale
  const result = await client.searchHistory({
    with: normalizeJid(contactJid),
    start: cutoffDate,  // ⭐ FILTRO (se presente)
    paging: { max: 50 },
  })
  
  return result.results.map(/* ... */)
}
```

**Pro:**
- ✅ Semplice da implementare (no XEP-0049)
- ✅ MAM rispetta filtro temporale
- ✅ Nuovi messaggi funzionano normalmente
- ✅ Storico vecchio non viene scaricato

**Contro:**
- ❌ NON sincronizzato tra dispositivi
- ❌ Se cambi dispositivo, lo storico vecchio riappare

---

### Soluzione 4: Eliminazione Definitiva Server-Side ⭐⭐⭐⭐ IDEALE (ma non disponibile)

**Concetto:**
Query al server: "elimina tutti i messaggi con questo JID prima di questa data"

```typescript
// ❌ NON ESISTE in XMPP standard
await client.deleteMessagesFromMAM({
  with: 'alice@example.com',
  before: new Date('2025-11-30')
})
```

**Pro:**
- ✅ Eliminazione definitiva
- ✅ Sincronizzato (eliminato per tutti i dispositivi)
- ✅ Risparmio spazio server

**Contro:**
- ❌ **NON ESISTE** in XMPP standard
- ❌ Solo con accesso admin server o estensioni proprietarie

---

## Confronto Soluzioni

| Soluzione | Elimina Server | Sincronizzato | Nuovi Msg OK | Complessità | Fattibilità |
|-----------|----------------|---------------|--------------|-------------|-------------|
| **1. XEP-0049 + Cutoff** | ❌ No | ✅ Sì | ✅ Sì | ⭐⭐⭐ Alta | ✅ Possibile |
| **2. Message Retraction** | ❌ No | ⚠️ Parziale | ✅ Sì | ⭐⭐⭐⭐ Molto alta | ⚠️ Limitato |
| **3. Locale + Cutoff** | ❌ No | ❌ No | ✅ Sì | ⭐ Bassa | ✅ Facile |
| **4. Delete Server-side** | ✅ Sì | ✅ Sì | ✅ Sì | N/A | ❌ Impossibile |

---

## Raccomandazione Finale

### 🎯 Soluzione Ibrida: Locale + XEP-0049 (opzionale)

**Implementazione a due livelli:**

#### Livello 1: Locale (immediato) ⭐⭐⭐
```typescript
// 1. Salva cutoff locale
interface Conversation {
  jid: string
  hiddenBefore?: Date  // Nascondi messaggi prima di questa data
  // ...
}

// 2. Query MAM con filtro temporale
const result = await client.searchHistory({
  with: contactJid,
  start: conversation.hiddenBefore,  // ⭐ Filtro
})

// MAM server rispetta il parametro 'start'
// → Non scarica messaggi vecchi
```

**Pro:**
- ✅ Semplice e immediato
- ✅ Funziona SUBITO
- ✅ Nuovi messaggi OK
- ✅ Non scarica storico vecchio (risparmio banda)

**Contro:**
- ❌ Non sincronizzato tra dispositivi

#### Livello 2: XEP-0049 (sync tra dispositivi) - OPZIONALE
Se vuoi sincronizzazione, aggiungi:
```typescript
// Salva cutoff anche sul server
await saveHiddenMessagesConfig(client, {
  cutoffs: {
    [contactJid]: new Date().toISOString()
  }
})

// Al login su nuovo dispositivo, scarica config
const config = await getHiddenMessagesConfig(client)
// Applica cutoff localmente
```

---

## Implementazione Pratica

### Step 1: Modifica Database Locale

```typescript
// conversations-db.ts
export interface Conversation {
  jid: string
  displayName?: string
  lastMessage: LastMessage
  unreadCount: number
  updatedAt: Date
  hiddenBefore?: Date  // ⭐ NUOVO: nascondi messaggi prima di questa data
}
```

### Step 2: Funzione per Nascondere Storico

```typescript
// conversations.ts
export async function hideConversationHistory(
  conversationJid: string
): Promise<void> {
  const cutoffDate = new Date()
  
  // 1. Salva cutoff nel database
  await updateConversation(conversationJid, {
    hiddenBefore: cutoffDate
  })
  
  // 2. Elimina messaggi locali vecchi (opzionale, per liberare spazio)
  await clearMessagesForConversation(conversationJid)
}
```

### Step 3: Integra nel Caricamento Messaggi

```typescript
// messages.ts
export async function loadMessagesForContact(
  client: Agent,
  contactJid: string,
  options?: { maxResults?: number }
): Promise<Message[]> {
  // 1. Controlla se c'è un cutoff
  const conversations = await getConversations()
  const conv = conversations.find(c => c.jid === normalizeJid(contactJid))
  const cutoffDate = conv?.hiddenBefore
  
  // 2. Query MAM con filtro temporale
  const result = await client.searchHistory({
    with: normalizeJid(contactJid),
    start: cutoffDate,  // ⭐ Se presente, filtra messaggi vecchi
    paging: {
      max: options?.maxResults || PAGINATION.DEFAULT_MESSAGE_LIMIT,
    },
  })
  
  // MAM server restituisce solo messaggi DOPO cutoffDate
  return result.results.map(msg => mamResultToMessage(msg, contactJid, client.jid))
}
```

### Step 4: Carica Conversazioni con Filtro

```typescript
// conversations.ts
export async function loadConversationsFromServer(
  client: Agent,
  options: { /* ... */ } = {}
): Promise<{ conversations: Conversation[] }> {
  // Carica cutoff dal database locale
  const existingConversations = await getConversations()
  const cutoffMap = new Map(
    existingConversations
      .filter(c => c.hiddenBefore)
      .map(c => [c.jid, c.hiddenBefore!])
  )
  
  // Query MAM globale (per nuove conversazioni senza cutoff)
  const result = await client.searchHistory({
    paging: { max: options.maxResults },
  })
  
  // Per conversazioni con cutoff, query separata con filtro temporale
  const conversations: Conversation[] = []
  
  for (const [jid, cutoff] of cutoffMap.entries()) {
    const filtered = await client.searchHistory({
      with: jid,
      start: cutoff,  // ⭐ Solo messaggi dopo il cutoff
      paging: { max: 1 },  // Solo l'ultimo messaggio
    })
    
    if (filtered.results.length > 0) {
      // Ci sono messaggi nuovi → include conversazione
      const lastMsg = filtered.results[0]
      conversations.push({
        jid,
        lastMessage: extractLastMessage(lastMsg),
        hiddenBefore: cutoff,  // Mantieni il cutoff
        // ...
      })
    }
    // Altrimenti: nessun messaggio nuovo → conversazione non appare
  }
  
  // Merge con conversazioni senza cutoff
  // ...
  
  return { conversations }
}
```

### Step 5: UI per Nascondere

```typescript
// ConversationsList.tsx
<button onClick={() => hideConversationHistory(conversation.jid)}>
  🗑️ Elimina storico
</button>
```

---

## Comportamento Finale

```
Utente: "Elimina conversazione con Alice"
   ↓
1. Salva cutoff = 2025-11-30T15:00:00Z
2. Elimina messaggi locali vecchi
3. Conversazione sparisce dalla lista (nessun msg dopo cutoff)
   ↓
Alice scrive: "Ciao!"
   ↓
4. Messaggio ricevuto (timestamp > cutoff) ✅
5. Conversazione riappare nella lista
6. Apertura chat → query MAM con start=cutoff
7. Mostra SOLO il nuovo messaggio "Ciao!"
8. Storico vecchio NON viene mai scaricato ✅
```

---

## Conclusione

**✅ SOLUZIONE PRATICA:**
1. Aggiungi campo `hiddenBefore` a `Conversation`
2. Quando nascondi conversazione, salva `new Date()`
3. Query MAM con `start: hiddenBefore`
4. MAM server **rispetta il filtro** e non restituisce messaggi vecchi
5. Nuovi messaggi funzionano normalmente

**Vuoi che implementi questa soluzione?**

Modifiche necessarie:
- ✅ `conversations-db.ts` - aggiungi campo `hiddenBefore`
- ✅ `conversations.ts` - funzione `hideConversationHistory()`
- ✅ `messages.ts` - integra filtro cutoff nelle query MAM
- ✅ UI - pulsante "Elimina storico"

**È quello che ti serve?** 🤔
