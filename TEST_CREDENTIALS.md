# Credenziali di Test

## Account XMPP per Testing

### Server: conversations.im

**Account 1:**
- JID: `testardo@conversations.im`
- Password: `FyqnD2YpGScNsuC`
- Avatar: ✅ SÌ (WebP, 135KB)

**Account 2:**
- JID: `testarda@conversations.im`
- Password: `FyqnD2YpGScNsuC`
- Avatar: ✅ SÌ (WebP)

## Configurazione Server

### WebSocket URL
**URL Corretto**: `wss://xmpp.conversations.im:443/websocket`

⚠️ **NON** usare: `wss://conversations.im/xmpp-websocket` (restituisce 404)

### Discovery XEP-0156
- host-meta URL: `https://conversations.im/.well-known/host-meta`
- Il server supporta correttamente XEP-0156
- L'XML è ben formato e contiene l'URL WebSocket

### Test Effettuati (2025-11-30)

✅ **Connessione XMPP**: Funziona correttamente  
✅ **vCard Download**: Funziona correttamente  
✅ **Avatar**: Entrambi gli account hanno avatar configurati  
✅ **Conversione Buffer**: Funziona correttamente  
✅ **Formato Foto**: WebP con dati base64  

## Problemi Identificati

### 1. URL WebSocket Discovery
Il discovery automatico dovrebbe funzionare, ma verificare nei log del browser che stia effettivamente scaricando l'URL corretto.

**Debug suggerito**: Aprire Developer Console e cercare:
```
console.debug('Discovered WebSocket URL via XEP-0156:', ...)
```

### 2. Parser XML nel Browser
Il DOMParser del browser potrebbe avere problemi con alcuni namespace XML.
Il codice include un fallback regex che dovrebbe gestire questo caso.

### 3. Fallback URL
Se il discovery fallisce, il codice usa:
```
wss://xmpp.conversations.im/ws
```
Che è **SBAGLIATO** per conversations.im. Dovrebbe essere `/websocket` non `/ws`.

## Soluzione Suggerita

Modificare il fallback in `xmpp.ts` linea ~102:

```typescript
// DA:
const fallbackUrl1 = `wss://xmpp.${domain}/ws`

// A:
const fallbackUrl1 = `wss://xmpp.${domain}/websocket`
```

## Note
- Questi account sono usati per testare il supporto vCard
- Gli avatar sono effettivamente impostati sui vCard
- Usare per testing delle funzionalità XMPP

## Data di creazione
2025-11-30

## Data ultimo test
2025-11-30 - Test completo vCard effettuato con successo
