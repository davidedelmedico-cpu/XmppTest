# Strategia di Sincronizzazione Ottimizzata

## Data
30 Novembre 2025

## Obiettivo

Implementare una strategia di sincronizzazione efficiente che minimizzi le query al server XMPP seguendo due logiche distinte:

1. **Pull-to-refresh LISTA conversazioni**: Sincronizza TUTTO (messaggi + vCard di tutte le conversazioni)
2. **Pull-to-refresh CHAT singola**: Sincronizza solo quella conversazione specifica (messaggi + vCard del contatto)

## Principi Guida

### 1. Massimizzare l'Uso dei Dati Scaricati
Quando facciamo una query MAM globale, scarichiamo centinaia/migliaia di messaggi. Invece di scartarli, li salviamo tutti nel database locale.

### 2. Minimizzare le Query al Server
- Query globale una sola volta (pull-to-refresh lista)
- Query specifiche solo quando necessario (pull-to-refresh chat)

### 3. Esperienza Utente Ottimale
- Chat si aprono istantaneamente (dati già in cache)
- Funzionamento offline-first
- Sincronizzazione intelligente in background

## Architettura

### Database Locale (IndexedDB)

Il database `conversations-db` ha tre store principali:

```typescript
interface ConversationsDB {
  conversations: {
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
  
  messages: {
    messageId: string
    conversationJid: string
    body: string
    timestamp: Date
    from: 'me' | 'them'
    status: 'pending' | 'sent' | 'delivered' | 'failed'
  }
  
  vcards: {
    jid: string
    fullName?: string
    nickname?: string
    photoData?: string
    photoType?: string
    email?: string
    description?: string
    lastUpdated: Date
  }
}
```

## Scenari di Sincronizzazione

### Scenario 1: Pull-to-Refresh Lista Conversazioni

**Comportamento:**
1. Query MAM globale: `client.searchHistory({})` - scarica TUTTI i messaggi archiviati
2. Salva TUTTI i messaggi nel database `messages`
3. Raggruppa per contatto e aggiorna store `conversations`
4. Per ogni contatto, scarica vCard: `client.getVCard(jid)`
5. Salva tutti i vCard nel database `vcards`
6. Aggiorna UI con tutti i dati

**API:**
```typescript
await refreshAllConversations(client)
```

**Vantaggi:**
- ✅ Una sola query MAM per tutto
- ✅ Chat successive si aprono istantaneamente (dati già in cache)
- ✅ vCard aggiornati per tutti i contatti
- ✅ Esperienza offline completa

**Svantaggi:**
- ⚠️ Prima sincronizzazione più lenta (ma solo la prima volta)
- ⚠️ Uso maggiore di banda (ma una volta sola)
- ⚠️ Storage locale più grande

### Scenario 2: Pull-to-Refresh Chat Singola

**Comportamento:**
1. Query MAM filtrata: `client.searchHistory({ with: 'contact@server.com' })`
2. Salva solo i messaggi di quella conversazione nel database `messages`
3. Aggiorna la conversazione specifica in `conversations`
4. Scarica vCard solo di quel contatto: `client.getVCard(jid)`
5. Aggiorna vCard in `vcards`
6. Aggiorna UI della chat

**API:**
```typescript
await refreshSingleConversation(client, contactJid)
```

**Vantaggi:**
- ✅ Minimo uso di banda (solo una conversazione)
- ✅ Veloce (pochi messaggi da scaricare)
- ✅ Aggiorna solo ciò che serve

**Svantaggi:**
- ⚠️ Altre conversazioni rimangono non sincronizzate

## Flusso di Sincronizzazione

### Inizializzazione (Login)

```
Login → Controlla cache locale
  ├─ Se cache presente → Mostra subito (offline-first)
  └─ Sincronizza in background (delta-sync)
```

### Pull-to-Refresh Lista

```
Pull-to-refresh
  ↓
Query MAM globale (tutti i messaggi)
  ↓
Salva TUTTI i messaggi in database.messages
  ↓
Raggruppa per contatto → Aggiorna database.conversations
  ↓
Per ogni contatto: getVCard(jid) in parallelo
  ↓
Salva tutti i vCard in database.vcards
  ↓
Aggiorna UI
```

### Pull-to-Refresh Chat

```
Pull-to-refresh in chat
  ↓
Query MAM filtrata (solo quel contatto)
  ↓
Salva messaggi di quel contatto in database.messages
  ↓
Aggiorna quella conversazione in database.conversations
  ↓
getVCard(jid) per quel contatto
  ↓
Aggiorna vCard in database.vcards
  ↓
Aggiorna UI chat
```

### Apertura Chat

```
Utente apre chat
  ↓
Carica messaggi da database.messages (locale)
  ↓
Mostra immediatamente all'utente
  ↓
[Fine] - Nessuna query al server necessaria
```

## Gestione dello Storage

### Pulizia Messaggi Vecchi

Per evitare che il database cresca indefinitamente:

1. **Per conversazione**: Mantieni solo gli ultimi N messaggi (es. 1000)
2. **Per data**: Elimina messaggi più vecchi di X giorni (es. 90 giorni)
3. **Manuale**: Utente può pulire la cache dalle impostazioni

### Cache vCard

1. **TTL**: vCard hanno Time-To-Live di 24 ore
2. **Refresh**: Durante pull-to-refresh lista, forza refresh di tutti i vCard
3. **Fallback**: Se vCard non disponibile, usa JID come displayName

## API da Implementare

### Servizi

```typescript
// services/sync.ts

/**
 * Sincronizza TUTTE le conversazioni (messaggi + vCard)
 * Usato nel pull-to-refresh della lista
 */
export async function syncAllConversations(client: Agent): Promise<void>

/**
 * Sincronizza UNA SOLA conversazione (messaggi + vCard)
 * Usato nel pull-to-refresh di una chat
 */
export async function syncSingleConversation(
  client: Agent, 
  contactJid: string
): Promise<void>

/**
 * Scarica e salva messaggi per tutte le conversazioni
 */
async function downloadAndSaveAllMessages(client: Agent): Promise<Conversation[]>

/**
 * Scarica e salva messaggi per una conversazione
 */
async function downloadAndSaveMessagesForConversation(
  client: Agent,
  contactJid: string
): Promise<Message[]>

/**
 * Scarica e salva vCard per tutti i contatti
 */
async function downloadAndSaveAllVCards(
  client: Agent,
  jids: string[]
): Promise<void>

/**
 * Scarica e salva vCard per un contatto
 */
async function downloadAndSaveVCard(
  client: Agent,
  jid: string
): Promise<void>
```

### Context

```typescript
// contexts/XmppContext.tsx

interface XmppContextType {
  // ... esistente ...
  
  // NUOVO: Sincronizza tutto
  refreshAllConversations: () => Promise<void>
  
  // NUOVO: Sincronizza una conversazione
  refreshSingleConversation: (jid: string) => Promise<void>
}
```

### Componenti

```typescript
// components/ConversationsList.tsx
// Usa refreshAllConversations() nel pull-to-refresh

// pages/ChatPage.tsx
// Usa refreshSingleConversation(jid) nel pull-to-refresh
```

## Metriche di Successo

### Performance

- ✅ Apertura chat: < 100ms (dati da cache locale)
- ✅ Pull-to-refresh lista: < 5s per 100 conversazioni
- ✅ Pull-to-refresh chat: < 2s per 50 messaggi

### Banda

- ✅ Query MAM: da N query (una per chat) a 1 query globale
- ✅ Riduzione ~90% delle richieste al server dopo prima sincronizzazione

### Storage

- ✅ Database locale: ~5-10 MB per 100 conversazioni con 1000 messaggi ciascuna
- ✅ Pulizia automatica messaggi > 90 giorni

## Compatibilità

### Server XMPP
- ✅ conversations.im: supporta MAM (XEP-0313) e vCard (XEP-0054)
- ✅ Altri server con MAM: compatibile
- ⚠️ Server senza MAM: fallback a roster only

### Browser
- ✅ IndexedDB: supportato da tutti i browser moderni
- ✅ Storage: ~50MB garantiti, fino a diversi GB disponibili

## Note di Implementazione

### Gestione Errori

1. **Timeout MAM**: Retry fino a 3 volte con backoff esponenziale
2. **vCard non disponibile**: Fallback a JID come displayName
3. **Quota storage piena**: Notifica utente e suggerisci pulizia

### Ottimizzazioni

1. **Batch vCard**: Scarica vCard in parallelo (max 10 concurrent)
2. **Debouncing**: Evita sincronizzazioni multiple simultanee
3. **Delta sync**: Nelle sincronizzazioni successive, scarica solo nuovi messaggi (usando RSM token)

### Sicurezza

1. **Validazione JID**: Normalizza e valida tutti i JID prima di salvare
2. **Sanitizzazione**: Escape HTML nei messaggi prima del rendering
3. **Storage**: IndexedDB è isolato per dominio (sicuro)
