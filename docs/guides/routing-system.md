# Sistema delle Rotte e Gestione del Refresh

## Panoramica

Il sistema utilizza **HashRouter** di React Router per garantire che:
1. Il login sia **sempre un popup** che appare sopra il contenuto
2. Il refresh della pagina **preservi sempre la rotta corrente**
3. Non ci siano problemi con hosting statici come GitHub Pages

## Architettura

### 1. Hash Routing (HashRouter)

L'app usa `HashRouter` invece di `BrowserRouter`:

**URL con hash:**
- `/XmppTest/#/conversations`
- `/XmppTest/#/chat/user@server.com`

**Vantaggi:**
- ✅ Funziona su qualsiasi hosting statico senza configurazione server
- ✅ Il refresh funziona sempre (la parte dopo `#` non viene mandata al server)
- ✅ Nessun problema con 404 su GitHub Pages
- ✅ Soluzione standard prevista da React Router per hosting statici

**In `App.tsx`:**
```typescript
import { HashRouter } from 'react-router-dom'

function App() {
  return (
    <XmppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </XmppProvider>
  )
}
```

### 2. Rotte Sempre Accessibili

```typescript
<Routes>
  <Route path="/conversations" element={<ConversationsPage />} />
  <Route path="/chat/:jid" element={<ChatPage />} />
  <Route path="/" element={<Navigate to="/conversations" replace />} />
</Routes>
```

**Nessuna logica condizionale** nelle rotte - sono sempre accessibili.

### 3. Login come Popup Globale

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

### 4. Comportamento delle Pagine

#### ConversationsPage
- Mostra sempre l'interfaccia
- Visualizza un indicatore "Non connesso" nell'header se necessario
- Non fa redirect

#### ChatPage
- Mostra sempre l'interfaccia della chat
- Carica i messaggi solo quando `client` e `isConnected` sono disponibili
- Durante l'inizializzazione, l'interfaccia è visibile ma i messaggi non vengono caricati
- Non fa redirect automatici

## Flusso di Refresh

### Scenario 1: Refresh su `/#/conversations`

1. Browser fa refresh su `/XmppTest/#/conversations`
2. Server vede solo `/XmppTest/` (ignora la parte dopo `#`)
3. Server serve `index.html`
4. React carica, `HashRouter` legge `#/conversations`
5. `XmppProvider` inizializza (controlla credenziali salvate)
6. Durante l'inizializzazione:
   - `LoginPopup` appare con spinner "Connessione in corso..."
   - `ConversationsPage` è renderizzata sotto il popup
7. Quando il login ha successo:
   - Popup scompare
   - Conversazioni vengono caricate
   - **Utente rimane su `/#/conversations`** ✅

### Scenario 2: Refresh su `/#/chat/:jid`

1. Browser fa refresh su `/XmppTest/#/chat/user@server.com`
2. Server serve `index.html` (ignora l'hash)
3. React carica, `HashRouter` legge `#/chat/user@server.com`
4. `XmppProvider` inizializza
5. Durante l'inizializzazione:
   - `LoginPopup` appare con spinner
   - `ChatPage` è renderizzata sotto il popup (ma non carica messaggi)
6. Quando il login ha successo:
   - Popup scompare
   - `ChatPage` carica i messaggi per il JID corrente
   - **Utente rimane su `/#/chat/user@server.com`** ✅

### Scenario 3: Nessuna Credenziale Salvata

1. Browser carica l'app
2. `XmppProvider` rileva assenza di credenziali
3. `LoginPopup` appare con form di login
4. Utente inserisce credenziali
5. Dopo il login, popup scompare
6. Utente vede la pagina sulla rotta corrente

### Scenario 4: Logout Volontario

1. Utente clicca "Disconnetti" in `ConversationsPage`
2. `disconnect()` viene chiamato con `setLogoutIntentional(true)`
3. Credenziali vengono cancellate
4. Cliente XMPP si disconnette
5. **Popup NON appare** grazie al flag `logoutIntentional`
6. Utente può rimanere nella pagina corrente

## File Principali

- **`App.tsx`**: Definisce le rotte con `HashRouter`
- **`ChatPage.tsx`**: Nessun redirect automatico
- **`ConversationsPage.tsx`**: Nessun redirect automatico
- **`LoginPopup.tsx`**: Overlay globale per autenticazione
- **`XmppContext.tsx`**: Gestisce autenticazione e stato connessione

## Vantaggi del Sistema

1. **Preservazione della Rotta**: Il refresh mantiene sempre l'URL corrente
2. **Compatibilità**: Funziona su qualsiasi hosting statico senza configurazione
3. **UX Migliore**: Non ci sono redirect improvvisi o cambi di schermata
4. **Login Non Invasivo**: Il popup appare sopra il contenuto
5. **Codice Semplice**: Meno logica condizionale di routing
6. **Standard**: Usa la soluzione raccomandata da React Router per hosting statici

## Testing

Per testare il sistema:

1. **Test Refresh su Lista Conversazioni**:
   - Navigare a `/#/conversations`
   - Fare refresh (F5)
   - ✅ Verificare che si rimanga su `/#/conversations`
   - Durante il caricamento, il popup appare brevemente

2. **Test Refresh in Chat**:
   - Aprire una chat specifica `/#/chat/user@server.com`
   - Fare refresh (F5)
   - ✅ Verificare che si rimanga nella stessa chat
   - Durante il caricamento, il popup appare brevemente
   - Dopo il login, i messaggi della chat vengono caricati

3. **Test Primo Accesso (Senza Credenziali)**:
   - Cancellare sessionStorage
   - Ricaricare l'app
   - ✅ Verificare che appaia il popup di login
   - Dopo il login, il popup scompare e si rimane sulla rotta corrente

4. **Test Logout**:
   - Fare logout dal menu
   - ✅ Verificare che il popup NON appaia
   - Si rimane sulla pagina corrente

## Note Tecniche

- Le credenziali sono salvate in `sessionStorage` (durano solo per la sessione del browser)
- Il flag `isInitializing` distingue tra "sto caricando" e "non sono connesso"
- Il flag `logoutIntentional` previene il popup dopo un logout volontario
- `XmppContext` gestisce tutta la logica di autenticazione e connessione
- L'hash (`#`) impedisce che la parte dopo venga mandata al server
