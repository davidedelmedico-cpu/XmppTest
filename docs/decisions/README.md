# 📝 Decisioni Architetturali

Architecture Decision Records (ADR) - Documenti che spiegano decisioni architetturali importanti.

## Formato ADR

Ogni decisione è documentata seguendo questo formato:

1. **Contesto**: Qual è il problema/necessità
2. **Opzioni Considerate**: Alternative valutate
3. **Decisione**: Cosa abbiamo scelto
4. **Conseguenze**: Impatto della decisione (pros/cons)
5. **Status**: Accettata, Deprecata, Superseded

## Decisioni Documentate

### 1. No Message Deletion
- **[no-message-deletion.md](./no-message-deletion.md)**
- **Data**: Novembre 2025
- **Status**: ✅ Accettata
- **Summary**: Non implementare cancellazione messaggi XMPP

**Perché**: 
- XEP-0424 non supportato da conversations.im
- Complessità implementativa alta
- Benefici limitati per utenti finali
- Alternative esistenti (hide conversation)

### 2. MAM Global Strategy
- **Status**: ✅ Accettata  
- **Summary**: Usare query MAM globale invece di N query per contatto

**Perché**:
- Una query vs N query (efficienza)
- Cache completa locale
- Apertura chat istantanea
- Funzionamento offline

Dettagli: [../architecture/mam-global-strategy-explained.md](../architecture/mam-global-strategy-explained.md)

### 3. HashRouter vs BrowserRouter
- **Status**: ✅ Accettata
- **Summary**: Usare HashRouter per GitHub Pages compatibility

**Perché**:
- GitHub Pages è hosting statico (no server-side routing)
- BrowserRouter richiede configurazione server per SPA
- HashRouter funziona out-of-the-box
- Nessun 404 su refresh

Dettagli: [../guides/routing-system.md](../guides/routing-system.md)

### 4. IndexedDB per Cache
- **Status**: ✅ Accettata
- **Summary**: Usare IndexedDB invece di localStorage

**Perché**:
- Quota: 50MB+ vs 5-10MB
- Performance: Async vs sync blocking
- Tipi: Supporta binary (avatar) direttamente
- Scalabilità: Gestisce migliaia di messaggi

### 5. Stanza.js vs Alternative
- **Status**: ✅ Accettata
- **Summary**: Usare Stanza.js per XMPP

**Perché**:
- Manutenzione attiva
- Browser-focused (WebSocket/BOSH)
- TypeScript support
- Plugin ecosystem
- Documentazione completa

## Decisioni Future

### In Valutazione

1. **Virtual Scrolling**
   - Quando: Liste > 100 elementi
   - Libreria: react-window vs react-virtualized
   - Status: In discussione

2. **Progressive Web App**
   - Service Worker per offline completo
   - Install prompt
   - Push notifications
   - Status: In discussione

3. **End-to-End Encryption**
   - OMEMO (XEP-0384)
   - Complessità vs benefici
   - Status: Ricerca

## Come Proporre Nuove Decisioni

1. Crea issue su GitHub con tag `adr`
2. Usa template ADR
3. Discussione con team
4. Documentare decisione finale qui

## Template ADR

```markdown
# [Titolo Decisione]

**Data**: YYYY-MM-DD  
**Status**: [Proposta | Accettata | Deprecata | Superseded]  
**Deciders**: [Chi decide]

## Contesto

[Descrivi il problema o la necessità]

## Opzioni Considerate

### Opzione 1: [Nome]
- Pro: ...
- Contro: ...

### Opzione 2: [Nome]
- Pro: ...
- Contro: ...

## Decisione

[Cosa abbiamo deciso e perché]

## Conseguenze

### Positive
- ...

### Negative
- ...

### Neutral
- ...

## Note

[Informazioni aggiuntive, link, riferimenti]
```
