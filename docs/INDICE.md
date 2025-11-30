# 📚 Indice Documentazione Alfred

## Navigazione Rapida

- [🚀 Quick Start](#quick-start)
- [📖 Guide](#guide)
- [🏗️ Architettura](#architettura)
- [🔧 Implementazione](#implementazione)
- [🎨 Design](#design)
- [📝 Decisioni Architetturali](#decisioni-architetturali)
- [🗂️ Archivio](#archivio)

---

## 🚀 Quick Start

Per iniziare rapidamente con Alfred:

1. **[README](../README.md)** - Panoramica del progetto e setup iniziale
2. **[Brand Identity](./design/brand-identity.md)** - Colori e stile
3. **[Architecture Overview](./architecture/README.md)** - Architettura generale

---

## 📖 Guide

### Guide Utente
- Coming soon

### Guide Sviluppatore
- **[Sincronizzazione Dati](./guides/sync-strategy.md)** - Come funziona la sincronizzazione
- **[Pull-to-Refresh](./guides/pull-to-refresh.md)** - Implementazione del refresh
- **[Sistema Routing](./guides/routing-system.md)** - Gestione delle rotte

---

## 🏗️ Architettura

### Documentazione Architetturale
- **[Panoramica](./architecture/README.md)** - Overview architetturale
- **[Sincronizzazione](./architecture/sync-system.md)** - Sistema di sincronizzazione
- **[Database Locale](./architecture/local-database.md)** - IndexedDB e cache
- **[XMPP Integration](./architecture/xmpp-integration.md)** - Integrazione XMPP/MAM

### Diagrammi
- Coming soon

---

## 🔧 Implementazione

### Implementazioni Completate
- **[Login System](./implementation/login-system.md)** - Sistema di login con popup
- **[Sync System Complete](./implementation/sync-system-complete.md)** - Sistema di sincronizzazione completo
- **[Scrollable Containers](./implementation/scrollable-containers.md)** - Classe utility per contenitori scrollabili
  - **[Dettagli Tecnici](./implementation/scrollable-containers-implementation.md)** - Implementazione dettagliata

### Fix e Ottimizzazioni
- **[Pull-to-Refresh Fix](./fixes/pull-to-refresh-fix.md)** - Correzione pull-to-refresh
- **[Known Issues](./fixes/known-issues.md)** - Problemi noti e soluzioni

---

## 🎨 Design

- **[Design Guidelines](./design/README.md)** - Linee guida design generali
- **[Brand Identity](./design/brand-identity.md)** - Identità visiva e colori
- **[Database Architecture](./design/database-architecture.md)** - Architettura database locale

---

## 📝 Decisioni Architetturali

Documenti che spiegano le scelte architetturali importanti:

- **[No Message Deletion](./decisions/no-message-deletion.md)** - Perché non implementare cancellazione messaggi XMPP
- **[MAM Strategy](./decisions/mam-strategy.md)** - Strategia utilizzo MAM
- **[Routing Strategy](./decisions/routing-strategy.md)** - Scelta di HashRouter

---

## 🗂️ Archivio

Documenti di ricerca e analisi storiche (mantenuti per riferimento):

- **[XMPP Deletion Research](./archive/xmpp-deletion-research/)** - Ricerca su cancellazione messaggi XMPP
- **[MAM Analysis](./archive/mam-analysis/)** - Analisi approfondita MAM
- **[Old Requirements](./archive/old-requirements/)** - Requisiti originali

---

## 📋 Convenzioni

### Nomenclatura File
- `README.md` - Panoramica di cartella/modulo
- `[nome]-analysis.md` - Analisi approfondita
- `[nome]-guide.md` - Guida pratica
- `[nome]-fix.md` - Documentazione fix/correzione

### Categorie
- **guides/** - Guide pratiche
- **architecture/** - Documentazione architetturale
- **implementation/** - Dettagli implementazione
- **design/** - Design e UI/UX
- **decisions/** - ADR (Architecture Decision Records)
- **fixes/** - Bug fix e ottimizzazioni
- **archive/** - Documenti obsoleti ma conservati

---

## 🔍 Come Navigare

1. **Se sei nuovo**: Inizia dal [README](../README.md) e [Architecture Overview](./architecture/README.md)
2. **Se cerchi guide**: Vai a [📖 Guide](#guide)
3. **Se vuoi capire l'architettura**: Vai a [🏗️ Architettura](#architettura)
4. **Se cerchi dettagli implementativi**: Vai a [🔧 Implementazione](#implementazione)
5. **Se vuoi sapere il "perché"**: Vai a [📝 Decisioni Architetturali](#decisioni-architetturali)

---

**Ultimo aggiornamento**: 30 Novembre 2025  
**Versione documentazione**: 2.0
