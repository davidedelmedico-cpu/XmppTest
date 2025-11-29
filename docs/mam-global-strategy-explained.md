# Come la Strategia MAM Globale Trova TUTTE le Conversazioni Storiche

## Il Dubbio Legittimo

**Domanda**: "Come faccio a trovare TUTTI i contatti con cui ho una conversazione storica se faccio una query MAM globale?"

**Risposta**: La query MAM globale restituisce TUTTI i messaggi archiviati sul server, indipendentemente dal roster attuale. Raggruppando questi messaggi per JID del contatto, ottieni automaticamente TUTTE le conversazioni storiche.

---

## Come Funziona il Raggruppamento

### Step 1: Query MAM Globale

```typescript
const result = await client.searchHistory({
  paging: { max: 100 }
})

// result.results contiene TUTTI i messaggi archiviati
// Esempio:
[
  { id: '1', item: { message: { from: 'mario@server.com', to: 'io@server.com', body: 'Ciao' } } },
  { id: '2', item: { message: { from: 'io@server.com', to: 'mario@server.com', body: 'Ciao anche a te' } } },
  { id: '3', item: { message: { from: 'luigi@server.com', to: 'io@server.com', body: 'Salve' } } },
  { id: '4', item: { message: { from: 'io@server.com', to: 'paolo@server.com', body: 'Hey' } } },
  { id: '5', item: { message: { from: 'mario@server.com', to: 'io@server.com', body: 'Come va?' } } },
]
```

### Step 2: Estrai JID Contatto da Ogni Messaggio

Per ogni messaggio, devi capire chi è il contatto (non tu):

```typescript
function extractContactJid(message: MAMResult, myJid: string): string {
  const from = message.item.message?.from  // Mittente
  const to = message.item.message?.to      // Destinatario
  
  // Normalizza il tuo JID (rimuovi resource)
  const myBareJid = myJid.split('/')[0]  // 'io@server.com/web' → 'io@server.com'
  
  // Se il messaggio è da te, il contatto è il destinatario
  if (from?.startsWith(myBareJid)) {
    return normalizeJid(to)  // 'paolo@server.com'
  }
  
  // Se il messaggio è a te, il contatto è il mittente
  return normalizeJid(from)  // 'mario@server.com', 'luigi@server.com'
}
```

**Risultato per ogni messaggio:**
```
Messaggio 1: mario@server.com → io@server.com → Contatto: mario@server.com
Messaggio 2: io@server.com → mario@server.com → Contatto: mario@server.com
Messaggio 3: luigi@server.com → io@server.com → Contatto: luigi@server.com
Messaggio 4: io@server.com → paolo@server.com → Contatto: paolo@server.com
Messaggio 5: mario@server.com → io@server.com → Contatto: mario@server.com
```

### Step 3: Raggruppa per Contatto

```typescript
function groupMessagesByContact(messages: MAMResult[], myJid: string): Map<string, MAMResult[]> {
  const groups = new Map<string, MAMResult[]>()
  
  for (const msg of messages) {
    const contactJid = extractContactJid(msg, myJid)
    
    if (!groups.has(contactJid)) {
      groups.set(contactJid, [])
    }
    
    groups.get(contactJid)!.push(msg)
  }
  
  return groups
}
```

**Risultato:**
```javascript
Map {
  'mario@server.com' => [messaggio1, messaggio2, messaggio5],
  'luigi@server.com' => [messaggio3],
  'paolo@server.com' => [messaggio4]
}
```

### Step 4: Estrai Ultimo Messaggio per Ogni Contatto

```typescript
const conversations = []

for (const [contactJid, messages] of groups.entries()) {
  // Ordina messaggi per timestamp (più recente prima)
  const sortedMessages = messages.sort((a, b) => 
    extractTimestamp(b) - extractTimestamp(a)
  )
  
  const lastMessage = sortedMessages[0]  // Il più recente
  
  conversations.push({
    jid: contactJid,
    lastMessage: {
      body: lastMessage.item.message?.body,
      timestamp: extractTimestamp(lastMessage),
      from: extractSender(lastMessage, myJid),
      messageId: lastMessage.id
    }
  })
}
```

**Risultato Finale:**
```javascript
[
  { jid: 'mario@server.com', lastMessage: { body: 'Come va?', timestamp: '2024-01-15' } },
  { jid: 'luigi@server.com', lastMessage: { body: 'Salve', timestamp: '2024-01-10' } },
  { jid: 'paolo@server.com', lastMessage: { body: 'Hey', timestamp: '2024-01-12' } }
]
```

---

## Perché Trova TUTTE le Conversazioni

### 1. MAM Archivia TUTTI i Messaggi

Il server XMPP archivia TUTTI i messaggi che hai inviato/ricevuto, indipendentemente da:
- ✅ Se il contatto è ancora nel roster
- ✅ Se hai rimosso il contatto
- ✅ Se il contatto ti ha bloccato
- ✅ Se la conversazione è vecchia di anni

### 2. Il Raggruppamento è Completo

Quando raggruppi per JID:
- ✅ Trovi contatti ancora nel roster
- ✅ Trovi contatti rimossi dal roster
- ✅ Trovi contatti che ti hanno bloccato
- ✅ Trovi conversazioni vecchie

**Esempio Pratico:**

```
Roster attuale: ['mario@server.com', 'luigi@server.com']

MAM contiene messaggi con:
- mario@server.com (nel roster) ✅
- luigi@server.com (nel roster) ✅
- paolo@server.com (rimosso 2 anni fa) ✅ TROVATO!
- anna@server.com (mai aggiunto, ma ha scritto) ✅ TROVATO!
- giuseppe@server.com (bloccato) ✅ TROVATO!

Risultato: 5 conversazioni trovate (non solo 2!)
```

### 3. Paginazione Garantisce Completezza

Con RSM (Result Set Management), puoi recuperare TUTTE le pagine:

```typescript
async function loadAllConversations(client: Agent): Promise<Conversation[]> {
  let allConversations = new Map<string, Conversation>()
  let hasMore = true
  let lastToken: string | undefined
  
  while (hasMore) {
    const result = await client.searchHistory({
      paging: {
        max: 100,
        after: lastToken  // Token pagina precedente
      }
    })
    
    // Raggruppa questa pagina
    const pageConversations = groupMessagesByContact(result.results || [], client.jid)
    
    // Merge con conversazioni esistenti
    for (const [jid, messages] of pageConversations.entries()) {
      const existing = allConversations.get(jid)
      const lastMsg = getLastMessage(messages)
      
      if (!existing || lastMsg.timestamp > existing.lastMessage.timestamp) {
        allConversations.set(jid, {
          jid,
          lastMessage: lastMsg
        })
      }
    }
    
    // Controlla se ci sono altre pagine
    hasMore = result.paging?.last !== undefined && result.complete !== true
    lastToken = result.paging?.last
  }
  
  return Array.from(allConversations.values())
}
```

---

## Confronto: Strategia A vs Strategia B

### Strategia A (MAM Globale) - TROVA TUTTO

```
Query MAM globale → 
Raggruppa per JID → 
Trova TUTTE le conversazioni storiche:
  ✅ Contatti nel roster
  ✅ Contatti rimossi dal roster
  ✅ Contatti mai aggiunti (ma con messaggi)
  ✅ Contatti bloccati
```

**Risultato**: Lista COMPLETA di tutte le conversazioni storiche

### Strategia B (Roster + MAM) - TROVA SOLO ROSTER

```
Query Roster → 
Per ogni contatto nel roster → 
Query MAM per quel contatto → 
Trova solo conversazioni con contatti nel roster:
  ✅ Contatti nel roster
  ❌ Contatti rimossi (non nel roster = non cercati)
  ❌ Contatti mai aggiunti (non nel roster = non cercati)
```

**Risultato**: Lista PARZIALE (solo contatti nel roster)

---

## Esempio Concreto

### Scenario
- Roster attuale: `['mario@server.com', 'luigi@server.com']`
- MAM contiene messaggi con: `mario`, `luigi`, `paolo`, `anna`, `giuseppe`

### Strategia A (MAM Globale)

```typescript
// Query MAM globale
const result = await client.searchHistory({ paging: { max: 1000 } })

// Raggruppa
const groups = groupMessagesByContact(result.results, 'io@server.com')

// Risultato: 5 conversazioni trovate
[
  'mario@server.com',    // ✅ Nel roster
  'luigi@server.com',    // ✅ Nel roster
  'paolo@server.com',    // ✅ Trovato! (era nel roster 2 anni fa)
  'anna@server.com',     // ✅ Trovato! (mai aggiunto, ma ha scritto)
  'giuseppe@server.com'  // ✅ Trovato! (bloccato ma con storico)
]
```

### Strategia B (Roster + MAM)

```typescript
// Query Roster
const roster = await client.getRoster()
// roster.items = ['mario@server.com', 'luigi@server.com']

// Query MAM per ogni contatto
for (const contact of roster.items) {
  const lastMsg = await client.searchHistory({ with: contact.jid, paging: { max: 1 } })
  // ...
}

// Risultato: 2 conversazioni trovate
[
  'mario@server.com',    // ✅ Nel roster
  'luigi@server.com'    // ✅ Nel roster
  // ❌ paolo, anna, giuseppe NON cercati (non nel roster)
]
```

---

## Vantaggio Chiave della Strategia A

**Trova conversazioni che altrimenti perderesti:**

1. **Contatti rimossi**: Hai rimosso qualcuno dal roster ma vuoi ancora vedere la conversazione storica
2. **Contatti mai aggiunti**: Qualcuno ti ha scritto ma non l'hai mai aggiunto al roster
3. **Contatti bloccati**: Hai bloccato qualcuno ma vuoi vedere lo storico
4. **Conversazioni vecchie**: Anche se molto vecchie, vengono trovate

---

## Opzionale: Filtro per Roster (Se Desiderato)

Se vuoi MOSTRARE solo contatti nel roster (ma comunque trovare tutto), puoi filtrare dopo:

```typescript
// 1. Trova TUTTE le conversazioni (Strategia A)
const allConversations = await loadAllConversations(client)

// 2. Ottieni roster
const roster = await client.getRoster()
const rosterJids = new Set(roster.items.map(item => item.jid))

// 3. Filtra (opzionale)
const filteredConversations = allConversations.filter(conv => 
  rosterJids.has(conv.jid)
)

// Oppure: mostra tutto ma evidenzia quelli nel roster
const enrichedConversations = allConversations.map(conv => ({
  ...conv,
  inRoster: rosterJids.has(conv.jid),
  displayName: roster.items.find(item => item.jid === conv.jid)?.name
}))
```

---

## Implementazione Completa

```typescript
interface Conversation {
  jid: string
  displayName?: string        // Dal roster (se presente)
  inRoster: boolean          // Se è nel roster attuale
  lastMessage: {
    body: string
    timestamp: Date
    from: 'me' | 'them'
    messageId: string
  }
}

async function loadConversationsWithRoster(client: Agent): Promise<Conversation[]> {
  // 1. Carica roster (per nomi e filtri)
  const rosterResult = await client.getRoster()
  const rosterMap = new Map(
    rosterResult.roster.items.map(item => [item.jid, item])
  )
  
  // 2. Query MAM globale (trova TUTTO)
  const mamResult = await client.searchHistory({
    paging: { max: 100 }
  })
  
  // 3. Raggruppa per contatto
  const groups = groupMessagesByContact(mamResult.results || [], client.jid)
  
  // 4. Converti in conversazioni
  const conversations: Conversation[] = []
  
  for (const [contactJid, messages] of groups.entries()) {
    const lastMessage = getLastMessage(messages)
    const rosterItem = rosterMap.get(contactJid)
    
    conversations.push({
      jid: contactJid,
      displayName: rosterItem?.name,      // Nome dal roster (se presente)
      inRoster: !!rosterItem,             // Se è nel roster
      lastMessage: {
        body: extractMessageBody(lastMessage),
        timestamp: extractTimestamp(lastMessage),
        from: extractSender(lastMessage, client.jid),
        messageId: lastMessage.id
      }
    })
  }
  
  // 5. Ordina per timestamp (più recenti prima)
  return conversations.sort((a, b) => 
    b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
  )
}
```

---

## Conclusione

**La strategia MAM globale TROVA TUTTE le conversazioni storiche perché:**

1. ✅ MAM archivia TUTTI i messaggi (indipendentemente dal roster)
2. ✅ Il raggruppamento per JID trova TUTTI i contatti con messaggi
3. ✅ La paginazione garantisce completezza
4. ✅ Trova anche contatti rimossi, bloccati, o mai aggiunti

**È più completa della strategia B che trova solo contatti nel roster.**

Se vuoi filtrare per roster, puoi farlo DOPO aver trovato tutto, mantenendo la flessibilità di mostrare anche conversazioni storiche con contatti non più nel roster.
