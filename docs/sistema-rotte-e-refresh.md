# Sistema delle Rotte e Gestione del Refresh

## Panoramica

Il sistema è stato completamente revisionato per garantire che:
1. Il login sia **sempre un popup** che appare sopra il contenuto
2. Il refresh della pagina **preservi sempre la rotta corrente**
3. Non ci siano redirect indesiderati durante l'inizializzazione

## Architettura

### 1. Rotte Sempre Accessibili

In `App.tsx`, le rotte sono definite in modo semplice e diretto:

```typescript
<Routes>
  <Route path="/conversations" element={<ConversationsPage />} />
  <Route path="/chat/:jid" element={<ChatPage />} />
  <Route path="/" element={<Navigate to="/conversations" replace />} />
  <Route path="*" element={<Navigate to="/conversations" replace />} />
</Routes>
```

**Nessuna logica condizionale** nelle rotte stesse - sono sempre accessibili.

### 2. Login come Popup Globale

Il `LoginPopup` viene mostrato come overlay sopra le rotte quando necessario:

```typescript
{(isInitializing || !isConnected) && !logoutIntentional && (
  <LoginPopup isInitializing={isInitializing} />
)}
```

**Condizioni per mostrare il popup:**
- Durante l'inizializzazione (`isInitializing`)
- Quando non si è connessi (`!isConnected`)
- **TRANNE** quando il logout è volontario (`!logoutIntentional`)

### 3. Comportamento delle Pagine

#### ConversationsPage
- Mostra sempre l'interfaccia
- Visualizza un indicatore "Non connesso" nell'header se necessario
- Non fa redirect

#### ChatPage
- **MODIFICATA**: Rimosso il redirect verso `/conversations`
- Mostra sempre l'interfaccia della chat
- Carica i messaggi solo quando `client` e `isConnected` sono disponibili
- Durante l'inizializzazione, l'interfaccia è visibile ma i messaggi non vengono caricati

```typescript
// Se client e connessione sono disponibili, carica i messaggi
if (client && isConnected) {
  loadInitialMessages()
  markConversationAsRead(jid)
}

// NON redirigere durante l'inizializzazione
```

## Flusso di Refresh

### Scenario 1: Refresh su `/conversations`

1. Browser fa refresh
2. `XmppProvider` inizializza (controlla credenziali salvate)
3. Se ci sono credenziali: tenta auto-login
4. Durante l'inizializzazione:
   - Rotta rimane `/conversations`
   - `LoginPopup` appare con spinner "Connessione in corso..."
   - `ConversationsPage` è renderizzata sotto il popup
5. Quando il login ha successo:
   - Popup scompare
   - Conversazioni vengono caricate
   - Utente vede la lista delle conversazioni

### Scenario 2: Refresh su `/chat/:jid`

1. Browser fa refresh
2. `XmppProvider` inizializza
3. Durante l'inizializzazione:
   - Rotta rimane `/chat/:jid`
   - `LoginPopup` appare con spinner
   - `ChatPage` è renderizzata sotto il popup (ma non carica messaggi)
4. Quando il login ha successo:
   - Popup scompare
   - `ChatPage` carica i messaggi per il JID corrente
   - Utente resta nella chat specifica

### Scenario 3: Nessuna Credenziale Salvata

1. Browser carica l'app
2. `XmppProvider` rileva assenza di credenziali
3. Rotta va a `/conversations` (default)
4. `LoginPopup` appare con form di login
5. Utente inserisce credenziali
6. Dopo il login, popup scompare e utente vede `/conversations`

### Scenario 4: Logout Volontario

1. Utente clicca "Disconnetti" in `ConversationsPage`
2. `disconnect()` viene chiamato con `setLogoutIntentional(true)`
3. Credenziali vengono cancellate
4. Cliente XMPP si disconnette
5. **Popup NON appare** grazie al flag `logoutIntentional`
6. Utente può rimanere nella pagina corrente senza essere disturbato

## File Eliminati

- **`LoginPage.tsx`**: Non più necessaria, sostituita completamente da `LoginPopup`

## File Modificati

1. **`ChatPage.tsx`**
   - Rimosso il redirect condizionale verso `/conversations`
   - Ora renderizza sempre l'interfaccia indipendentemente dallo stato di connessione
   - Carica messaggi solo quando connesso

2. **`App.tsx`**
   - Nessuna modifica strutturale necessaria (già corretto)
   - Le rotte sono sempre accessibili
   - `LoginPopup` è gestito come overlay globale

## Vantaggi del Nuovo Sistema

1. **Preservazione della Rotta**: Il refresh mantiene sempre l'URL corrente
2. **UX Migliore**: Non ci sono redirect improvvisi o cambi di schermata
3. **Login Non Invasivo**: Il popup appare sopra il contenuto, rendendo chiaro che è uno stato temporaneo
4. **Codice Più Semplice**: Meno logica condizionale di routing
5. **Consistenza**: Tutte le pagine si comportano allo stesso modo

## Testing

Per testare il sistema:

1. **Test Refresh su Lista Conversazioni**:
   - Navigare a `/conversations`
   - Fare refresh (F5)
   - Verificare che si rimanga su `/conversations`
   - Durante il caricamento, il popup appare brevemente

2. **Test Refresh in Chat**:
   - Aprire una chat specifica `/chat/user@server.com`
   - Fare refresh (F5)
   - Verificare che si rimanga nella stessa chat
   - Durante il caricamento, il popup appare brevemente
   - Dopo il login, i messaggi della chat vengono caricati

3. **Test Primo Accesso (Senza Credenziali)**:
   - Cancellare sessionStorage
   - Ricaricare l'app
   - Verificare che appaia il popup di login
   - L'URL va a `/conversations` (default)
   - Dopo il login, il popup scompare

4. **Test Logout**:
   - Fare logout dal menu
   - Verificare che il popup NON appaia
   - Si può rimanere sulla pagina corrente

## Note Tecniche

- Le credenziali sono salvate in `sessionStorage` (durano solo per la sessione del browser)
- Il flag `isInitializing` distingue tra "sto caricando" e "non sono connesso"
- Il flag `logoutIntentional` previene il popup dopo un logout volontario
- `XmppContext` gestisce tutta la logica di autenticazione e connessione
