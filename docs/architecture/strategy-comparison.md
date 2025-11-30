# Confronto Strategie: MAM Globale vs Roster + MAM per Contatto

## Strategia A: Query MAM Globale + Raggruppamento (Proposta Iniziale)

### Come Funziona
1. Una singola query MAM senza filtro `with`
2. Il server restituisce tutti i messaggi archiviati (paginated)
3. Raggruppa messaggi per contatto lato client
4. Estrae ultimo messaggio per ogni contatto
5. Ordina e mostra

### Vantaggi ✅
- **Performance**: Una sola query invece di N query
- **Velocità**: Più veloce per account con molti contatti
- **Efficienza rete**: Meno round-trip al server
- **Paginazione semplice**: Un solo punto di paginazione
- **Scalabilità**: Funziona bene anche con 100+ contatti

### Svantaggi ❌
- **Memoria**: Deve processare molti messaggi in memoria
- **Complessità logica**: Raggruppamento e ordinamento lato client
- **Overfetching**: Potrebbe scaricare messaggi di contatti non più nel roster
- **Duplicati**: Potrebbero esserci conversazioni con contatti rimossi dal roster

---

## Strategia B: Roster + Query MAM per Contatto (Alternativa)

### Come Funziona
1. Scarica lista completa contatti (roster)
2. Per ogni contatto nel roster:
   - Query MAM con filtro `with=contact@server.com`
   - Limite: 1 messaggio (l'ultimo)
   - Se presente → aggiungi alla lista
   - Se assente → scarta contatto
3. Ordina per timestamp ultimo messaggio
4. Mostra lista

### Vantaggi ✅

#### 1. **Precisione**
- ✅ Mostra SOLO contatti presenti nel roster
- ✅ Nessun contatto "fantasma" (rimosso ma con messaggi vecchi)
- ✅ Lista pulita e accurata

#### 2. **Semplicità Logica**
- ✅ Logica più lineare: per ogni contatto → ultimo messaggio
- ✅ Meno elaborazione lato client
- ✅ Più facile da debuggare

#### 3. **Dati Contatto Disponibili**
- ✅ Nome visualizzato già disponibile dal roster
- ✅ Gruppi/etichette già disponibili
- ✅ Stato subscription già noto

#### 4. **Flessibilità**
- ✅ Puoi filtrare contatti per gruppo prima di fare query
- ✅ Puoi ordinare roster prima di processare
- ✅ Più controllo su quali contatti includere

#### 5. **Memoria Efficiente**
- ✅ Processa un contatto alla volta
- ✅ Non carica tutti i messaggi in memoria
- ✅ Meno overhead per account grandi

### Svantaggi ❌

#### 1. **Performance - N Query al Server**
- ❌ Se hai 50 contatti → 50 query MAM separate
- ❌ Ogni query ha overhead (handshake, parsing, etc.)
- ❌ Più lento per account con molti contatti

**Esempio:**
```
Roster: 50 contatti
Query MAM: 50 query separate
Tempo stimato: 50 × 200ms = 10 secondi (sequenziale)
Tempo parallelo: ~2-3 secondi (con Promise.all, ma stressa il server)
```

#### 2. **Rate Limiting**
- ❌ Alcuni server XMPP limitano rate di query
- ❌ Troppe query rapide potrebbero causare throttling
- ❌ Rischio di essere temporaneamente bloccati

#### 3. **Complessità Paginazione**
- ❌ Paginazione più complessa: devi tracciare quali contatti hai già processato
- ❌ Non puoi usare RSM semplice perché ogni query è separata
- ❌ Devi implementare paginazione custom

**Esempio Paginazione:**
```typescript
// Prima pagina: contatti 0-19
const page1 = await Promise.all(
  roster.slice(0, 20).map(contact => 
    getLastMessage(contact.jid)
  )
)

// Pagina 2: contatti 20-39
const page2 = await Promise.all(
  roster.slice(20, 40).map(contact => 
    getLastMessage(contact.jid)
  )
)
```

#### 4. **Latenza Totale**
- ❌ Anche con parallelizzazione, latenza totale è maggiore
- ❌ Utente vede loading più lungo
- ❌ Esperienza utente peggiore

#### 5. **Carico sul Server**
- ❌ Più query = più carico sul server
- ❌ Meno efficiente per il server XMPP
- ❌ Potrebbe impattare altri utenti

#### 6. **Gestione Errori Complessa**
- ❌ Se una query fallisce, cosa fai?
  - Skip quel contatto?
  - Retry?
  - Mostra errore globale?
- ❌ Gestione parziale successi più complessa

#### 7. **Real-time Updates Più Complessi**
- ❌ Quando arriva nuovo messaggio, devi:
  - Verificare se contatto è nel roster
  - Aggiornare solo quella conversazione
  - Gestire contatti non ancora caricati

---

## Confronto Diretto

| Aspetto | Strategia A (MAM Globale) | Strategia B (Roster + MAM per Contatto) |
|---------|---------------------------|------------------------------------------|
| **Numero Query** | 1 query | N query (una per contatto) |
| **Velocità** | ⚡⚡⚡ Veloce | ⚡⚡ Più lenta |
| **Precisione** | ⚠️ Potrebbe includere contatti rimossi | ✅ Solo contatti nel roster |
| **Memoria** | ⚠️ Più memoria (tutti messaggi) | ✅ Meno memoria (un contatto alla volta) |
| **Complessità Codice** | ⚠️ Raggruppamento complesso | ✅ Logica lineare |
| **Paginazione** | ✅ RSM nativo semplice | ⚠️ Paginazione custom complessa |
| **Carico Server** | ✅ Basso (1 query) | ❌ Alto (N query) |
| **Rate Limiting** | ✅ Nessun rischio | ❌ Rischio throttling |
| **Scalabilità** | ✅ Scala bene | ⚠️ Problemi con molti contatti |
| **Dati Contatto** | ⚠️ Deve fare query roster separata | ✅ Già disponibili dal roster |
| **Lazy Loading** | ✅ Facile (RSM token) | ⚠️ Più complesso (slice roster) |

---

## Analisi Performance Dettagliata

### Scenario: Account con 50 contatti

#### Strategia A (MAM Globale)
```
1. Query MAM globale: ~500ms
2. Raggruppamento: ~50ms
3. Ordinamento: ~10ms
TOTALE: ~560ms
```

#### Strategia B (Roster + MAM per Contatto)

**Sequenziale:**
```
1. Query Roster: ~200ms
2. Query MAM × 50: 50 × 200ms = 10,000ms
TOTALE: ~10,200ms (18x più lento!)
```

**Parallelo (Promise.all):**
```
1. Query Roster: ~200ms
2. Query MAM × 50 (parallelo): ~500-1000ms
   (dipende da rate limiting server)
TOTALE: ~700-1200ms (comunque più lento)
```

**Parallelo Batch (5 alla volta):**
```
1. Query Roster: ~200ms
2. Batch 1 (5 contatti): ~300ms
3. Batch 2 (5 contatti): ~300ms
... (10 batch totali)
TOTALE: ~200 + (10 × 300) = ~3200ms (6x più lento)
```

### Scenario: Account con 200 contatti

#### Strategia A
```
Query MAM: ~800ms (più messaggi = più tempo)
Raggruppamento: ~200ms
TOTALE: ~1000ms
```

#### Strategia B (Parallelo)
```
Query Roster: ~200ms
Query MAM × 200 (parallelo): ~2000-5000ms
  (rate limiting diventa problema serio)
TOTALE: ~2200-5200ms (2-5x più lento)
```

---

## Considerazioni Specifiche per conversations.im

### Supporto MAM
- ✅ conversations.im supporta MAM v2
- ✅ Rate limiting: moderato (non aggressivo)
- ✅ Performance: buona per query singole

### Comportamento Atteso
- Query MAM globale: supportata e veloce
- Query MAM multiple parallele: potrebbe avere throttling dopo ~20-30 query
- Roster: sempre disponibile e veloce

---

## Strategia Ibrida (Migliore dei Due Mondi?)

### Approccio Ibrido Ottimizzato

```typescript
1. Scarica Roster (lista contatti)
2. Query MAM globale con filtro:
   - Filtra solo messaggi con contatti presenti nel roster
   - Oppure: query globale + filtraggio lato client
3. Per ogni messaggio MAM:
   - Verifica se il contatto è nel roster
   - Se sì → include nella lista
   - Se no → scarta
4. Raggruppa per contatto
5. Estrai ultimo messaggio
```

**Vantaggi:**
- ✅ Precisione (solo contatti nel roster)
- ✅ Performance (una query MAM)
- ✅ Dati contatto disponibili (dal roster)

**Svantaggi:**
- ⚠️ Complessità intermedia
- ⚠️ Overfetching minimo (ma poi filtrato)

---

## Raccomandazione Finale

### Per Account Piccoli (< 20 contatti)
**Strategia B (Roster + MAM per Contatto)** è accettabile:
- Differenza performance minima
- Logica più semplice
- Precisione migliore

### Per Account Medi (20-50 contatti)
**Strategia Ibrida** è ideale:
- Bilanciamento tra performance e precisione
- Migliore esperienza utente

### Per Account Grandi (> 50 contatti)
**Strategia A (MAM Globale)** è necessaria:
- Performance critica
- Strategia B diventa troppo lenta
- Rate limiting diventa problema

### Per conversations.im Specificamente
**Strategia Ibrida** raccomandata:
- conversations.im ha buon supporto MAM
- Rate limiting moderato
- Utenti tipicamente hanno 10-30 contatti
- Bilanciamento ottimale

---

## Implementazione Strategia B (Se Scelta)

### Ottimizzazioni Possibili

1. **Batch Processing**
```typescript
const BATCH_SIZE = 10
const batches = chunkArray(roster, BATCH_SIZE)

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(contact => getLastMessage(contact.jid))
  )
  // Processa risultati
  await delay(100) // Evita rate limiting
}
```

2. **Caching**
```typescript
// Cache ultimi messaggi per evitare query ripetute
const cache = new Map<string, Message>()

async function getLastMessageCached(jid: string) {
  if (cache.has(jid)) {
    return cache.get(jid)
  }
  const msg = await getLastMessage(jid)
  cache.set(jid, msg)
  return msg
}
```

3. **Prioritizzazione**
```typescript
// Carica prima contatti più importanti
const sortedRoster = roster.sort((a, b) => {
  // Priorità: subscription === 'both' > 'to' > 'from'
  // Poi per nome alfabetico
})
```

4. **Lazy Loading Intelligente**
```typescript
// Carica prima pagina immediatamente
const firstPage = await loadFirstPage(roster.slice(0, 20))

// Carica resto in background
loadRemainingPages(roster.slice(20))
```

---

## Conclusione

**Strategia B ha senso se:**
- ✅ Hai pochi contatti (< 20)
- ✅ Preferisci precisione su performance
- ✅ Vuoi logica più semplice
- ✅ Non ti interessa velocità iniziale

**Strategia A è migliore se:**
- ✅ Hai molti contatti (> 20)
- ✅ Performance è critica
- ✅ Vuoi esperienza utente fluida
- ✅ Accetti piccola imprecisione (contatti rimossi)

**Strategia Ibrida è il compromesso migliore:**
- ✅ Bilanciamento ottimale
- ✅ Precisione + Performance
- ✅ Scalabile
- ✅ Raccomandata per la maggior parte dei casi
