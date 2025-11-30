# Analisi Performance Strategia MAM Globale nel Lungo Termine

## Scenario di Crescita

### Crescita Tipica di un Account XMPP

**Anno 1:**
- Messaggi archiviati: ~5,000
- Contatti: ~20
- Conversazioni attive: ~15

**Anno 2:**
- Messaggi archiviati: ~15,000
- Contatti: ~35
- Conversazioni attive: ~25

**Anno 5:**
- Messaggi archiviati: ~50,000+
- Contatti: ~80
- Conversazioni attive: ~40

**Anno 10:**
- Messaggi archiviati: ~150,000+
- Contatti: ~150
- Conversazioni attive: ~60

---

## Analisi Performance Strategia A (MAM Globale)

### Problema: Crescita Lineare dei Dati

#### Query MAM Globale - Prima Pagina

**Anno 1 (5,000 messaggi):**
```
Query MAM: max=100 messaggi
Tempo query: ~300ms
Dimensione risposta: ~50KB
Raggruppamento: ~20ms
TOTALE: ~320ms ✅ Ottimo
```

**Anno 5 (50,000 messaggi):**
```
Query MAM: max=100 messaggi
Tempo query: ~500ms (server deve cercare tra più messaggi)
Dimensione risposta: ~50KB
Raggruppamento: ~20ms
TOTALE: ~520ms ✅ Ancora accettabile
```

**Anno 10 (150,000 messaggi):**
```
Query MAM: max=100 messaggi
Tempo query: ~800-1200ms (ricerca più lenta)
Dimensione risposta: ~50KB
Raggruppamento: ~20ms
TOTALE: ~820-1220ms ⚠️ Inizia a essere lento
```

### Problema Reale: Paginazione Completa

Se vuoi TUTTE le conversazioni, devi paginare:

**Anno 1 (5,000 messaggi, ~15 conversazioni):**
```
Pagina 1: 100 messaggi → ~15 conversazioni → ✅ Fatto!
TOTALE: 1 query, ~320ms ✅
```

**Anno 5 (50,000 messaggi, ~40 conversazioni):**
```
Pagina 1: 100 messaggi → ~25 conversazioni
Pagina 2: 100 messaggi → ~10 conversazioni
Pagina 3: 100 messaggi → ~5 conversazioni
TOTALE: 3 query, ~1560ms ⚠️ Più lento
```

**Anno 10 (150,000 messaggi, ~60 conversazioni):**
```
Pagina 1-5: 500 messaggi → ~60 conversazioni
TOTALE: 5 query, ~4000-6000ms ❌ Lento!
```

---

## Problemi Identificati

### 1. Query MAM Diventa Più Lenta

**Perché:**
- Il server deve cercare tra sempre più messaggi
- L'indice del database cresce
- Il parsing della risposta XML diventa più pesante

**Impatto:**
- Query singola: da 300ms → 1200ms (4x più lenta)
- Paginazione completa: da 320ms → 6000ms (18x più lenta)

### 2. Overfetching di Messaggi

**Problema:**
- Per trovare 60 conversazioni, devi scaricare 500+ messaggi
- La maggior parte dei messaggi sono di conversazioni già trovate
- Spreco di banda e memoria

**Esempio:**
```
Conversazioni trovate: 60
Messaggi scaricati: 500
Messaggi utili: ~60 (uno per conversazione)
Efficienza: 12% ❌
```

### 3. Memoria Client

**Problema:**
- Tutti i messaggi scaricati vengono tenuti in memoria durante il raggruppamento
- Con 500 messaggi: ~500KB-1MB di memoria
- Con 5000 messaggi: ~5-10MB di memoria

### 4. Latenza Percepita dall'Utente

**Problema:**
- Utente vede loading per 1-6 secondi
- Esperienza peggiore con il tempo
- Potrebbe sembrare che l'app sia "rotta"

---

## Strategie di Ottimizzazione

### Strategia 1: Query MAM Intelligente con Filtri Temporali

**Idea:** Invece di scaricare tutto, scarica solo messaggi recenti inizialmente.

```typescript
// Prima pagina: solo ultimi 30 giorni
const recentConversations = await client.searchHistory({
  end: new Date(),
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 giorni fa
  paging: { max: 100 }
})

// Se utente scrolla molto, carica più vecchio
const olderConversations = await client.searchHistory({
  end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 30-90 giorni fa
  paging: { max: 100 }
})
```

**Vantaggi:**
- ✅ Query più veloce (meno messaggi da cercare)
- ✅ Meno dati scaricati
- ✅ Esperienza più veloce per utente

**Svantaggi:**
- ⚠️ Non trova conversazioni molto vecchie inizialmente
- ⚠️ Logica più complessa

**Performance:**
```
Anno 10 - Ultimi 30 giorni:
Messaggi: ~3,000 (invece di 150,000)
Query: ~400ms (invece di 1200ms) ✅ 3x più veloce!
```

### Strategia 2: Caching Aggressivo

**Idea:** Cache le conversazioni già caricate e aggiorna solo incrementalmente.

```typescript
interface CachedConversations {
  conversations: Conversation[]
  lastUpdate: Date
  lastRSMToken?: string
  version: number
}

// Cache in localStorage o IndexedDB
const cache = loadFromCache()

if (cache && isCacheValid(cache, maxAge = 5 * 60 * 1000)) {
  // Usa cache se valida (< 5 minuti)
  return cache.conversations
}

// Altrimenti, carica solo nuovi messaggi
const newMessages = await client.searchHistory({
  paging: {
    max: 100,
    after: cache?.lastRSMToken  // Solo messaggi dopo ultima cache
  }
})

// Merge con cache
const updated = mergeConversations(cache.conversations, newMessages)
saveToCache(updated)
```

**Vantaggi:**
- ✅ Caricamento istantaneo dopo primo load
- ✅ Aggiornamenti incrementali veloci
- ✅ Meno carico sul server

**Svantaggi:**
- ⚠️ Complessità gestione cache
- ⚠️ Possibili inconsistenze se cache corrotto

**Performance:**
```
Primo load: ~1200ms
Load successivi: ~50ms (da cache) ✅ 24x più veloce!
Aggiornamenti incrementali: ~200ms ✅
```

### Strategia 3: Lazy Loading Intelligente

**Idea:** Carica solo conversazioni visibili + buffer, non tutto.

```typescript
// Carica solo prime 20 conversazioni inizialmente
const firstPage = await client.searchHistory({
  paging: { max: 50 }  // Solo 50 messaggi per trovare ~20 conversazioni
})

// Quando utente scrolla, carica pagina successiva
const loadMore = async () => {
  const nextPage = await client.searchHistory({
    paging: {
      max: 50,
      after: lastRSMToken
    }
  })
  // Merge con lista esistente
}
```

**Vantaggi:**
- ✅ Caricamento iniziale veloce
- ✅ Carica solo quando necessario
- ✅ Esperienza fluida

**Svantaggi:**
- ⚠️ Non ha tutte le conversazioni subito
- ⚠️ Paginazione più complessa

**Performance:**
```
Primo load: ~400ms (solo 50 messaggi) ✅
Load più: ~400ms per pagina ✅
Totale per tutte: ~2400ms (ma distribuito) ✅
```

### Strategia 4: Query MAM per Contatto (Ibrida Ottimizzata)

**Idea:** Usa roster per limitare query MAM solo a contatti attivi.

```typescript
// 1. Carica roster (veloce, ~200ms)
const roster = await client.getRoster()

// 2. Filtra solo contatti con subscription 'both' o 'to' (attivi)
const activeContacts = roster.items.filter(item => 
  item.subscription === 'both' || item.subscription === 'to'
)

// 3. Query MAM parallela per contatti attivi (batch di 10)
const batches = chunkArray(activeContacts, 10)
const conversations = []

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(contact => 
      client.searchHistory({
        with: contact.jid,
        paging: { max: 1 }  // Solo ultimo messaggio!
      })
    )
  )
  
  conversations.push(...results.map(r => extractConversation(r)))
  await delay(100)  // Evita rate limiting
}
```

**Vantaggi:**
- ✅ Query mirate (solo ultimo messaggio per contatto)
- ✅ Meno dati scaricati
- ✅ Più veloce per contatti attivi

**Svantaggi:**
- ⚠️ Non trova contatti rimossi
- ⚠️ Più query (ma ottimizzate)

**Performance:**
```
40 contatti attivi:
Roster: ~200ms
Query MAM × 40 (batch 10): ~800ms
TOTALE: ~1000ms ✅

Vs MAM globale: ~1200ms
Risparmio: ~200ms + più preciso ✅
```

### Strategia 5: Background Sync + Cache

**Idea:** Sync in background, mostra cache immediatamente.

```typescript
// 1. Mostra cache immediatamente (se disponibile)
const cached = loadFromCache()
if (cached) {
  displayConversations(cached)  // Istantaneo!
}

// 2. Sync in background
syncConversationsInBackground().then(updated => {
  displayConversations(updated)  // Aggiorna quando pronto
})

async function syncConversationsInBackground() {
  // Query MAM incrementale (solo nuovi messaggi)
  const newMessages = await client.searchHistory({
    paging: {
      max: 100,
      after: cache?.lastRSMToken
    }
  })
  
  // Merge con cache
  return mergeAndUpdate(cache, newMessages)
}
```

**Vantaggi:**
- ✅ UI reattiva (mostra cache subito)
- ✅ Aggiornamenti in background
- ✅ Esperienza fluida

**Svantaggi:**
- ⚠️ Complessità gestione sync
- ⚠️ Possibili race conditions

**Performance:**
```
Display iniziale: ~0ms (da cache) ✅
Sync background: ~200-400ms (incrementale) ✅
```

---

## Confronto Strategie nel Lungo Termine

| Strategia | Anno 1 | Anno 5 | Anno 10 | Scalabilità |
|-----------|--------|--------|---------|-------------|
| **MAM Globale (base)** | 320ms ✅ | 1560ms ⚠️ | 6000ms ❌ | ❌ Non scala |
| **MAM + Filtro Temporale** | 320ms ✅ | 800ms ✅ | 1200ms ⚠️ | ✅ Scala bene |
| **MAM + Cache** | 320ms ✅ | 50ms ✅ | 50ms ✅ | ✅ Scala perfettamente |
| **MAM + Lazy Loading** | 400ms ✅ | 400ms ✅ | 400ms ✅ | ✅ Scala perfettamente |
| **Roster + MAM (ibrida)** | 1000ms ⚠️ | 2000ms ⚠️ | 4000ms ❌ | ❌ Non scala |

---

## Raccomandazione: Strategia Combinata

### Approccio Ottimale per Lungo Termine

```typescript
1. **Cache Locale** (IndexedDB)
   - Salva conversazioni caricate
   - Versioning per invalidazione
   - TTL: 5 minuti per refresh

2. **Lazy Loading Intelligente**
   - Carica solo prime 20 conversazioni inizialmente
   - Scroll → carica pagina successiva
   - Buffer: sempre 2-3 pagine avanti

3. **Filtro Temporale Opzionale**
   - Default: ultimi 90 giorni
   - Opzione "Mostra tutto" per utenti avanzati
   - Query più veloce per la maggior parte degli utenti

4. **Background Sync**
   - Sync incrementale ogni 5 minuti
   - Aggiorna solo nuove conversazioni
   - Notifica utente se nuove conversazioni

5. **Virtualizzazione Lista**
   - Renderizza solo elementi visibili
   - Usa react-window o react-virtualized
   - Gestisce migliaia di conversazioni senza lag
```

### Performance Attesa

**Primo Load (Anno 10):**
```
Cache hit: ~0ms ✅
Cache miss: ~400ms (lazy loading) ✅
```

**Scroll (Anno 10):**
```
Pagina successiva: ~400ms ✅
Smooth scrolling: 60fps ✅
```

**Background Sync:**
```
Incrementale: ~200ms ogni 5 minuti ✅
Non blocca UI ✅
```

---

## Implementazione Pratica

### Struttura Cache

```typescript
interface ConversationCache {
  conversations: Conversation[]
  lastRSMToken?: string
  lastUpdate: Date
  version: number
  totalCount?: number  // Totale conversazioni (se disponibile)
}

// IndexedDB per persistenza
class ConversationCacheManager {
  async load(): Promise<ConversationCache | null> {
    // Carica da IndexedDB
  }
  
  async save(cache: ConversationCache): Promise<void> {
    // Salva in IndexedDB
  }
  
  async invalidate(): Promise<void> {
    // Invalida cache
  }
  
  isStale(cache: ConversationCache, maxAge = 5 * 60 * 1000): boolean {
    return Date.now() - cache.lastUpdate.getTime() > maxAge
  }
}
```

### Query Ottimizzata

```typescript
async function loadConversationsOptimized(
  client: Agent,
  options: {
    useCache: boolean = true
    maxAge: number = 5 * 60 * 1000
    limit: number = 20
    timeRange?: { start: Date; end: Date }
  }
): Promise<Conversation[]> {
  
  // 1. Prova cache
  if (options.useCache) {
    const cache = await cacheManager.load()
    if (cache && !cacheManager.isStale(cache, options.maxAge)) {
      return cache.conversations.slice(0, options.limit)
    }
  }
  
  // 2. Query MAM ottimizzata
  const mamOptions: any = {
    paging: { max: 50 }  // Solo 50 messaggi per trovare ~20 conversazioni
  }
  
  if (options.timeRange) {
    mamOptions.start = options.timeRange.start
    mamOptions.end = options.timeRange.end
  }
  
  const result = await client.searchHistory(mamOptions)
  
  // 3. Raggruppa e converti
  const conversations = groupAndConvert(result.results, client.jid)
  
  // 4. Salva in cache
  await cacheManager.save({
    conversations,
    lastRSMToken: result.paging?.last,
    lastUpdate: new Date(),
    version: 1
  })
  
  return conversations.slice(0, options.limit)
}
```

---

## Conclusione

### La Strategia MAM Globale BASE diventa pesante nel tempo:
- ❌ Query più lente (300ms → 1200ms)
- ❌ Paginazione completa lenta (320ms → 6000ms)
- ❌ Overfetching di messaggi
- ❌ Memoria crescente

### Ma con Ottimizzazioni diventa Scalabile:
- ✅ Cache locale: load istantaneo dopo primo accesso
- ✅ Lazy loading: carica solo quando necessario
- ✅ Filtro temporale: query più veloce
- ✅ Background sync: aggiornamenti incrementali
- ✅ Virtualizzazione: gestisce migliaia di elementi

### Performance Finale (con ottimizzazioni):
- **Primo load**: ~400ms (anche con 150k messaggi)
- **Load successivi**: ~0ms (da cache)
- **Scroll**: ~400ms per pagina (smooth)
- **Scalabilità**: ✅ Funziona anche con milioni di messaggi

**Raccomandazione**: Implementa strategia combinata (cache + lazy loading + filtro temporale) per garantire performance costanti nel tempo.
