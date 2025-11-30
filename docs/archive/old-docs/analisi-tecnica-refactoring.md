# Analisi Tecnica del Refactoring

## Data
30 Novembre 2025

## Obiettivo
Analisi dettagliata delle modifiche necessarie per implementare la nuova strategia di sincronizzazione ottimizzata.

## File da Modificare

### 1. `services/conversations.ts` ⚠️ MODIFICHE PESANTI

**Stato attuale:**
- `loadConversationsFromServer()`: Scarica messaggi MAM ma NON li salva
- `downloadAllConversations()`: Raggruppa e tiene solo ultimo messaggio
- `enrichWithRoster()`: Scarica vCard ma con logica semplificata

**Modifiche necessarie:**
- ✅ Mantenere le funzioni esistenti per compatibilità
- ➕ Aggiungere parametro `saveMessages: boolean` a `loadConversationsFromServer()`
- ➕ Implementare salvataggio messaggi nel database durante lo scaricamento
- ➕ Aggiungere funzione `loadMessagesForConversation()` per chat singola

### 2. `services/vcard.ts` 📖 DA VERIFICARE

**Da verificare:**
- Funzioni esistenti per getVCard
- Se supporta batch/parallelo
- Integrazione con database vcards

**Modifiche previste:**
- ➕ Funzione `downloadAndSaveVCard()` per singolo contatto
- ➕ Funzione `downloadAndSaveAllVCards()` per batch parallelo
- ✅ Usare store vcards del database

### 3. `services/sync.ts` ➕ NUOVO FILE

**Da creare:**
File centrale per orchestrare la sincronizzazione

**Funzioni da implementare:**
```typescript
// Sincronizzazione completa (lista conversazioni)
export async function syncAllConversations(client: Agent): Promise<void>

// Sincronizzazione singola conversazione (chat)
export async function syncSingleConversation(
  client: Agent,
  contactJid: string
): Promise<void>

// Helper: Download messaggi globale con salvataggio
async function downloadAndSaveAllMessages(client: Agent): Promise<Conversation[]>

// Helper: Download messaggi per conversazione con salvataggio
async function downloadAndSaveMessagesForConversation(
  client: Agent,
  contactJid: string
): Promise<Message[]>
```

### 4. `contexts/XmppContext.tsx` ⚠️ MODIFICHE MEDIE

**Stato attuale:**
- `refreshConversations()`: Chiama `downloadAllConversations()` + `enrichWithRoster()`

**Modifiche necessarie:**
- 🔄 Sostituire `refreshConversations()` con chiamata a `syncAllConversations()`
- ➕ Aggiungere `refreshSingleConversation(jid: string)` che chiama `syncSingleConversation()`
- ✅ Esporre entrambe nel context

### 5. `components/ConversationsList.tsx` ⚠️ MODIFICHE MINIME

**Stato attuale:**
- Pull-to-refresh chiama `refreshConversations()` dal context

**Modifiche necessarie:**
- ✅ Nessuna modifica sostanziale (usa già `refreshConversations` che ora fa più cose)
- 📝 Opzionale: Aggiungere progress indicator per prima sincronizzazione

### 6. `pages/ChatPage.tsx` ⚠️ MODIFICHE SIGNIFICATIVE

**Stato attuale:**
- Carica messaggi sempre dal server via MAM query specifica
- Non ha pull-to-refresh

**Modifiche necessarie:**
- ➕ Implementare pull-to-refresh per chat singola
- 🔄 Modificare caricamento messaggi:
  1. Prima caricare da cache locale (`getMessagesForConversation()`)
  2. Mostrare immediatamente all'utente
  3. Poi sincronizzare in background se necessario
- ➕ Aggiungere indicatore pull-to-refresh

### 7. `services/messages.ts` 📖 DA VERIFICARE

**Da verificare:**
- Se esiste già
- Funzioni per MAM query per conversazione specifica

**Se non esiste, creare:**
```typescript
export async function loadMessagesFromServer(
  client: Agent,
  contactJid: string,
  options?: {
    startDate?: Date
    endDate?: Date
    maxResults?: number
  }
): Promise<Message[]>
```

## Struttura dei Dati

### Message (già esistente in conversations-db.ts)

```typescript
interface Message {
  messageId: string
  conversationJid: string
  body: string
  timestamp: Date
  from: 'me' | 'them'
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  tempId?: string
}
```

### Conversation (già esistente)

```typescript
interface Conversation {
  jid: string
  displayName?: string
  avatarData?: string
  avatarType?: string
  lastMessage: {
    body: string
    timestamp: Date
    from: 'me' | 'them'
    messageId: string
  }
  unreadCount: number
  updatedAt: Date
}
```

### VCardCache (già esistente)

```typescript
interface VCardCache {
  jid: string
  fullName?: string
  nickname?: string
  photoData?: string
  photoType?: string
  email?: string
  description?: string
  lastUpdated: Date
}
```

## Flusso di Dati Dettagliato

### Scenario 1: Pull-to-Refresh Lista Conversazioni

```
ConversationsList.tsx
  ↓ (pull-to-refresh)
useXmpp().refreshConversations() // ora rinominata refreshAllConversations()
  ↓
XmppContext.tsx: refreshAllConversations()
  ↓
sync.ts: syncAllConversations(client)
  ↓
  ├─→ downloadAndSaveAllMessages(client)
  │     ↓
  │     ├─→ conversations.ts: loadConversationsFromServer(client, { saveMessages: true })
  │     │     ↓
  │     │     ├─→ client.searchHistory({}) // Query MAM globale
  │     │     │     ↓
  │     │     │     └─→ Restituisce MAMResult[] (tutti i messaggi)
  │     │     │
  │     │     ├─→ Converte MAMResult[] in Message[]
  │     │     │
  │     │     └─→ conversations-db.ts: saveMessages(messages)
  │     │           ↓
  │     │           └─→ IndexedDB: store 'messages'
  │     │
  │     └─→ Raggruppa messaggi per contatto
  │           ↓
  │           └─→ Restituisce Conversation[]
  │
  ├─→ conversations-db.ts: saveConversations(conversations)
  │     ↓
  │     └─→ IndexedDB: store 'conversations'
  │
  └─→ downloadAndSaveAllVCards(client, jids)
        ↓
        ├─→ Per ogni JID in parallelo (batch di 10):
        │     └─→ vcard.ts: getVCard(client, jid, forceRefresh: true)
        │
        └─→ conversations-db.ts: saveVCards(vcards)
              ↓
              └─→ IndexedDB: store 'vcards'
```

### Scenario 2: Pull-to-Refresh Chat Singola

```
ChatPage.tsx
  ↓ (pull-to-refresh)
useXmpp().refreshSingleConversation(contactJid)
  ↓
XmppContext.tsx: refreshSingleConversation(jid)
  ↓
sync.ts: syncSingleConversation(client, contactJid)
  ↓
  ├─→ downloadAndSaveMessagesForConversation(client, contactJid)
  │     ↓
  │     ├─→ messages.ts: loadMessagesFromServer(client, contactJid)
  │     │     ↓
  │     │     └─→ client.searchHistory({ with: contactJid }) // Query MAM filtrata
  │     │           ↓
  │     │           └─→ Restituisce MAMResult[] (solo quel contatto)
  │     │
  │     ├─→ Converte MAMResult[] in Message[]
  │     │
  │     └─→ conversations-db.ts: saveMessages(messages)
  │           ↓
  │           └─→ IndexedDB: store 'messages'
  │
  ├─→ Aggiorna conversazione in database
  │     └─→ conversations-db.ts: updateConversation(jid, updates)
  │
  └─→ downloadAndSaveVCard(client, contactJid)
        ↓
        ├─→ vcard.ts: getVCard(client, contactJid, forceRefresh: true)
        │
        └─→ conversations-db.ts: saveVCard(vcard)
              ↓
              └─→ IndexedDB: store 'vcards'
```

### Scenario 3: Apertura Chat (dopo sincronizzazione)

```
ChatPage.tsx: useEffect(() => { loadMessages() })
  ↓
conversations-db.ts: getMessagesForConversation(contactJid, { limit: 50 })
  ↓
IndexedDB: store 'messages' (index: by-conversation-timestamp)
  ↓
Restituisce Message[] dalla cache locale
  ↓
ChatPage.tsx: setMessages(cachedMessages)
  ↓
Render immediato (< 100ms)
```

## Dipendenze tra Funzioni

### Nuove Funzioni da Creare

1. **sync.ts** (nuovo file)
   - `syncAllConversations()` - dipende da:
     - `downloadAndSaveAllMessages()` (interno)
     - `downloadAndSaveAllVCards()` (interno)
   - `syncSingleConversation()` - dipende da:
     - `downloadAndSaveMessagesForConversation()` (interno)
     - `downloadAndSaveVCard()` (interno)

2. **conversations.ts** (modifiche)
   - `loadConversationsFromServer()` con parametro `saveMessages`
   - Nessuna breaking change

3. **messages.ts** (nuovo file o estensione)
   - `loadMessagesFromServer()` per chat singola

4. **vcard.ts** (verificare/aggiungere)
   - `downloadAndSaveVCard()` per singolo
   - `downloadAndSaveAllVCards()` per batch

## Database Operations

### Store: messages

**Operazioni necessarie:**
- ✅ `saveMessages(messages[])` - già esiste
- ✅ `getMessagesForConversation(jid, options)` - già esiste
- ✅ `countMessagesForConversation(jid)` - già esiste

### Store: conversations

**Operazioni necessarie:**
- ✅ `saveConversations(conversations[])` - già esiste
- ✅ `updateConversation(jid, updates)` - già esiste
- ✅ `getConversations()` - già esiste

### Store: vcards

**Operazioni necessarie:**
- ✅ `saveVCard(vcard)` - già esiste
- ✅ `saveVCards(vcards[])` - già esiste
- ✅ `getVCard(jid)` - già esiste

**Conclusione:** Il database è già pronto! Nessuna modifica necessaria.

## Gestione Errori

### Query MAM Fallite

```typescript
try {
  await client.searchHistory({})
} catch (error) {
  // Retry con backoff esponenziale (3 tentativi)
  // Se fallisce comunque, mostra errore all'utente
  // Non bloccare l'app - usa dati in cache
}
```

### vCard Non Disponibile

```typescript
try {
  const vcard = await client.getVCard(jid)
} catch (error) {
  // Fallback: usa JID come displayName
  // Non considerare errore critico
  console.warn('vCard non disponibile per', jid)
}
```

### Storage Quota Exceeded

```typescript
try {
  await saveMessages(messages)
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Notifica utente
    // Suggerisci pulizia messaggi vecchi
    // Implementa pulizia automatica (messaggi > 90 giorni)
  }
}
```

## Performance Considerations

### Batch Processing vCard

```typescript
// NON fare così (sequenziale)
for (const jid of jids) {
  await getVCard(client, jid)
}

// Fare così (parallelo con limit)
const chunks = chunkArray(jids, 10) // Batch di 10
for (const chunk of chunks) {
  await Promise.all(chunk.map(jid => getVCard(client, jid)))
}
```

### Debouncing Pull-to-Refresh

```typescript
// Evitare sincronizzazioni multiple simultanee
let syncInProgress = false

async function syncAllConversations() {
  if (syncInProgress) {
    console.log('Sincronizzazione già in corso, skip')
    return
  }
  
  syncInProgress = true
  try {
    // ... sincronizzazione ...
  } finally {
    syncInProgress = false
  }
}
```

### IndexedDB Transaction Optimization

```typescript
// Usare transazioni per batch di write
const tx = db.transaction('messages', 'readwrite')
for (const message of messages) {
  await tx.store.put(message) // Tutti nella stessa transazione
}
await tx.done
```

## Testing Strategy

### Unit Tests

1. `sync.ts`: 
   - Test `syncAllConversations()` con mock client
   - Test `syncSingleConversation()` con mock client
   - Test gestione errori

2. `conversations.ts`:
   - Test `loadConversationsFromServer()` con `saveMessages: true`
   - Verificare che messaggi vengano salvati

3. `messages.ts`:
   - Test `loadMessagesFromServer()` con filtro JID

### Integration Tests

1. Pull-to-refresh lista:
   - Query MAM globale → Messaggi salvati → Conversazioni aggiornate → vCard scaricati

2. Pull-to-refresh chat:
   - Query MAM filtrata → Messaggi salvati → Conversazione aggiornata → vCard scaricato

3. Apertura chat:
   - Messaggi caricati da cache → Nessuna query al server

### Manual Testing

1. **Scenario completo:**
   - Login → Pull-to-refresh lista → Verificare tutto sincronizzato
   - Aprire chat → Verificare caricamento istantaneo
   - Pull-to-refresh chat → Verificare aggiornamento solo quella

2. **Offline mode:**
   - Sincronizzare → Disattivare rete → Verificare chat funzionanti

3. **Performance:**
   - Misurare tempi di:
     - Pull-to-refresh lista (target: < 5s per 100 conversazioni)
     - Apertura chat (target: < 100ms)
     - Pull-to-refresh chat (target: < 2s)

## Backward Compatibility

### Approccio Incrementale

1. **Fase 1**: Implementare nuove funzioni senza rimuovere vecchie
2. **Fase 2**: Aggiornare context per usare nuove funzioni
3. **Fase 3**: Aggiornare componenti progressivamente
4. **Fase 4**: Rimuovere codice deprecato (se necessario)

### Funzioni Deprecate

- `loadAllConversations()` → Sostituita da `syncAllConversations()`
- Mantenere per compatibilità per ora, marcare come `@deprecated`

## Migrazione Dati

### Database Schema

- ✅ Nessuna modifica allo schema necessaria
- ✅ Store `messages` già presente (v2)
- ✅ Store `vcards` già presente (v3)

### Dati Esistenti

- ✅ Conversazioni esistenti rimangono valide
- ➕ Messaggi verranno popolati al primo pull-to-refresh
- ➕ vCard verranno popolati al primo pull-to-refresh

## Conclusione

### Complessità Stimata

- **Bassa**: Database già pronto, schema completo
- **Media**: Nuove funzioni di sincronizzazione
- **Alta**: Coordinamento tra servizi e gestione errori

### Rischi

1. **Performance**: Prima sincronizzazione potrebbe essere lenta
   - Mitigazione: Progress indicator, sincronizzazione in background

2. **Storage**: Database locale potrebbe crescere molto
   - Mitigazione: Pulizia automatica messaggi vecchi

3. **Errori rete**: Query MAM potrebbero fallire
   - Mitigazione: Retry con backoff, fallback a cache

### Stima Tempo Implementazione

- Creazione servizi: 2-3 ore
- Aggiornamento context: 1 ora
- Aggiornamento componenti: 2 ore
- Testing: 2 ore
- **Totale**: ~7-8 ore

### Priorità

1. **ALTA**: Implementare `sync.ts` con logiche base
2. **ALTA**: Aggiornare `XmppContext.tsx` con nuove funzioni
3. **MEDIA**: Aggiornare `ChatPage.tsx` con pull-to-refresh
4. **BASSA**: Ottimizzazioni performance (batch vCard, etc.)
