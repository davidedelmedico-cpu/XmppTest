# Piano di Refactoring Dettagliato

## Data
30 Novembre 2025

## Overview

Dopo l'analisi dei file esistenti, ho scoperto che molto codice è già presente. Il refactoring sarà un'**estensione** piuttosto che una riscrittura completa.

## File Esistenti - Stato Attuale

### ✅ Già Presenti e Utilizzabili

1. **`services/vcard.ts`**
   - ✅ `getVCard(client, jid, forceRefresh)` - Singolo vCard
   - ✅ `getVCardsForJids(client, jids[], forceRefresh)` - Batch vCard con parallelismo
   - ✅ `fetchVCardFromServer()` - Download e salvataggio vCard
   - ✅ Integrazione con database `vcards`
   - **Conclusione**: **NESSUNA MODIFICA NECESSARIA** ✅

2. **`services/messages.ts`**
   - ✅ `loadMessagesForContact(client, jid, options)` - Carica messaggi per contatto specifico
   - ✅ `downloadAllMessagesFromServer(client, jid)` - Download tutti i messaggi
   - ✅ `reloadAllMessagesFromServer(client, jid)` - Scarica → Svuota → Salva
   - ✅ `saveMessages()` integrato
   - **Conclusione**: **NESSUNA MODIFICA NECESSARIA** ✅

3. **`services/sync.ts`**
   - ⚠️ Esiste ma con funzionalità parziali
   - ✅ `syncConversation(jid)` - Sincronizza una conversazione (svuota + ricarica messaggi)
   - ✅ `syncAllConversations()` - Sincronizza tutte le conversazioni
   - ❌ **NON** sincronizza i messaggi di tutte le conversazioni (solo la lista)
   - ❌ **NON** sincronizza i vCard
   - **Conclusione**: **ESTENSIONE NECESSARIA** ⚠️

4. **`services/conversations.ts`**
   - ✅ `loadConversationsFromServer()` - Carica conversazioni dal server
   - ✅ `downloadAllConversations()` - Scarica tutte le conversazioni
   - ❌ **NON** salva i messaggi durante lo scaricamento (solo ultimo messaggio per conversazione)
   - **Conclusione**: **MODIFICHE NECESSARIE** ⚠️

5. **`services/conversations-db.ts`**
   - ✅ Store `conversations`, `messages`, `vcards` già presenti
   - ✅ Tutte le funzioni CRUD necessarie
   - **Conclusione**: **NESSUNA MODIFICA NECESSARIA** ✅

## Piano di Refactoring

### Step 1: Estendere `services/sync.ts` ⚠️

**Obiettivo**: Aggiungere funzioni per sincronizzazione completa (messaggi + vCard)

**Nuove funzioni da aggiungere:**

```typescript
/**
 * Sincronizza TUTTO: tutte le conversazioni, tutti i messaggi, tutti i vCard
 * Usato nel pull-to-refresh della LISTA conversazioni
 */
export async function syncAllConversationsComplete(client: Agent): Promise<SyncResult>

/**
 * Sincronizza una singola conversazione completa (messaggi + vCard)
 * Usato nel pull-to-refresh di una CHAT specifica
 */
export async function syncSingleConversationComplete(
  client: Agent,
  contactJid: string
): Promise<SyncResult>
```

**Dettagli implementazione:**

1. **`syncAllConversationsComplete()`**:
   ```typescript
   - Chiama downloadAllConversations() per ottenere lista conversazioni
   - Estrae tutti i JID delle conversazioni
   - Per ogni conversazione:
     - Scarica tutti i messaggi dal server
     - Salva nel database messages
   - Scarica tutti i vCard in batch (getVCardsForJids con forceRefresh=true)
   - Aggiorna conversazioni con dati vCard (displayName, avatar)
   - Salva tutto nel database
   ```

2. **`syncSingleConversationComplete()`**:
   ```typescript
   - Chiama reloadAllMessagesFromServer(jid) per scaricare tutti i messaggi
   - Salva nel database messages (già fatto da reloadAllMessagesFromServer)
   - Scarica vCard del contatto (getVCard con forceRefresh=true)
   - Aggiorna conversazione con dati vCard
   ```

**File da modificare**: `/workspace/web-client/src/services/sync.ts`

---

### Step 2: Modificare `services/conversations.ts` ⚠️

**Obiettivo**: Permettere salvataggio messaggi durante caricamento conversazioni

**Opzione A - Parametro Opzionale (Raccomandato):**

```typescript
export async function loadConversationsFromServer(
  client: Agent,
  options: {
    startDate?: Date
    endDate?: Date
    maxResults?: number
    afterToken?: string
    saveMessages?: boolean  // NUOVO PARAMETRO (default: false)
  } = {}
): Promise<{ conversations: Conversation[]; nextToken?: string; complete: boolean }>
```

**Modifiche:**
1. Aggiungere parametro `saveMessages` (default `false` per backward compatibility)
2. Se `saveMessages === true`:
   - Convertire tutti i `MAMResult[]` in `Message[]`
   - Chiamare `saveMessages(messages)` dal database
3. Continuare con la logica esistente (raggruppamento per conversazione)

**Opzione B - Nuova Funzione (Alternativa):**

Creare nuova funzione `loadConversationsAndMessagesFromServer()` che:
- Fa tutto quello che fa `loadConversationsFromServer()`
- Più salva tutti i messaggi nel database

**Raccomandazione**: **Opzione A** per mantenere compatibilità e ridurre duplicazione codice

**File da modificare**: `/workspace/web-client/src/services/conversations.ts`

---

### Step 3: Aggiornare `contexts/XmppContext.tsx` ⚠️

**Obiettivo**: Esporre nuove funzioni di sincronizzazione nel context

**Modifiche all'interfaccia:**

```typescript
interface XmppContextType {
  // ... esistente ...
  
  // MODIFICATO: rinominato per chiarezza
  refreshAllConversations: () => Promise<void>  // era refreshConversations
  
  // NUOVO: sincronizza una singola conversazione
  refreshSingleConversation: (jid: string) => Promise<void>
}
```

**Implementazione:**

1. **`refreshAllConversations()`** (rinomina di `refreshConversations`):
   ```typescript
   const refreshAllConversations = async () => {
     if (!client || !isConnected) return
     setIsLoading(true)
     try {
       await syncAllConversationsComplete(client)
       const updated = await getConversations()
       setConversations(updated)
     } catch (err) {
       console.error('Errore nel refresh completo:', err)
       setError(err instanceof Error ? err.message : 'Errore nel refresh')
     } finally {
       setIsLoading(false)
     }
   }
   ```

2. **`refreshSingleConversation(jid)`** (nuovo):
   ```typescript
   const refreshSingleConversation = useCallback(async (jid: string) => {
     if (!client || !isConnected) return
     try {
       await syncSingleConversationComplete(client, jid)
       // Aggiorna lista conversazioni (la conversazione modificata sarà aggiornata)
       const updated = await getConversations()
       setConversations(updated)
     } catch (err) {
       console.error('Errore nel refresh conversazione:', err)
     }
   }, [client, isConnected])
   ```

**File da modificare**: `/workspace/web-client/src/contexts/XmppContext.tsx`

---

### Step 4: Modificare `components/ConversationsList.tsx` ✅

**Obiettivo**: Nessuna modifica sostanziale necessaria

Il componente usa già `refreshConversations()` dal context. Con il refactoring:
- `refreshConversations` diventa `refreshAllConversations`
- Funziona automaticamente con la nuova logica (scarica tutto)

**Modifiche minime:**
```typescript
// Prima
const { refreshConversations } = useXmpp()

// Dopo
const { refreshAllConversations } = useXmpp()

// E aggiornare il riferimento nel pull-to-refresh handler
refreshAllConversationsRef.current = refreshAllConversations
```

**File da modificare**: `/workspace/web-client/src/components/ConversationsList.tsx`

---

### Step 5: Modificare `pages/ChatPage.tsx` ⚠️ MODIFICHE SIGNIFICATIVE

**Obiettivo**: 
1. Aggiungere pull-to-refresh per chat singola
2. Caricare messaggi prima dalla cache locale

**Modifiche principali:**

#### 5.1 Aggiungere Pull-to-Refresh UI

```typescript
// Stato per pull-to-refresh
const [isRefreshing, setIsRefreshing] = useState(false)
const [pullDistance, setPullDistance] = useState(0)

// Ref per touch handlers
const touchStartY = useRef<number>(0)
const scrollContainerRef = useRef<HTMLDivElement>(null)

// Pull-to-refresh handler (simile a ConversationsList)
useEffect(() => {
  // ... implementazione touch handlers ...
  // Quando pull > threshold:
  //   - Chiama refreshSingleConversation(contactJid)
  //   - Aggiorna UI
}, [])
```

#### 5.2 Modificare Caricamento Messaggi

```typescript
useEffect(() => {
  const loadMessages = async () => {
    if (!client || !isConnected || !contactJid) return

    setIsLoading(true)
    try {
      // 1. Prima carica dalla cache locale (INSTANT)
      const cachedMessages = await getLocalMessages(contactJid, { limit: 100 })
      
      if (cachedMessages.length > 0) {
        // Applica logica self-chat se necessario
        const isSelfChat = normalizeJid(jid || '') === normalizeJid(contactJid)
        const processedMessages = applySelfChatLogic(cachedMessages, isSelfChat)
        setMessages(processedMessages)
        setIsLoading(false) // Mostra subito i messaggi cached
      }

      // 2. Se cache vuota, carica dal server
      if (cachedMessages.length === 0) {
        await syncSingleConversationComplete(client, contactJid)
        const freshMessages = await getLocalMessages(contactJid, { limit: 100 })
        const isSelfChat = normalizeJid(jid || '') === normalizeJid(contactJid)
        const processedMessages = applySelfChatLogic(freshMessages, isSelfChat)
        setMessages(processedMessages)
      }
    } catch (error) {
      console.error('Errore caricamento messaggi:', error)
      setError('Impossibile caricare i messaggi')
    } finally {
      setIsLoading(false)
    }
  }

  loadMessages()
}, [client, isConnected, contactJid, jid])
```

#### 5.3 Handler Pull-to-Refresh

```typescript
const handleRefreshChat = async () => {
  if (!client || !contactJid) return
  
  setIsRefreshing(true)
  try {
    await refreshSingleConversation(contactJid)
    // Ricarica messaggi aggiornati
    const freshMessages = await getLocalMessages(contactJid, { limit: 100 })
    const isSelfChat = normalizeJid(jid || '') === normalizeJid(contactJid)
    const processedMessages = applySelfChatLogic(freshMessages, isSelfChat)
    setMessages(processedMessages)
  } catch (error) {
    console.error('Errore refresh chat:', error)
  } finally {
    setIsRefreshing(false)
    setPullDistance(0)
  }
}
```

**File da modificare**: `/workspace/web-client/src/pages/ChatPage.tsx`

---

## Ordine di Implementazione

### Fase 1: Backend (Servizi)

1. ✅ **Verificare** `vcard.ts` - già pronto
2. ✅ **Verificare** `messages.ts` - già pronto
3. ⚠️ **Estendere** `sync.ts`:
   - Aggiungere `syncAllConversationsComplete()`
   - Aggiungere `syncSingleConversationComplete()`
4. ⚠️ **Modificare** `conversations.ts`:
   - Aggiungere parametro `saveMessages` a `loadConversationsFromServer()`

### Fase 2: Context

5. ⚠️ **Aggiornare** `XmppContext.tsx`:
   - Rinominare `refreshConversations` → `refreshAllConversations`
   - Aggiungere `refreshSingleConversation(jid)`
   - Collegare alle nuove funzioni di sync

### Fase 3: UI

6. ✅ **Aggiornare** `ConversationsList.tsx`:
   - Usare `refreshAllConversations` invece di `refreshConversations`
   
7. ⚠️ **Modificare** `ChatPage.tsx`:
   - Aggiungere pull-to-refresh UI
   - Modificare logica caricamento messaggi (cache-first)
   - Collegare a `refreshSingleConversation`

### Fase 4: Testing & Build

8. ⚠️ **Testing**:
   - Test manuale pull-to-refresh lista
   - Test manuale pull-to-refresh chat
   - Verificare caricamento cache
   - Verificare sincronizzazione

9. ⚠️ **Build finale**:
   - `npm run build`
   - Verificare nessun errore TypeScript
   - Verificare nessun errore linting

## Checklist Implementazione

### Backend Services

- [ ] `sync.ts`: Implementare `syncAllConversationsComplete()`
  - [ ] Scaricare tutte le conversazioni
  - [ ] Per ogni conversazione: scaricare tutti i messaggi
  - [ ] Salvare messaggi nel database
  - [ ] Scaricare tutti i vCard in batch
  - [ ] Aggiornare conversazioni con dati vCard
  
- [ ] `sync.ts`: Implementare `syncSingleConversationComplete()`
  - [ ] Scaricare tutti i messaggi della conversazione
  - [ ] Salvare nel database
  - [ ] Scaricare vCard del contatto
  - [ ] Aggiornare conversazione con dati vCard

- [ ] `conversations.ts`: Modificare `loadConversationsFromServer()`
  - [ ] Aggiungere parametro `saveMessages?: boolean`
  - [ ] Se `saveMessages === true`: convertire MAMResult[] → Message[]
  - [ ] Se `saveMessages === true`: chiamare saveMessages()

### Context

- [ ] `XmppContext.tsx`: Aggiornare interfaccia
  - [ ] Rinominare `refreshConversations` → `refreshAllConversations`
  - [ ] Aggiungere `refreshSingleConversation: (jid: string) => Promise<void>`

- [ ] `XmppContext.tsx`: Implementare `refreshAllConversations`
  - [ ] Chiamare `syncAllConversationsComplete(client)`
  - [ ] Ricaricare conversazioni dal database
  - [ ] Aggiornare stato

- [ ] `XmppContext.tsx`: Implementare `refreshSingleConversation`
  - [ ] Chiamare `syncSingleConversationComplete(client, jid)`
  - [ ] Ricaricare conversazioni dal database
  - [ ] Aggiornare stato

### UI Components

- [ ] `ConversationsList.tsx`: Aggiornare import/uso
  - [ ] Cambiare `refreshConversations` → `refreshAllConversations`
  - [ ] Aggiornare ref

- [ ] `ChatPage.tsx`: Aggiungere pull-to-refresh
  - [ ] Stato isRefreshing, pullDistance
  - [ ] Touch handlers (touchstart, touchmove, touchend)
  - [ ] UI indicator

- [ ] `ChatPage.tsx`: Modificare caricamento messaggi
  - [ ] Cache-first: caricare prima da getLocalMessages()
  - [ ] Se cache vuota: sincronizzare dal server
  - [ ] Applicare logica self-chat

- [ ] `ChatPage.tsx`: Handler refresh
  - [ ] Chiamare refreshSingleConversation(contactJid)
  - [ ] Ricaricare messaggi da cache
  - [ ] Aggiornare UI

### Testing

- [ ] Test pull-to-refresh lista conversazioni
  - [ ] Verificare scaricamento di tutti i messaggi
  - [ ] Verificare scaricamento di tutti i vCard
  - [ ] Verificare aggiornamento UI

- [ ] Test pull-to-refresh chat singola
  - [ ] Verificare scaricamento messaggi solo di quella chat
  - [ ] Verificare scaricamento vCard solo di quel contatto
  - [ ] Verificare aggiornamento UI

- [ ] Test apertura chat dopo sincronizzazione
  - [ ] Verificare caricamento istantaneo da cache
  - [ ] Verificare nessuna query al server

- [ ] Test offline
  - [ ] Sincronizzare con rete attiva
  - [ ] Disattivare rete
  - [ ] Verificare chat funzionanti

### Build

- [ ] `npm run build`
- [ ] Verificare 0 errori TypeScript
- [ ] Verificare 0 warning linting
- [ ] Verificare bundle size ragionevole

## Stima Tempi

| Task | Tempo Stimato |
|------|---------------|
| Estendere `sync.ts` | 2 ore |
| Modificare `conversations.ts` | 1 ora |
| Aggiornare `XmppContext.tsx` | 1.5 ore |
| Modificare `ChatPage.tsx` | 2 ore |
| Aggiornare `ConversationsList.tsx` | 0.5 ore |
| Testing manuale | 1.5 ore |
| Build e fix eventuali errori | 0.5 ore |
| **TOTALE** | **9 ore** |

## Rischi e Mitigazioni

### Rischio 1: Performance Prima Sincronizzazione
**Descrizione**: Con molte conversazioni (100+), la prima sincronizzazione potrebbe richiedere molto tempo.

**Mitigazione**:
- Mostrare progress indicator dettagliato
- Sincronizzazione in background (non bloccare UI)
- Mostrare dati cached mentre sincronizza

### Rischio 2: Storage Quota Exceeded
**Descrizione**: Database IndexedDB potrebbe superare quota disponibile.

**Mitigazione**:
- Implementare pulizia messaggi > 90 giorni (fase successiva)
- Gestire errore QuotaExceededError
- Notificare utente e suggerire pulizia manuale

### Rischio 3: Query MAM Timeout
**Descrizione**: Query MAM molto grandi potrebbero andare in timeout.

**Mitigazione**:
- Implementare retry con backoff esponenziale
- Dividere query in batch più piccoli se necessario
- Fallback a dati cached se query fallisce

## Note Tecniche

### Backward Compatibility

Tutte le modifiche sono **backward compatible**:
- Parametri opzionali con valori default
- Rename di funzioni mantenendo funzionalità
- Nessuna breaking change allo schema database

### Gestione Errori

Tutti i metodi async devono:
1. Usare try-catch
2. Loggare errori in console
3. Mostrare messaggio utente-friendly
4. Non bloccare l'applicazione (fallback a cache)

### TypeScript

Tutto il codice deve:
1. Passare il type-checking
2. Avere tipi espliciti per parametri e return
3. Usare interfacce per strutture dati complesse
4. Evitare `any` quando possibile

## Conclusione

Il piano è ben definito e realizzabile. La maggior parte dell'infrastruttura esiste già, serve principalmente **orchestrazione** e **coordinamento** tra i servizi esistenti.

**Priorità**: ALTA
**Complessità**: MEDIA
**Impatto**: ALTO (migliora drasticamente performance e UX)
