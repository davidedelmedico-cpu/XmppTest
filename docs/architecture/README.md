# 🏗️ Architettura Alfred

Documentazione architetturale del sistema.

## Documenti

### Analisi Conversazioni
- **[conversations-analysis.md](./conversations-analysis.md)** - Analisi tecnica del recupero conversazioni via XMPP
  - XEP-0313 (MAM - Message Archive Management)
  - XEP-0059 (RSM - Result Set Management)
  - Strategia di paginazione e lazy loading
  - Struttura dati e algoritmi

### Strategia MAM
- **[mam-global-strategy-explained.md](./mam-global-strategy-explained.md)** - Spiegazione strategia MAM globale
  - Perché query globale invece di N query per contatto
  - Vantaggi e svantaggi
  - Implementazione pratica

- **[mam-performance-long-term.md](./mam-performance-long-term.md)** - Performance MAM a lungo termine
  - Analisi scalabilità
  - Gestione grandi volumi di dati
  - Ottimizzazioni

### Confronto Strategie
- **[strategy-comparison.md](./strategy-comparison.md)** - Confronto strategie di sincronizzazione
  - Approccio ibrido vs globale vs per contatto
  - Pros e cons di ogni approccio
  - Decisione finale

## Architettura Generale

```
┌─────────────────────────────────────┐
│         React UI Layer              │
│  (Components, Pages, Hooks)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Context Layer (State)          │
│     XmppContext, RouterContext      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Services Layer                │
│  (XMPP, Sync, Messages, VCard)      │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌─────▼──────┐
│  XMPP/MAM   │ │  IndexedDB │
│   Server    │ │   (Cache)  │
└─────────────┘ └────────────┘
```

## Principi Architetturali

### 1. Offline-First
- Cache locale completa in IndexedDB
- UI funziona senza connessione
- Sincronizzazione quando disponibile

### 2. Cache-First Loading
- Mostra sempre prima dati locali
- Aggiorna in background dal server
- Feedback visivo durante sync

### 3. Minimal Server Queries
- Una query MAM globale per tutto
- Cache vCard persistente
- Sincronizzazione intelligente (solo delta quando possibile)

### 4. Separation of Concerns
- **UI**: Solo rendering e interazione
- **Context**: Gestione stato globale
- **Services**: Logica business
- **Utils**: Funzioni pure riutilizzabili

## Stack Tecnologico

- **Frontend**: React 18 + TypeScript
- **Routing**: React Router (HashRouter per GitHub Pages)
- **State**: React Context + Hooks
- **XMPP**: Stanza.js v12.21.0
- **Database**: IndexedDB (via idb wrapper)
- **Build**: Vite
- **Hosting**: GitHub Pages (static)

## Vedere Anche

- [Implementazione Sincronizzazione](../implementation/sync-system-complete.md)
- [Guide Routing](../guides/routing-system.md)
- [Decisioni Architetturali](../decisions/)
