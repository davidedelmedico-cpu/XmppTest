# Ricerca: Eliminazione Conversazioni/Messaggi in XMPP

## Executive Summary

**Risposta breve:** XMPP **NON supporta nativamente l'eliminazione definitiva di messaggi dall'archivio del server (MAM)**. Tuttavia, esistono alcune soluzioni parziali e workaround.

## 1. Standard XMPP Rilevanti

### 1.1 XEP-0313: Message Archive Management (MAM)
**URL:** https://xmpp.org/extensions/xep-0313.html
**Status:** Draft

**Funzionalità:**
- ✅ Archiviazione automatica dei messaggi sul server
- ✅ Recupero storico messaggi con query e filtri
- ✅ Paginazione con RSM (Result Set Management)
- ❌ **NON prevede eliminazione di messaggi dall'archivio**

**Conclusione:** MAM è progettato come archivio **append-only** (solo aggiunta). Non esiste un metodo standard per eliminare messaggi dall'archivio MAM.

### 1.2 XEP-0424: Message Retraction
**URL:** https://xmpp.org/extensions/xep-0424.html
**Status:** Experimental

**Funzionalità:**
- ✅ Permette di "ritirare" un messaggio inviato
- ✅ Invia una notifica agli altri client che il messaggio dovrebbe essere rimosso
- ⚠️ **È solo una convenzione UI** - ogni client decide se nascondere il messaggio
- ❌ **NON cancella il messaggio dal server MAM**
- ❌ Funziona solo per messaggi inviati di recente (tipicamente nelle ultime ore)

**Esempio di utilizzo:**
```xml
<message to='romeo@montague.lit' id='retract-message-1'>
  <apply-to xmlns='urn:xmpp:fasten:0' id='message-id-to-retract'>
    <retract xmlns='urn:xmpp:message-retract:0'/>
  </apply-to>
</message>
```

**Conclusione:** Utile per "correggere" errori recenti, ma non cancella nulla dal server.

### 1.3 XEP-0425: Message Moderation
**URL:** https://xmpp.org/extensions/xep-0425.html
**Status:** Experimental

**Funzionalità:**
- ✅ Permette ai moderatori di gruppi (MUC) di rimuovere messaggi
- ⚠️ Funziona **SOLO nei gruppi (MUC/MIX)**, NON in chat 1-a-1
- ⚠️ Richiede privilegi di moderatore
- ❌ **NON applicabile alle conversazioni private**

**Conclusione:** Non risolve il problema per chat private.

### 1.4 XEP-0082: XMPP Date and Time Profiles
Non rilevante per l'eliminazione, ma utile per gestire timestamp.

### 1.5 Server-Specific Extensions
Alcuni server XMPP (come ejabberd, Prosody) offrono estensioni proprietarie per:
- Impostare limiti di retention (eliminazione automatica dopo X giorni)
- Pulizia dell'archivio tramite comandi admin
- ⚠️ Richiedono accesso amministrativo al server
- ❌ Non disponibili per utenti normali

## 2. Analisi di Stanza.js

### 2.1 Versione Usata
Dal `package.json`: **stanza@12.21.0**

### 2.2 Metodi MAM Disponibili

#### `client.searchHistory()`
```typescript
interface MAMQuery {
  with?: string;        // JID del contatto
  start?: Date;         // Data inizio
  end?: Date;           // Data fine
  paging?: {
    max?: number;       // Limite risultati
    after?: string;     // Token RSM
    before?: string;    // Token RSM
  };
}
```

**Metodi supportati:**
- ✅ Query messaggi
- ✅ Filtri per contatto/data
- ✅ Paginazione
- ❌ **Nessun metodo per eliminare**

#### Altri metodi disponibili in Stanza.js:
```typescript
// Messaggi
client.sendMessage(to, body)           // Invia messaggio
client.on('message', handler)           // Ricevi messaggi

// Roster (lista contatti)
client.getRoster()                      // Ottieni roster
client.updateRosterItem(jid, options)  // Aggiorna contatto
client.removeRosterItem(jid)           // ❌ Rimuove dal roster, NON cancella messaggi

// Presenza
client.sendPresence(options)

// IQ (Info/Query) - generico
client.sendIQ(iqStanza)                // Per comandi custom
```

**Conclusione:** Stanza.js non offre metodi nativi per eliminare messaggi dall'archivio MAM.

## 3. Opzioni Possibili

### Opzione 1: Eliminazione Solo Locale ⭐ CONSIGLIATA
**Cosa fa:**
- Elimina conversazione/messaggi dal database IndexedDB locale
- I messaggi rimangono sul server MAM
- Al prossimo sync/login, i messaggi vengono ri-scaricati

**Vantaggi:**
- ✅ Semplice da implementare
- ✅ Funziona immediatamente
- ✅ Privacy locale (altri dispositivi non vedono cosa hai eliminato)

**Svantaggi:**
- ❌ Non è permanente (i messaggi tornano al sync)
- ❌ Non sincronizzato tra dispositivi

**Implementazione:**
```typescript
// Nel file conversations-db.ts
export async function deleteConversation(jid: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['conversations', 'messages'], 'readwrite')
  
  // Elimina conversazione
  await tx.objectStore('conversations').delete(normalizeJid(jid))
  
  // Elimina tutti i messaggi
  const messagesStore = tx.objectStore('messages')
  const index = messagesStore.index('conversationJid')
  const messages = await index.getAllKeys(normalizeJid(jid))
  
  for (const key of messages) {
    await messagesStore.delete(key)
  }
  
  await tx.done
}
```

### Opzione 2: "Nascondi Conversazione" (UI Only) ⭐⭐ MIGLIORE
**Cosa fa:**
- Aggiunge un flag `hidden: true` alla conversazione nel database locale
- La conversazione viene filtrata dalla lista nell'UI
- I messaggi rimangono sul server e nel database locale

**Vantaggi:**
- ✅ Semplice da implementare
- ✅ Reversibile (può essere "mostrata" di nuovo)
- ✅ Non richiede eliminazione dati
- ✅ Più efficiente (no re-download)

**Svantaggi:**
- ❌ I dati rimangono (privacy limitata)

**Implementazione:**
```typescript
// Aggiungi campo 'hidden' al tipo Conversation
export interface Conversation {
  jid: string
  displayName?: string
  lastMessage: LastMessage
  unreadCount: number
  updatedAt: Date
  hidden?: boolean  // ⭐ NUOVO CAMPO
}

// Funzione per nascondere
export async function hideConversation(jid: string): Promise<void> {
  await updateConversation(jid, { hidden: true })
}

// Funzione per mostrare
export async function unhideConversation(jid: string): Promise<void> {
  await updateConversation(jid, { hidden: false })
}

// Filtrare nella UI
const visibleConversations = conversations.filter(c => !c.hidden)
```

### Opzione 3: Message Retraction (XEP-0424)
**Cosa fa:**
- Invia una "retraction" per ogni messaggio
- Gli altri client XMPP compatibili nasconderanno il messaggio
- ⚠️ Il messaggio rimane sul server MAM

**Vantaggi:**
- ✅ Standard XMPP ufficiale (anche se sperimentale)
- ✅ Altri client vedranno il messaggio come "ritirato"

**Svantaggi:**
- ❌ Richiede che l'altro client supporti XEP-0424
- ❌ Non cancella dal server
- ❌ Richiede inviare una retraction per OGNI messaggio (potenzialmente migliaia)
- ❌ Può essere lento e costoso in termini di banda
- ❌ Non tutti i server accettano retraction per messaggi vecchi

**Implementazione (teorica):**
```typescript
async function retractAllMessages(client: Agent, contactJid: string) {
  // 1. Carica tutti i messaggi
  const messages = await downloadAllMessagesFromServer(client, contactJid)
  
  // 2. Per ogni messaggio inviato da me, invia retraction
  for (const msg of messages) {
    if (msg.from === 'me') {
      await client.sendMessage({
        to: contactJid,
        apply-to: {
          id: msg.messageId,
          retract: {}
        }
      })
    }
  }
}
```

**Nota:** Stanza.js potrebbe non avere supporto diretto per XEP-0424. Richiederebbe costruzione manuale dello stanza XML.

### Opzione 4: Rimuovere dal Roster + Bloccare
**Cosa fa:**
- Rimuove il contatto dal roster (lista contatti)
- Blocca il contatto (XEP-0191: Blocking Command)
- ⚠️ I messaggi rimangono sul server MAM

**Vantaggi:**
- ✅ Il contatto sparisce dalla lista
- ✅ Non riceverai più messaggi dal contatto

**Svantaggi:**
- ❌ I messaggi rimangono accessibili tramite MAM query
- ❌ Troppo drastico (blocca anche la comunicazione)

**Implementazione:**
```typescript
async function removeAndBlockContact(client: Agent, contactJid: string) {
  // Rimuovi dal roster
  await client.removeRosterItem(contactJid)
  
  // Blocca (se supportato)
  await client.block(contactJid)
  
  // Elimina conversazione locale
  await deleteConversation(contactJid)
}
```

### Opzione 5: Comandi Admin Server (se disponibile)
**Cosa fa:**
- Usa comandi amministrativi specifici del server
- Richiede accesso admin o API speciali

**Esempi per ejabberd:**
```erlang
%% Cancella tutti i messaggi di un utente dall'archivio
ejabberdctl delete_old_mam_messages example.com all
```

**Vantaggi:**
- ✅ Eliminazione definitiva dal server

**Svantaggi:**
- ❌ Richiede accesso amministrativo
- ❌ Non disponibile per utenti normali
- ❌ Specifico per ogni tipo di server

## 4. Confronto Opzioni

| Opzione | Difficoltà | Elimina Locale | Elimina Server | Sincronizzato | Permanente |
|---------|-----------|----------------|----------------|---------------|------------|
| 1. Solo Locale | ⭐ Facile | ✅ | ❌ | ❌ | ❌ |
| 2. Nascondi (flag) | ⭐ Facile | ➖ (nascosto) | ❌ | ❌ | ✅ (ma dati presenti) |
| 3. Retraction | ⭐⭐⭐ Difficile | ✅ | ❌ | ⚠️ (se supportato) | ❌ |
| 4. Roster + Block | ⭐⭐ Media | ✅ | ❌ | ✅ | ➖ |
| 5. Admin Server | ⭐⭐⭐⭐ Molto difficile | ✅ | ✅ | ✅ | ✅ |

## 5. Raccomandazioni

### Per Implementazione Immediata: Opzione 2 (Nascondi)
**Vantaggi principali:**
- Semplice e veloce da implementare
- Reversibile (l'utente può "mostrare conversazioni nascoste")
- Non richiede eliminazione dati (più sicuro)
- Esperienza utente simile a "archivia conversazione" di WhatsApp

**Come implementare:**
1. Aggiungi campo `hidden` a `Conversation`
2. Crea funzioni `hideConversation()` / `unhideConversation()`
3. Filtra conversazioni nascoste nella UI
4. Aggiungi opzione "Mostra conversazioni nascoste" nelle impostazioni

### Per Implementazione Futura: Opzione 1 + 2 Combinate
**Strategia ibrida:**
1. Default: nascondi conversazione (opzione 2)
2. Opzione avanzata: "Elimina definitivamente dal dispositivo" (opzione 1)
   - ⚠️ Con warning chiaro: "I messaggi rimarranno sul server e torneranno al prossimo sync"

### Non Consigliato:
- ❌ Opzione 3 (Retraction): troppo complessa, non efficace, non supportata universalmente
- ❌ Opzione 5 (Admin): non accessibile agli utenti normali

## 6. Conclusione

**Risposta alla domanda iniziale:**

1. **XMPP permette di rimuovere conversazioni?** 
   - ❌ No, non esiste uno standard per eliminare messaggi dall'archivio MAM

2. **Stanza supporta qualcosa del genere?**
   - ❌ No, Stanza.js non ha metodi per eliminare dall'archivio server

3. **Si possono rimuovere massivamente tutti i messaggi?**
   - ⚠️ Solo con accesso admin al server
   - ⚠️ O con Message Retraction (ma non cancella dal server e richiede supporto client/server)

4. **Soluzione pratica?**
   - ✅ **Implementa "nascondi conversazione"** (flag locale)
   - ✅ Opzionalmente: elimina dal database locale (con warning che torneranno)
   - ℹ️ Accetta che i messaggi rimangono sul server XMPP (è la natura di XMPP)

## 7. Risorse e Riferimenti

### XEP (XMPP Extension Protocols)
- [XEP-0313: Message Archive Management](https://xmpp.org/extensions/xep-0313.html)
- [XEP-0424: Message Retraction](https://xmpp.org/extensions/xep-0424.html)
- [XEP-0425: Message Moderation](https://xmpp.org/extensions/xep-0425.html)
- [XEP-0191: Blocking Command](https://xmpp.org/extensions/xep-0191.html)

### Documentazione Stanza.js
- [GitHub Repository](https://github.com/legastero/stanza)
- [API Documentation](https://stanzajs.org/)

### Server XMPP Documentation
- [ejabberd MAM](https://docs.ejabberd.im/admin/configuration/modules/#mod-mam)
- [Prosody MAM](https://prosody.im/doc/modules/mod_mam)

---

**Data ricerca:** 30 Novembre 2025
**Framework:** Stanza.js v12.21.0
**Protocollo:** XMPP (RFC 6120, 6121)
