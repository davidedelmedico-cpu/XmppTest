# Analisi Tecnica: Recupero Conversazioni 1-to-1 via XMPP

## Obiettivo
Ottenere la lista completa delle conversazioni 1-to-1 con paginazione lazy loading quando l'utente scrolla.

## Standard XMPP Rilevanti

### 1. MAM (Message Archive Management) - XEP-0313
**Scopo**: Recuperare lo storico dei messaggi archiviati sul server.

**Come funziona**:
- Il server XMPP archivia i messaggi in un database
- Il client può fare query per recuperare messaggi filtrati
- Supporta paginazione nativa tramite RSM (Result Set Management) - XEP-0059

**Query MAM tipica**:
```xml
<iq type='set' id='query1'>
  <query xmlns='urn:xmpp:mam:2'>
    <x xmlns='jabber:x:data' type='submit'>
      <field var='FORM_TYPE'><value>urn:xmpp:mam:2</value></field>
      <field var='with'><value>contact@server.com</value></field>
    </x>
    <set xmlns='http://jabber.org/protocol/rsm'>
      <max>50</max>
      <before/>
    </set>
  </query>
</iq>
```

**Vantaggi**:
- ✅ Supporto nativo alla paginazione (RSM)
- ✅ Filtri avanzati (data, contatto, tipo messaggio)
- ✅ Recupero efficiente con limiti di risultati
- ✅ Supportato da conversations.im

**Svantaggi**:
- ⚠️ Richiede che il server supporti MAM
- ⚠️ Potrebbe essere lento per account con molti messaggi
- ⚠️ Restituisce messaggi, non "conversazioni" direttamente

### 2. Roster (Lista Contatti) - XEP-0016
**Scopo**: Gestire la lista di contatti dell'utente.

**Come funziona**:
- Il roster contiene tutti i contatti aggiunti
- Ogni contatto ha uno stato (subscribed, unsubscribed, etc.)
- Non contiene messaggi o conversazioni

**Vantaggi**:
- ✅ Standard universale, sempre supportato
- ✅ Lista completa dei contatti
- ✅ Metadati utili (nome, gruppi)

**Svantaggi**:
- ❌ Non contiene informazioni sulle conversazioni
- ❌ Non mostra quando è stata l'ultima conversazione
- ❌ Non mostra preview dei messaggi

## Strategia Raccomandata: Approccio Ibrido

### Fase 1: Recupero Lista Contatti (Roster)
1. Dopo il login, richiedere il roster completo
2. Ottenere lista di tutti i contatti 1-to-1
3. Questo ci dà la lista base delle persone con cui abbiamo conversato

### Fase 2: Arricchimento con MAM (per ogni contatto)
1. Per ogni contatto nel roster, fare una query MAM per ottenere:
   - Ultimo messaggio ricevuto/inviato
   - Timestamp dell'ultimo messaggio
   - Anteprima del messaggio
2. Ordinare le conversazioni per timestamp (più recenti prima)
3. Implementare paginazione lazy loading

### Alternativa Ottimizzata: Query MAM Globale
1. Fare una singola query MAM senza filtro "with"
2. Il server restituisce tutti i messaggi archiviati
3. Raggruppare per contatto (JID) lato client
4. Per ogni gruppo, prendere l'ultimo messaggio
5. Ordinare per timestamp
6. Implementare paginazione sui risultati raggruppati

**Vantaggi**:
- ✅ Meno query al server
- ✅ Più efficiente
- ✅ Un solo punto di paginazione

**Svantaggi**:
- ⚠️ Potrebbe restituire molti messaggi se l'archivio è grande
- ⚠️ Richiede più elaborazione lato client

## Implementazione Paginazione

### Con RSM (Result Set Management) - XEP-0059
RSM è lo standard XMPP per la paginazione.

**Prima pagina**:
```xml
<set xmlns='http://jabber.org/protocol/rsm'>
  <max>50</max>
</set>
```

**Pagine successive**:
```xml
<set xmlns='http://jabber.org/protocol/rsm'>
  <max>50</max>
  <after>paging-token-from-previous-response</after>
</set>
```

**Response include token per pagina successiva**:
```xml
<set xmlns='http://jabber.org/protocol/rsm'>
  <first index='0'>first-token</first>
  <last>last-token</last>
  <count>1234</count>
</set>
```

### Strategia Lazy Loading
1. Caricare prima pagina (es. 20 conversazioni)
2. Quando utente scrolla vicino alla fine, caricare pagina successiva
3. Usare Intersection Observer API per detectare scroll
4. Mantenere stato delle pagine caricate
5. Evitare richieste duplicate

## Struttura Dati Proposta

```typescript
interface Conversation {
  jid: string                    // JID del contatto (es. mario@server.com)
  displayName?: string           // Nome visualizzato (dal roster)
  lastMessage?: {
    body: string                 // Testo ultimo messaggio
    timestamp: Date              // Quando è stato inviato/ricevuto
    from: 'me' | 'them'         // Chi ha inviato
    type: 'chat' | 'groupchat'  // Tipo conversazione
  }
  unreadCount?: number          // Messaggi non letti (se supportato)
  avatar?: string               // Avatar del contatto (se disponibile)
}

interface ConversationsState {
  conversations: Conversation[]
  isLoading: boolean
  hasMore: boolean
  currentPage: number
  pageSize: number
  lastRSMToken?: string         // Token per pagina successiva
}
```

## Flusso Implementazione

### 1. Dopo Login Riuscito
```
Login → Mantieni connessione attiva → 
Richiedi Roster → 
Richiedi MAM (prima pagina) → 
Raggruppa per contatto → 
Ordina per timestamp → 
Mostra lista
```

### 2. Durante Scroll
```
Utente scrolla → 
Intersection Observer detecta fine lista → 
Richiedi MAM (pagina successiva) → 
Raggruppa e ordina → 
Aggiungi alla lista esistente
```

### 3. Gestione Eventi Real-time
```
Nuovo messaggio ricevuto → 
Aggiorna conversazione corrispondente → 
Sposta in cima alla lista → 
Aggiorna UI
```

## Considerazioni Tecniche

### Performance
- **Caching**: Cache locale delle conversazioni già caricate
- **Debouncing**: Evitare troppe richieste durante scroll veloce
- **Virtualizzazione**: Usare react-window o simile per liste lunghe

### Error Handling
- Gestire server che non supportano MAM
- Fallback a roster solo se MAM non disponibile
- Gestire timeout e retry per query MAM

### Compatibilità
- Verificare supporto MAM del server (discovery via Service Discovery)
- conversations.im supporta MAM (verificato)
- Fallback graceful se MAM non disponibile

## Libreria Stanza - API Disponibili

Basandoci sulla libreria `stanza` v12.21.0, ho verificato le API disponibili:

### Roster Plugin
```typescript
// Richiedere roster completo
const rosterResult = await client.getRoster()
// Restituisce: { roster: Roster, ver?: string }

// Roster contiene array di RosterItem:
interface RosterItem {
  jid: string
  name?: string
  subscription: 'none' | 'to' | 'from' | 'both'
  groups?: string[]
  ask?: 'subscribe'
}

// Ascoltare aggiornamenti roster
client.on('roster:update', (data) => {
  // data.roster contiene il roster aggiornato
})
```

### MAM Plugin (Message Archive Management)
```typescript
// Query MAM con opzioni
const result = await client.searchHistory({
  with: 'contact@server.com',  // Opzionale: filtra per contatto specifico
  start: new Date('2024-01-01'), // Opzionale: data inizio
  end: new Date(),               // Opzionale: data fine
  paging: {                      // Paginazione RSM
    max: 50,                     // Numero massimo risultati
    before: 'token',             // Token per pagina precedente
    after: 'token',              // Token per pagina successiva
  }
})

// Result contiene:
interface MAMFin {
  complete: boolean              // Se la query è completa
  stable: boolean                // Se i risultati sono stabili
  results?: MAMResult[]          // Array di messaggi archiviati
  paging?: Paging                // Info paginazione per pagina successiva
}

// Ogni MAMResult contiene:
interface MAMResult {
  queryId: string
  id: string                     // ID univoco del messaggio
  item: Forward                  // Il messaggio stesso
}

// Il messaggio è dentro item.message:
interface Message {
  from: string                   // JID mittente
  to: string                     // JID destinatario
  body?: string                  // Testo del messaggio
  timestamp?: Date               // Quando è stato inviato
  // ... altri campi
}

// Ascoltare messaggi archiviati in tempo reale
client.on('mam:item', (message: ReceivedMessage) => {
  // Nuovo messaggio archiviato ricevuto
})
```

### Paginazione RSM (Result Set Management)
```typescript
// Prima pagina
const page1 = await client.searchHistory({
  paging: { max: 50 }
})

// Pagina successiva (usando token dalla risposta precedente)
const page2 = await client.searchHistory({
  paging: {
    max: 50,
    after: page1.paging?.last  // Token dell'ultimo elemento pagina precedente
  }
})

// La risposta include informazioni paginazione:
interface Paging {
  max?: number                   // Limite richiesto
  before?: string                // Token per pagina precedente
  after?: string                 // Token per pagina successiva
  first?: string                 // Token primo elemento
  last?: string                  // Token ultimo elemento
  count?: number                 // Numero totale risultati
  index?: number                 // Indice primo elemento
  firstIndex?: number             // Indice primo elemento (alternativo)
}
```

### Service Discovery
```typescript
// Verificare supporto MAM del server
const discoInfo = await client.getDiscoInfo(domain)
// Cercare feature: 'urn:xmpp:mam:2' in discoInfo.features
```

## Strategia di Implementazione per Conversazioni 1-to-1

### Approccio Scelto: Query MAM Globale con Raggruppamento

**Perché questa strategia:**
1. ✅ Una sola query invece di N query (una per contatto)
2. ✅ Paginazione nativa tramite RSM
3. ✅ Più efficiente per account con molti contatti
4. ✅ conversations.im supporta MAM

### Algoritmo di Recupero Conversazioni

```
1. Dopo login riuscito:
   ├─ Mantieni connessione attiva (NON disconnettere)
   ├─ Verifica supporto MAM (discovery)
   └─ Se supportato:
      ├─ Query MAM globale (senza filtro "with")
      │  ├─ Prima pagina: max=100 messaggi
      │  └─ Raggruppa messaggi per JID contatto
      │
      ├─ Per ogni gruppo (contatto):
      │  ├─ Estrai ultimo messaggio (più recente)
      │  ├─ Estrai timestamp
      │  └─ Estrai preview (primi 50 caratteri)
      │
      ├─ Ordina conversazioni per timestamp (più recenti prima)
      └─ Mostra prime 20 conversazioni

2. Durante scroll (lazy loading):
   ├─ Intersection Observer detecta fine lista
   ├─ Se hasMore === true:
   │  ├─ Query MAM pagina successiva
   │  │  └─ Usa paging.after con token ultima pagina
   │  ├─ Raggruppa nuovi messaggi
   │  ├─ Merge con conversazioni esistenti
   │  └─ Riordina e mostra
   └─ Se hasMore === false:
      └─ Nessuna altra richiesta

3. Real-time updates:
   ├─ Ascolta evento 'message' per nuovi messaggi
   ├─ Aggiorna conversazione corrispondente
   ├─ Sposta in cima alla lista
   └─ Aggiorna UI
```

### Struttura Dati Implementazione

```typescript
// Stato globale conversazioni
interface ConversationsState {
  conversations: Conversation[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  lastRSMToken?: string        // Token per pagina successiva
  pageSize: number            // Default: 20 conversazioni per pagina
  mamSupported: boolean
}

// Singola conversazione
interface Conversation {
  jid: string                 // JID del contatto (normalizzato)
  displayName?: string         // Nome dal roster (se disponibile)
  lastMessage: {
    body: string              // Testo ultimo messaggio
    timestamp: Date           // Quando inviato/ricevuto
    from: 'me' | 'them'       // Chi ha inviato
    messageId: string         // ID messaggio per riferimento
  }
  unreadCount: number         // Messaggi non letti (inizialmente 0)
  avatar?: string            // Avatar (se disponibile via PEP)
}

// Helper per raggruppare messaggi
interface MessageGroup {
  jid: string
  messages: MAMResult[]
  lastMessage: MAMResult
  timestamp: Date
}
```

### Funzioni Chiave da Implementare

```typescript
// 1. Recupera conversazioni (prima pagina)
async function loadConversations(client: Agent): Promise<Conversation[]> {
  // Query MAM senza filtro
  const result = await client.searchHistory({
    paging: { max: 100 }  // Recupera molti messaggi per avere conversazioni complete
  })
  
  // Raggruppa per contatto
  const groups = groupMessagesByContact(result.results || [])
  
  // Converti in conversazioni
  const conversations = groups.map(group => ({
    jid: group.jid,
    lastMessage: {
      body: extractMessageBody(group.lastMessage),
      timestamp: extractTimestamp(group.lastMessage),
      from: extractSender(group.lastMessage),
      messageId: group.lastMessage.id
    },
    unreadCount: 0
  }))
  
  // Ordina per timestamp
  return conversations.sort((a, b) => 
    b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
  )
}

// 2. Carica pagina successiva
async function loadMoreConversations(
  client: Agent, 
  lastToken: string
): Promise<{ conversations: Conversation[], nextToken?: string }> {
  const result = await client.searchHistory({
    paging: {
      max: 100,
      after: lastToken
    }
  })
  
  // Stesso processo di raggruppamento
  // ...
  
  return {
    conversations: [...],
    nextToken: result.paging?.last
  }
}

// 3. Raggruppa messaggi per contatto
function groupMessagesByContact(messages: MAMResult[]): MessageGroup[] {
  const groups = new Map<string, MAMResult[]>()
  
  for (const msg of messages) {
    const contactJid = extractContactJid(msg)
    if (!groups.has(contactJid)) {
      groups.set(contactJid, [])
    }
    groups.get(contactJid)!.push(msg)
  }
  
  return Array.from(groups.entries()).map(([jid, msgs]) => ({
    jid,
    messages: msgs,
    lastMessage: msgs.sort(byTimestamp)[0], // Più recente
    timestamp: extractTimestamp(msgs[0])
  }))
}

// 4. Estrai JID contatto da messaggio
function extractContactJid(msg: MAMResult, myJid: string): string {
  const from = msg.item.message?.from
  const to = msg.item.message?.to
  
  // Se il messaggio è da me, il contatto è "to"
  // Se il messaggio è a me, il contatto è "from"
  if (from === myJid || from?.startsWith(myJid.split('/')[0])) {
    return normalizeJid(to)
  }
  return normalizeJid(from)
}
```

### Gestione Edge Cases

1. **Messaggi senza body**: Alcuni messaggi potrebbero essere solo presence o system
   - Filtrare messaggi senza `body` o con `body` vuoto

2. **JID con resource**: Normalizzare rimuovendo resource per raggruppare correttamente
   - `mario@server.com/mobile` → `mario@server.com`

3. **Messaggi di gruppo**: Filtrare per tipo `chat` (non `groupchat`)
   - Verificare `message.type === 'chat'`

4. **Server senza MAM**: Fallback a roster solo
   - Mostrare lista contatti senza preview messaggi

5. **Timeout query MAM**: Implementare retry con backoff
   - Retry fino a 3 volte con delay crescente

## Prossimi Passi di Implementazione

1. ✅ **Modificare servizio XMPP** per mantenere connessione attiva
2. ✅ **Creare XMPP Context** per gestire stato connessione globale
3. ✅ **Implementare funzione recupero conversazioni** con MAM
4. ✅ **Creare componente ConversationsList** con lazy loading
5. ✅ **Implementare Intersection Observer** per detect scroll
6. ✅ **Gestire eventi real-time** per nuovi messaggi
7. ✅ **Aggiungere React Router** per navigazione login → conversazioni
8. ✅ **Arricchire con dati Roster** (nomi contatti)
