# Web XMPP Client (Browser Only)

Client React/Vite progettato per registrazione (XEP-0077) e login XMPP direttamente dal browser, senza backend proprietario. Il flusso usa la libreria [`stanza`](https://github.com/legastero/stanza) con trasporto WebSocket e fornisce un layout ispirato a WhatsApp/Telegram.

## Stack

- React 19 + TypeScript
- Vite 7 (dev server + bundler)
- Stanza (client XMPP con supporto WebSocket/BOSH)
- CSS modulare minimal, nessun framework UI esterno

## Funzionalità attuali

1. **Configurazione server**: dominio e endpoint WebSocket personalizzabili dall'interfaccia.
2. **Registrazione in-band**: invio di IQ `jabber:iq:register` prima della negoziazione SASL.
3. **Login**: autenticazione via SASL + indicazione JID assegnato dal server.
4. **Feedback UX**: messaggi di stato differenziati (pending/success/error) utili per i test manuali.

## Script disponibili

```bash
npm install        # già eseguito qui, reinstalla le dipendenze
npm run dev        # avvia Vite in modalità sviluppo (HMR)
npm run build      # genera la cartella dist/ pronta per deploy statico
npm run preview    # serve il build prodotto localmente
```

> Nota: tutti i comandi possono essere eseguiti nel container remoto, quindi non è necessario avere Node sul dispositivo locale.

## Configurazione XMPP

- **Dominio predefinito**: `jabber.hot-chilli.net` (consente registrazioni in-band).
- **WebSocket**: `wss://jabber.hot-chilli.net:5281/xmpp-websocket`.
- Puoi sostituire entrambi i valori dal pannello "Server XMPP"; lasciare vuoto il campo WebSocket attiva l'auto-discovery (`.well-known/host-meta`).
- Requisito: il server deve permettere connessioni CORS sul trasporto WebSocket.

## Flusso di test suggerito

1. Apri l'app (`npm run dev` oppure distribuzione statica) e imposta il server desiderato.
2. Compila il form "Crea account" (username + password). La password deve avere almeno 6 caratteri.
3. Al termine, prendi nota del JID mostrato nel banner di successo.
4. Usa il form "Accedi" con le stesse credenziali per verificare la sessione.

## Deploy su GitHub Pages (static hosting)

Il workflow [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) automatizza build e pubblicazione della cartella `web-client/dist/`.

1. In GitHub vai su **Settings → Pages** e imposta **Source = GitHub Actions** (richiesto solo la prima volta).
2. Ogni push su `main` (o su questo branch di lavoro) che tocca `web-client/**` fa partire il workflow:
   - checkout repo
   - `npm ci --prefix web-client`
   - `npm run build --prefix web-client`
   - upload dell'artefatto e deploy con `actions/deploy-pages`.
3. Puoi anche eseguirlo manualmente via **Actions → Deploy web client to GitHub Pages → Run workflow**.
4. L'URL finale appare nell'output del job `deploy`. L'app è puramente statica, quindi non richiede ulteriori servizi.

Se preferisci un deploy manuale resta valido il vecchio approccio: `npm run build` e pubblicazione dei file presenti in `web-client/dist/`.

## Prossimi passi possibili

- Visualizzazione roster/presenza dopo il login.
- Chat 1:1 con gestione messaggi in tempo reale.
- Storage lato browser (IndexedDB) per cache messaggi.
- Modalità dark responsive e supporto mobile.

Per domande su configurazione/testing fai riferimento alla documentazione in `docs/requirements.md` o chiedi direttamente nel thread di lavoro corrente.
