# Account di Test - Alfred XMPP Client

Questa documentazione contiene le credenziali degli account di test per lo sviluppo e il testing dell'applicazione Alfred. Gli account sono configurati sul server pubblico **conversations.im** con tutti i permessi necessari per testare le funzionalità del client.

---

## 📋 Indice

- [Account Disponibili](#account-disponibili)
- [Guida Rapida per i Test](#guida-rapida-per-i-test)
- [Configurazione Server](#configurazione-server)
- [Funzionalità Testate](#funzionalità-testate)
- [Problemi Noti e Soluzioni](#problemi-noti-e-soluzioni)
- [Best Practices](#best-practices)

---

## 🔐 Account Disponibili

### Server: `conversations.im`

Sono disponibili due account per testare le conversazioni tra utenti:

| Account | JID | Password | Avatar | Note |
|---------|-----|----------|--------|------|
| **Account 1** | `testardo@conversations.im` | `FyqnD2YpGScNsuC` | ✅ WebP (135KB) | Account principale per test |
| **Account 2** | `testarda@conversations.im` | `FyqnD2YpGScNsuC` | ✅ WebP | Account secondario per conversazioni |

> 🔒 **Nota sulla sicurezza**: Questi account sono esclusivamente per testing in ambiente di sviluppo. Non contengono dati sensibili reali. La password condivisa facilita i test tra più sviluppatori.

---

## 🚀 Guida Rapida per i Test

### 1. Test di Login Singolo

Per testare la connessione base:

1. Apri l'applicazione Alfred
2. Inserisci uno dei JID: `testardo@conversations.im` o `testarda@conversations.im`
3. Inserisci la password: `FyqnD2YpGScNsuC`
4. Clicca su "Accedi"

**Risultato atteso**: Connessione riuscita, caricamento della lista contatti e degli avatar.

### 2. Test di Conversazione tra Utenti

Per testare lo scambio di messaggi:

1. **Finestra/Tab 1**: Effettua il login con `testardo@conversations.im`
2. **Finestra/Tab 2**: Effettua il login con `testarda@conversations.im` (usa finestra in incognito o browser diverso)
3. Invia messaggi tra i due account per testare la messaggistica in tempo reale

### 3. Test delle Funzionalità Avatar/vCard

Entrambi gli account hanno avatar configurati nel vCard:

- Verifica che gli avatar vengano scaricati correttamente
- Testa l'aggiornamento/refresh degli avatar
- Verifica la visualizzazione in formato WebP

---

## ⚙️ Configurazione Server

### WebSocket Endpoint

**URL Corretto per `conversations.im`:**

```
wss://xmpp.conversations.im:443/websocket
```

⚠️ **Attenzione**: NON usare `wss://conversations.im/xmpp-websocket` (restituisce errore 404)

### Service Discovery (XEP-0156)

Il server conversations.im supporta correttamente il service discovery automatico:

- **host-meta URL**: `https://conversations.im/.well-known/host-meta`
- **Standard**: XEP-0156 (Discovering Alternative XMPP Connection Methods)
- **Formato**: XML ben formato con URL WebSocket corretto

Il client Alfred effettua automaticamente il discovery dell'endpoint WebSocket tramite questo meccanismo.

### Verifica Configurazione

Per verificare che il discovery funzioni correttamente:

1. Apri la Developer Console del browser (F12)
2. Effettua il login con uno degli account
3. Cerca nel log: `Discovered WebSocket URL via XEP-0156:`
4. Verifica che l'URL sia quello corretto sopra indicato

---

## ✅ Funzionalità Testate

Gli account sono stati verificati e testati per le seguenti funzionalità:

| Funzionalità | Stato | Data Ultimo Test | Note |
|--------------|-------|------------------|------|
| **Connessione XMPP** | ✅ Funzionante | 2025-11-30 | Connessione stabile via WebSocket |
| **Download vCard** | ✅ Funzionante | 2025-11-30 | Recupero dati profilo utente |
| **Avatar** | ✅ Funzionante | 2025-11-30 | Entrambi gli account hanno avatar WebP |
| **Conversione Buffer** | ✅ Funzionante | 2025-11-30 | Conversione base64 corretta |
| **Formato Foto** | ✅ Funzionante | 2025-11-30 | WebP con encoding base64 |
| **Messaggistica** | ✅ Funzionante | 2025-11-30 | Invio e ricezione messaggi |
| **Roster/Contatti** | ✅ Funzionante | 2025-11-30 | Gestione lista contatti |

---

## 🔧 Problemi Noti e Soluzioni

### 1. Fallback URL WebSocket Errato

**Problema**: Se il service discovery fallisce, il client usa un URL di fallback errato.

**Dettagli tecnici**:
```typescript
// URL di fallback attuale (ERRATO):
wss://xmpp.conversations.im/ws

// URL di fallback corretto (da implementare):
wss://xmpp.conversations.im/websocket
```

**Soluzione**: Modificare il fallback in `xmpp.ts` (linea ~102):

```typescript
// Prima:
const fallbackUrl1 = `wss://xmpp.${domain}/ws`

// Dopo:
const fallbackUrl1 = `wss://xmpp.${domain}/websocket`
```

### 2. Parser XML e Namespace

**Problema**: Il DOMParser del browser potrebbe avere problemi con alcuni namespace XML durante il parsing dell'host-meta.

**Soluzione implementata**: Il codice include un fallback basato su regex che gestisce questo caso automaticamente.

### 3. Debug del Service Discovery

Se riscontri problemi di connessione:

1. Apri la Developer Console (F12)
2. Vai alla tab "Network"
3. Filtra per "websocket" o "host-meta"
4. Verifica che:
   - La richiesta a `/.well-known/host-meta` ritorni 200 OK
   - La connessione WebSocket venga stabilita all'URL corretto

---

## 📝 Best Practices

### Per gli Sviluppatori

1. **Non modificare le password** - Mantieni la password condivisa per facilitare i test collaborativi
2. **Pulisci i messaggi di test** - Dopo test intensivi, considera di cancellare vecchie conversazioni
3. **Non memorizzare dati sensibili** - Non usare questi account per testare con dati reali
4. **Logout dopo i test** - Effettua sempre il logout dopo aver completato i test

### Per i Test Automatizzati

Gli account possono essere usati in test automatizzati E2E:

```javascript
// Esempio configurazione test
const TEST_ACCOUNTS = {
  account1: {
    jid: 'testardo@conversations.im',
    password: 'FyqnD2YpGScNsuC'
  },
  account2: {
    jid: 'testarda@conversations.im',
    password: 'FyqnD2YpGScNsuC'
  }
};
```

### Scenari di Test Consigliati

- ✉️ Invio messaggi di testo semplici
- 📎 Invio messaggi con emoji e caratteri speciali
- 👤 Aggiornamento e visualizzazione avatar
- 🔄 Sincronizzazione stato presenza (online/offline/away)
- 📱 Test connessione multipla (stesso account su più dispositivi)
- 🔔 Notifiche e ricezione messaggi in background
- 🗑️ Cancellazione e modifica messaggi (se XEP-0424 supportato)

---

## 📅 Cronologia

- **2025-11-30**: Creazione account e configurazione iniziale
- **2025-11-30**: Test completo vCard e avatar con successo
- **2025-11-30**: Verifica funzionalità messaggistica e roster

---

## 🤝 Supporto

Per problemi o domande relative agli account di test, consulta:

- [Documentazione tecnica](/docs)
- [Issue tracker GitHub](https://github.com/[your-repo]/issues)

**Ultimo aggiornamento**: 2025-11-30
