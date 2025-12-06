# Sistema di Debug Logger

## Panoramica

È stato implementato un sistema completo per intercettare e visualizzare tutti i console log dell'applicazione.

## Componenti Implementati

### 1. Debug Logger Service (`src/services/debug-logger.ts`)

Il servizio intercetta automaticamente tutti i metodi di console:
- `console.log()`
- `console.info()`
- `console.warn()`
- `console.error()`
- `console.debug()`

**Caratteristiche:**
- Mantiene gli ultimi 1000 log in memoria
- Notifica i listener in tempo reale quando arrivano nuovi log
- Supporta l'esportazione dei log in formato TXT e JSON
- I console originali continuano a funzionare normalmente

**API:**
```typescript
// Inizializzazione (già fatto in main.tsx)
debugLogger.initialize()

// Ottenere tutti i log
const logs = debugLogger.getLogs()

// Cancellare i log
debugLogger.clearLogs()

// Aggiungere un listener
debugLogger.addListener((logs) => {
  console.log('Nuovi log:', logs)
})

// Esportare come testo o JSON
const txt = debugLogger.exportLogsAsText()
const json = debugLogger.exportLogsAsJSON()
```

### 2. Debug Log Popup (`src/components/DebugLogPopup.tsx`)

Un componente popup completo per visualizzare i log con le seguenti funzionalità:

**Caratteristiche:**
- **Filtri per livello**: Visualizza solo log, info, warn, error o tutti
- **Auto-scroll**: Scorre automaticamente ai nuovi log (disattivabile)
- **Export**: Esporta i log come file TXT o JSON
- **Cancellazione**: Pulisce tutti i log con conferma
- **Tempo reale**: Si aggiorna automaticamente quando arrivano nuovi log
- **Design responsive**: Funziona su desktop e mobile
- **Dark mode**: Supporto automatico per tema scuro

**Visualizzazione:**
- Timestamp preciso (millisecondi)
- Colori diversi per ogni livello di log
- Formattazione JSON per oggetti
- Scrolling fluido

### 3. Integrazione nell'App

**In `main.tsx`:**
Il debug logger viene inizializzato automaticamente all'avvio dell'applicazione.

**In `ConversationsPage.tsx`:**
È stato aggiunto un pulsante debug in alto a destra nell'header (icona con simbolo del dollaro `$`) che apre il popup.

## Come Usare

1. **Accedere al Debug Logger:**
   - Vai alla pagina delle conversazioni
   - Clicca sull'icona debug (simbolo `$`) in alto a destra

2. **Filtrare i Log:**
   - Usa i pulsanti "Tutti", "Log", "Info", "Warn", "Error" per filtrare

3. **Copiare i Log negli Appunti:**
   - Clicca su "Copia" per copiare tutti i log come testo negli appunti
   - I log verranno copiati in formato testo con timestamp

4. **Esportare i Log:**
   - Clicca su "TXT" per esportare come file di testo
   - Clicca su "JSON" per esportare come JSON (include timestamp e args originali)

5. **Cancellare i Log:**
   - Clicca su "Cancella" per pulire tutti i log (richiede conferma)

6. **Auto-scroll:**
   - Attiva/disattiva la checkbox "Auto-scroll" per seguire automaticamente i nuovi log

## Struttura dei Log

Ogni log entry contiene:
```typescript
{
  timestamp: Date,           // Data e ora precisa
  level: 'log' | 'info' | 'warn' | 'error' | 'debug',
  message: string,          // Messaggio formattato
  args: any[]              // Argomenti originali
}
```

## Limitazioni

- Mantiene solo gli ultimi 1000 log in memoria (configurabile in `debug-logger.ts`)
- I log vengono persi al refresh della pagina (sono solo in memoria)
- Gli oggetti circolari vengono convertiti in `[object Object]`

## Sicurezza

⚠️ **IMPORTANTE**: Questo sistema è pensato per lo sviluppo e il debug. 
- Non includere informazioni sensibili nei log
- Considera di disabilitare in produzione se necessario

## Personalizzazione

### Modificare il numero massimo di log:
In `src/services/debug-logger.ts`, cambia:
```typescript
private maxLogs = 1000 // Modifica questo valore
```

### Aggiungere nuovi livelli di log:
Estendi il tipo `LogEntry.level` e aggiungi l'intercettazione in `initialize()`.

### Cambiare lo stile del popup:
Modifica `src/components/DebugLogPopup.css`.

## Browser Compatibility

✅ Testato su:
- Chrome/Chromium
- Firefox
- Safari
- Edge

Funziona su tutti i browser moderni che supportano ES6+.
