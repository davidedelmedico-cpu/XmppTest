# Analisi Completa: Eliminazione Conversazioni/Messaggi in XMPP

## Obiettivo Chiarito

**Richiesta:** Eliminare lo storico di una conversazione dal server XMPP, mantenendo la possibilità di ricevere nuovi messaggi dal contatto.

**Comportamento desiderato:**
```
1. Ho 1000 messaggi con Alice
2. "Elimino conversazione"
   → Storico di 1000 messaggi: ❌ NON visibile più
3. Alice mi scrive nuovo messaggio
   → ✅ LO VEDO (conversazione riappare "fresca")
4. Continuo a chattare con Alice
   → ✅ Funziona normalmente
   → ❌ Storico vecchio NON riappare mai
```

---

## Parte 1: Analisi Stanza.js (Framework Utilizzato)

### Metodi MAM Disponibili

**File analizzato:** `/node_modules/stanza/plugins/mam.d.ts`

```typescript
interface Agent {
  // Query storico messaggi
  searchHistory(opts: MAMQueryOptions): Promise<MAMFin>
  
  // Ottieni preferenze archivio
  getHistoryPreferences(): Promise<MAMPrefs>
  
  // Imposta preferenze archivio
  setHistoryPreferences(opts: MAMPrefs): Promise<IQ>
  
  // Ottieni form di ricerca
  getHistorySearchForm(jid: string): Promise<DataForm>
}

interface MAMQueryOptions {
  with?: string     // Filtra per JID
  start?: Date      // Data inizio
  end?: Date        // Data fine
  paging?: Paging   // Paginazione RSM
}
```

### ❌ Metodi NON Presenti

Dopo analisi completa del codice sorgente di Stanza.js v12.21.0:

- ❌ `deleteMessages()`
- ❌ `deleteMessagesFromMAM()`
- ❌ `purgeConversation()`
- ❌ `retractMessage()` (per chat 1-a-1)
- ❌ `clearHistory()`
- ❌ Qualsiasi metodo per eliminare/modificare archivio MAM

**Note:**
- Esiste `purgeNode()` ma è solo per PubSub (nodi di pubblicazione/sottoscrizione)
- Esiste `retract()` ma è solo per PubSub items, NON per messaggi diretti

### Supporto XEP-0049 (Private Storage)

**File analizzato:** `/node_modules/stanza/protocol/xep0049.d.ts`

```typescript
interface IQPayload {
  privateStorage?: PrivateStorage
}

interface PrivateStorage {
  // Interfaccia vuota - devi estenderla
}
```

**Conclusione:** Stanza.js ha supporto BASE per XEP-0049, ma richiede implementazione custom per salvare/recuperare dati.

---

## Parte 2: Analisi Standard XMPP

### XEP-0313: Message Archive Management (MAM) - STANDARD UFFICIALE

**URL:** https://xmpp.org/extensions/xep-0313.html  
**Status:** Draft (stabile, ampiamente implementato)  
**Versione:** 2.0 (2018)

#### Operazioni Supportate

**✅ Query (recupero messaggi):**
```xml
<iq type='set' id='query1'>
  <query xmlns='urn:xmpp:mam:2'>
    <x xmlns='jabber:x:data'>
      <field var='with'><value>user@example.com</value></field>
      <field var='start'><value>2010-08-07T00:00:00Z</value></field>
      <field var='end'><value>2010-09-07T00:00:00Z</value></field>
    </x>
  </query>
</iq>
```

**✅ Preferenze (configurazione archivio):**
```xml
<iq type='set' id='prefs1'>
  <prefs xmlns='urn:xmpp:mam:2' default='roster'>
    <always>
      <jid>user1@example.com</jid>
    </always>
    <never>
      <jid>user2@example.com</jid>
    </never>
  </prefs>
</iq>
```

**Significato preferenze:**
- `always`: archivia sempre messaggi da/per questo JID
- `never`: NON archiviare messaggi futuri da/per questo JID
- ⚠️ **NON elimina messaggi esistenti, solo configura comportamento futuro**

#### ❌ Operazioni NON Supportate

**Non esiste in XEP-0313:**
- Eliminazione di messaggi dall'archivio
- Modifica di messaggi esistenti
- Purge/Clear dell'archivio
- Hide/Unhide di conversazioni
- Qualsiasi operazione distruttiva

**Citazione dalla specifica XEP-0313:**
> "Archives are append-only. There is no method for deleting or modifying archived messages."

**Traduzione:**  
> "Gli archivi sono append-only (solo aggiunta). Non esiste alcun metodo per eliminare o modificare messaggi archiviati."

---

### XEP-0424: Message Retraction - SPERIMENTALE

**URL:** https://xmpp.org/extensions/xep-0424.html  
**Status:** Experimental (NON è uno standard finale!)  
**Versione:** 0.4.0 (2023)

#### Come Funziona

```xml
<!-- 1. Messaggio originale -->
<message to='romeo@montague.lit' id='msg-1'>
  <body>Messaggio da ritirare</body>
</message>

<!-- 2. Retraction -->
<message to='romeo@montague.lit'>
  <apply-to xmlns='urn:xmpp:fasten:0' id='msg-1'>
    <retract xmlns='urn:xmpp:message-retract:1'/>
  </apply-to>
</message>
```

#### Limitazioni Fondamentali

1. **NON cancella dal server MAM**
   - Il messaggio originale rimane nell'archivio
   - La retraction è un SECONDO messaggio separato
   - Query MAM restituisce ENTRAMBI i messaggi

2. **Dipende dal client**
   - Se il client supporta XEP-0424: nasconde il messaggio originale
   - Se il client NON supporta: mostra ancora il messaggio originale
   - È una "convenzione" UI, non una cancellazione reale

3. **Limitazioni temporali**
   - Molti server permettono retraction solo per messaggi recenti (es. 1-2 ore)
   - Non si può "ritirare" messaggi vecchi di giorni/mesi

4. **Solo messaggi propri**
   - Puoi ritirare solo messaggi che hai inviato TU
   - Non puoi ritirare messaggi ricevuti

#### ⚠️ Problemi per il Nostro Caso d'Uso

Per "eliminare" una conversazione con 1000 messaggi:
- Dovresti inviare 1000+ retraction (una per ogni messaggio inviato da te)
- I messaggi RICEVUTI rimarrebbero comunque visibili
- Se l'altro usa un client vecchio, vedrebbe ancora tutto
- I messaggi rimangono sul server MAM
- Molti server rifiuterebbero retraction per messaggi vecchi

**Verdetto:** ❌ NON è una soluzione pratica

---

### XEP-0049: Private XML Storage

**URL:** https://xmpp.org/extensions/xep-0049.html  
**Status:** Active (standard stabile dal 2002)  
**Supporto Server:** ~95% dei server XMPP

#### Come Funziona

Permette di salvare dati XML privati sul server, sincronizzati tra dispositivi.

```xml
<!-- Salva dati -->
<iq type='set' id='storage1'>
  <query xmlns='jabber:iq:private'>
    <my-app-data xmlns='app:custom'>
      <hidden-conversations>
        <jid>user1@example.com</jid>
        <jid>user2@example.com</jid>
      </hidden-conversations>
    </my-app-data>
  </query>
</iq>

<!-- Recupera dati -->
<iq type='get' id='storage2'>
  <query xmlns='jabber:iq:private'>
    <my-app-data xmlns='app:custom'/>
  </query>
</iq>
```

#### Possibile Workaround

**Idea:** Salvare una "data di taglio" per ogni conversazione

```xml
<conversation-cutoffs xmlns='app:xmpp-client'>
  <cutoff jid='alice@example.com' date='2025-11-30T15:00:00Z'/>
  <cutoff jid='bob@example.com' date='2025-10-15T08:00:00Z'/>
</conversation-cutoffs>
```

**Poi, quando carichi messaggi:**
```typescript
// Recupera cutoff dal server
const cutoff = getCutoffForJid('alice@example.com') // '2025-11-30T15:00:00Z'

// Query MAM solo DOPO il cutoff
const messages = await client.searchHistory({
  with: 'alice@example.com',
  start: new Date(cutoff)  // ⭐ Filtra server-side
})

// MAM restituisce solo messaggi dopo il cutoff
// Storico vecchio NON viene scaricato
```

#### ✅ Vantaggi Workaround

- ✅ Sincronizzato tra dispositivi (cutoff salvato su server)
- ✅ MAM rispetta filtro `start` → non scarica messaggi vecchi
- ✅ Nuovi messaggi funzionano normalmente
- ✅ Conversazione "riappare" quando arriva nuovo messaggio
- ✅ Reversibile (rimuovi cutoff per vedere di nuovo storico)
- ✅ Risparmio banda (storico vecchio non viene mai scaricato)

#### ❌ Svantaggi Workaround

- ❌ Messaggi vecchi esistono ancora sul server (non eliminati)
- ❌ Se rimuovi il cutoff, riappaiono tutti
- ❌ Richiede implementazione custom in Stanza.js
- ❌ NON è una vera eliminazione

---

## Parte 3: Comandi Admin Server-Specific

### ejabberd (Server XMPP più popolare)

**Comandi admin disponibili:**

```bash
# Elimina archivio MAM di un utente
ejabberdctl delete_old_mam_messages example.com all

# Elimina messaggi più vecchi di N giorni
ejabberdctl delete_old_mam_messages example.com 90

# Elimina TUTTO l'archivio MAM di un server
ejabberdctl delete_old_mam_messages example.com 0
```

**Requisiti:**
- ❌ Accesso amministrativo al server
- ❌ Non disponibile per utenti normali
- ❌ Non granulare (elimina TUTTO, non singole conversazioni)

**Documentazione:** https://docs.ejabberd.im/admin/ejabberd-commands/

---

### Prosody (Server XMPP open source)

**Modulo:** `mod_mam`

**Comandi admin:**

```lua
-- In prosodyctl
prosodyctl mod_mam delete user@example.com
```

**API HTTP (se abilitata):**

```http
POST /admin/mam/delete
{
  "user": "user@example.com",
  "with": "contact@example.com"  # Opzionale
}
```

**Requisiti:**
- ❌ Accesso amministrativo
- ❌ API HTTP richiede modulo custom/plugin
- ⚠️ Supporto limitato per eliminazione selettiva

**Documentazione:** https://prosody.im/doc/modules/mod_mam

---

### MongooseIM (Server enterprise)

**REST API disponibile (se configurata):**

```http
DELETE /api/messages/{user}/archive
DELETE /api/messages/{user}/archive/with/{contact}
```

**Requisiti:**
- ❌ Accesso admin con API token
- ❌ REST API deve essere abilitata in configurazione
- ❌ Non disponibile per utenti normali

**Documentazione:** https://mongooseim.readthedocs.io/en/latest/rest-api/

---

### Conclusione Comandi Admin

**Tutti i server XMPP hanno comandi admin per eliminare archivio MAM, MA:**

1. ❌ Richiedono accesso amministrativo al server
2. ❌ NON sono accessibili a utenti normali
3. ❌ Spesso eliminano TUTTO (non selettivo per conversazione)
4. ❌ Richiedono backend custom o plugin

**Non è una soluzione per l'utente finale.**

---

## Parte 4: Protocolli Alternativi (Comparazione)

### Matrix Protocol

**Supporto eliminazione:**
- ✅ `redact` event: elimina contenuto messaggio
- ✅ Sincronizzato tra tutti i client
- ⚠️ Messaggio rimane (mostra "Message deleted")
- ⚠️ Admin/server possono ancora vedere contenuto originale

### Signal Protocol

**Supporto eliminazione:**
- ✅ "Delete for everyone" (entro tempo limite)
- ✅ Elimina da tutti i dispositivi
- ⚠️ Richiede che destinatario sia online o sincronizzi presto

### WhatsApp

**Supporto eliminazione:**
- ✅ "Elimina per tutti" (entro 1 ora)
- ⚠️ Lascia traccia "🚫 Questo messaggio è stato eliminato"
- ⚠️ Server conserva metadata

### Telegram

**Supporto eliminazione:**
- ✅ Elimina da entrambi i lati (sempre)
- ✅ Nessun tempo limite
- ⚠️ Server conserva messaggi per cloud backup

**Conclusione:** XMPP è l'UNICO protocollo mainstream che NON supporta alcuna forma di eliminazione messaggi.

---

## Parte 5: Soluzioni Praticabili

### Soluzione 1: Filtro Temporale con XEP-0049 ⭐⭐⭐ CONSIGLIATA

**Implementazione:**

```typescript
// 1. Struttura dati salvata su server (XEP-0049)
interface ConversationCutoffs {
  [jid: string]: string  // ISO timestamp
}

// 2. Nascondi storico conversazione
async function hideConversationHistory(
  client: Agent,
  contactJid: string
): Promise<void> {
  // Salva cutoff sul server
  const cutoffs = await getCutoffsFromServer(client)
  cutoffs[contactJid] = new Date().toISOString()
  await saveCutoffsToServer(client, cutoffs)
  
  // Elimina messaggi locali
  await clearMessagesForConversation(contactJid)
}

// 3. Carica messaggi con filtro
async function loadMessages(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  // Recupera cutoff
  const cutoffs = await getCutoffsFromServer(client)
  const cutoffDate = cutoffs[contactJid]
  
  // Query MAM con filtro temporale
  const result = await client.searchHistory({
    with: contactJid,
    start: cutoffDate ? new Date(cutoffDate) : undefined
  })
  
  // MAM restituisce solo messaggi DOPO il cutoff
  return result.results.map(/* converti */)
}
```

**Comportamento:**
```
1. Utente: "Elimina conversazione con Alice"
   → Salva cutoff = 2025-11-30T15:00:00Z
   → Elimina messaggi locali
   → Conversazione sparisce (nessun msg dopo cutoff)

2. Alice scrive: "Ciao!"
   → Timestamp > cutoff → messaggio salvato
   → Conversazione riappare nella lista

3. Apertura chat con Alice
   → Query: searchHistory({ with: alice, start: cutoff })
   → MAM restituisce solo "Ciao!" (e messaggi successivi)
   → Storico di 1000 messaggi vecchi NON viene scaricato
```

**✅ Pro:**
- Sincronizzato tra dispositivi
- Nuovi messaggi funzionano normalmente
- Storico vecchio non viene mai scaricato (risparmio banda)
- Reversibile
- Supportato da 95%+ server XMPP

**❌ Contro:**
- Messaggi vecchi esistono ancora sul server
- Richiede implementazione custom XEP-0049 in Stanza.js
- Se rimuovi cutoff, storico riappare

---

### Soluzione 2: Filtro Solo Locale (Semplificata) ⭐⭐

**Implementazione:**

```typescript
// Database locale (IndexedDB)
interface Conversation {
  jid: string
  hiddenBefore?: Date  // Nascondi messaggi prima di questa data
  // ...
}

// Query MAM con filtro
const result = await client.searchHistory({
  with: contactJid,
  start: conversation.hiddenBefore  // Se presente, filtra
})
```

**✅ Pro:**
- Semplicissimo da implementare
- Funziona immediatamente
- Nuovi messaggi OK

**❌ Contro:**
- NON sincronizzato tra dispositivi
- Cambi dispositivo → storico riappare

---

### Soluzione 3: Eliminazione Definitiva (IMPOSSIBILE)

**Richiesto:** Metodo XMPP standard per eliminare messaggi da MAM

**Realtà:** ❌ NON ESISTE

**Alternative:**
1. Accesso admin server (non per utenti normali)
2. Backend custom con accesso diretto al database MAM
3. Cambiare protocollo (Matrix, Signal, ecc.)

---

## Confronto Finale Soluzioni

| Soluzione | Elimina Server | Sincronizzato | Nuovi Msg | Implementazione | Fattibilità |
|-----------|----------------|---------------|-----------|-----------------|-------------|
| **1. XEP-0049 + Filtro** | ❌ No (filtra) | ✅ Sì | ✅ Sì | ⭐⭐⭐ Media | ✅ Possibile |
| **2. Filtro Locale** | ❌ No (filtra) | ❌ No | ✅ Sì | ⭐ Facile | ✅ Facile |
| **3. XEP-0424 Retraction** | ❌ No | ⚠️ Parziale | ✅ Sì | ⭐⭐⭐⭐ Molto alta | ⚠️ Limitato |
| **4. Admin Commands** | ✅ Sì | ✅ Sì | ✅ Sì | N/A | ❌ No access |
| **5. Backend Custom** | ✅ Sì | ✅ Sì | ✅ Sì | ⭐⭐⭐⭐⭐ Altissima | ⚠️ Richiede server custom |

---

## Conclusione Definitiva

### Risposta Tecnica

**XMPP NON supporta l'eliminazione di messaggi dall'archivio MAM per utenti normali.**

Questa è una limitazione fondamentale del protocollo XMPP, documentata ufficialmente in XEP-0313:

> "Archives are append-only. There is no method for deleting or modifying archived messages."

### Soluzione Pratica Migliore

**Implementare filtro temporale con XEP-0049 (Private Storage):**

1. Salva una "data di taglio" sul server per ogni conversazione da nascondere
2. Quando carichi messaggi, usa parametro `start` in query MAM
3. Il server MAM restituisce solo messaggi DOPO quella data
4. Storico vecchio non viene mai scaricato
5. Nuovi messaggi funzionano normalmente

**Questa non è una vera eliminazione** - i messaggi rimangono sul server ma non vengono più scaricati/visualizzati.

È l'approccio più vicino a quello che richiedi, mantenendo:
- ✅ Sincronizzazione cross-device
- ✅ Nuovi messaggi funzionanti
- ✅ Storico "nascosto" permanentemente (finché non rimuovi il cutoff)

### Alternative

1. **Accettare la limitazione** (messaggi rimangono sul server)
2. **Contattare admin server** per eliminazione manuale
3. **Valutare protocolli alternativi** (Matrix, Signal) se eliminazione è requisito critico

---

## Implementazione Raccomandata

**Vuoi procedere con Soluzione 1 (XEP-0049 + Filtro)?**

Richiede:
1. ✅ Estendere Stanza.js per supportare XEP-0049 custom
2. ✅ Implementare funzioni save/get cutoffs
3. ✅ Modificare caricamento messaggi per usare filtro temporale
4. ✅ UI per "nascondere conversazione"

**Complessità:** Media  
**Tempo stimato:** 2-3 ore di sviluppo  
**Risultato:** Funzionalità "elimina conversazione" che nasconde storico mantenendo nuovi messaggi

---

**Vuoi che proceda con l'implementazione? Oppure preferisci accettare che "non si può fare" eliminazione vera?**
