# 🗂️ Archivio Documentazione

Documenti di ricerca, analisi e implementazioni storiche mantenuti per riferimento.

⚠️ **Attenzione**: I documenti in questa cartella possono essere obsoleti o superati da implementazioni più recenti. Consultare sempre prima la documentazione principale aggiornata.

## Struttura

```
archive/
├── xmpp-research/       Ricerca su feature XMPP
├── mam-analysis/        Analisi approfondite MAM (future)
└── old-docs/            Documenti sostituiti da versioni più recenti
```

---

## XMPP Research

Ricerca approfondita su feature XMPP considerate ma non implementate o implementate diversamente.

### Cancellazione Messaggi XMPP

**Cartella**: `xmpp-research/`

**Documenti**:
1. **xmpp-deletion-comprehensive-analysis.md** (577 linee)
   - Analisi completa cancellazione messaggi XMPP
   - XEP-0424 (Message Retraction)
   - Supporto server e client

2. **xmpp-hide-message-history.md** (506 linee)
   - Nascondere storico messaggi
   - Approcci tecnici
   - Limitazioni

3. **xmpp-hide-conversation-flag.md** (358 linee)
   - Flag per nascondere conversazioni
   - Implementazione locale vs server-side

4. **xmpp-message-deletion-research.md** (354 linee)
   - Ricerca generale su cancellazione
   - Alternative e workaround

5. **xep-0424-support-analysis.md** (250 linee)
   - Analisi supporto XEP-0424
   - Test su conversations.im
   - Conclusioni

**Decisione Finale**: Non implementare cancellazione messaggi  
**Rationale**: Vedere [../decisions/no-message-deletion.md](../decisions/no-message-deletion.md)

---

## Old Docs

Documenti sostituiti da versioni più recenti o consolidati in altri documenti.

### Login System

**File**: `old-docs/login-popup-analysis.md` (1036 linee)

**Sostituito da**: [../implementation/login-system.md](../implementation/login-system.md)

**Perché archiviato**: Documento molto dettagliato ma contenuto consolidato in versione più concisa e aggiornata.

**Contenuto**:
- Analisi completa implementazione LoginPopup
- Glassmorphism effects
- Routing non condizionale
- Flag logoutIntentional

### Sincronizzazione (Documenti di Lavoro)

**Files archiviati**:
1. `analisi-tecnica-refactoring.md` (502 linee)
2. `piano-refactoring-dettagliato.md` (511 linee)
3. `strategia-sincronizzazione-ottimizzata.md` (322 linee)
4. `verifica-dati-aggiornamento-conversazioni.md` (424 linee)
5. `refactoring-completato.md` (310 linee)

**Sostituiti da**: [../implementation/sync-system-complete.md](../implementation/sync-system-complete.md)

**Perché archiviati**: Documenti di lavoro durante il refactoring, ora consolidati in un unico documento completo.

**Valore storico**:
- Processo decisionale documentato
- Analisi step-by-step del refactoring
- Utile per capire il "perché" dietro le scelte

### Requirements Iniziali

**File**: `old-docs/requirements.md` (31 linee)

**Status**: Superati dall'implementazione

**Contenuto**:
- Requisiti iniziali del progetto
- Stack tecnologico scelto (React + Vite + Stanza)
- Obiettivi originali (registrazione, login, presence)

**Valore storico**: Mostra l'evoluzione del progetto da MVP a sistema completo.

### Eccezioni Codice

**File**: `old-docs/eccezioni-codice.md` (455 linee)

**Status**: Obsoleto

**Contenuto**: Lista di eccezioni e workaround per problemi specifici ora risolti.

**Perché archiviato**: Problemi ora risolti, soluzioni integrate nel codebase.

---

## Quando Consultare l'Archivio

### ✅ Consulta se:
- Vuoi capire il processo decisionale dietro una scelta
- Stai ricercando feature XMPP simili
- Vuoi vedere l'evoluzione del progetto
- Serve contesto storico per decisioni architetturali

### ❌ Non consultare se:
- Cerchi documentazione aggiornata (usa `/docs/` principale)
- Vuoi implementare una feature (usa `/docs/implementation/`)
- Cerchi guide pratiche (usa `/docs/guides/`)

---

## Manutenzione Archivio

### Quando Archiviare

Archiviare documenti quando:
1. Sono stati sostituiti da versioni più recenti
2. Riguardano feature non implementate
3. Sono documenti di lavoro completati
4. Mantengono valore storico/riferimento

### Come Archiviare

```bash
# 1. Sposta in cartella appropriata
mv docs/old-doc.md docs/archive/[categoria]/

# 2. Aggiorna INDICE.md se necessario

# 3. Aggiorna link nei documenti attivi
grep -r "old-doc.md" docs/

# 4. Documenta in questo README perché archiviato
```

### Non Eliminare

⚠️ **Mai eliminare documenti**, sempre archiviare. Il valore storico è importante per:
- Capire il "perché" dietro le decisioni
- Evitare di ripetere errori
- Onboarding nuovi sviluppatori
- Audit trail decisioni tecniche

---

## Statistiche Archivio

**Totale documenti archiviati**: 11  
**Linee totali**: ~5000  
**Categorie**: 3 (XMPP research, Old docs, MAM analysis)

**Distribuzione**:
- XMPP Research: 5 documenti (2045 linee)
- Old Docs: 6 documenti (~2900 linee)
- MAM Analysis: 0 documenti (cartella preparata per futuro)

---

## Vedere Anche

- [Documentazione Principale](../)
- [Decisioni Architetturali](../decisions/)
- [Implementation](../implementation/)
