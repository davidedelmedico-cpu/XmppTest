# Bug Identificati nelle Ottimizzazioni

## Problemi Identificati

### 1. Conversazioni Rimosse Non Vengono Eliminate
**Problema**: Se un contatto viene rimosso dal roster o non ci sono più messaggi con lui, la conversazione rimane nel database locale ma non viene più aggiornata o rimossa.

**Scenario**:
- Utente ha conversazione con `mario@server.com` in cache
- Utente rimuove `mario@server.com` dal roster
- Nuova query MAM non trova più messaggi con `mario@server.com`
- Conversazione rimane in cache per sempre

**Soluzione**: 
- Confrontare JID trovati nella query MAM con quelli in cache
- Rimuovere conversazioni che non sono più presenti nei risultati
- Oppure: marcare come "archiviate" invece di rimuovere

### 2. Merge Problematico tra Cache e Nuovi Dati
**Problema**: Quando faccio merge tra cache e nuovi dati, potrei avere:
- Duplicati se il raggruppamento non funziona bene
- Conversazioni che dovrebbero essere aggiornate ma non lo sono
- Conversazioni con dati vecchi che sovrascrivono quelli nuovi

**Scenario**:
- Cache ha: `mario@server.com` con ultimo messaggio del 1 gennaio
- Nuova query trova: `mario@server.com` con ultimo messaggio del 15 gennaio
- Merge potrebbe non aggiornare correttamente

**Soluzione**:
- Usare Map con JID come chiave per evitare duplicati
- Confrontare timestamp e mantenere sempre il più recente
- Merge intelligente che aggiorna solo se nuovo timestamp è più recente

### 3. Aggiornamenti Incrementali Possono Perdere Conversazioni
**Problema**: Se carico solo messaggi dopo `lastSync`, potrei perdere:
- Conversazioni nuove che hanno solo messaggi vecchi (prima di lastSync)
- Conversazioni che sono state aggiornate ma il loro ultimo messaggio è prima di lastSync

**Scenario**:
- lastSync = 10 gennaio
- Nuovo contatto `luigi@server.com` mi ha scritto il 5 gennaio (prima di lastSync)
- Query incrementale non trova questo messaggio
- Conversazione con `luigi@server.com` non appare

**Soluzione**:
- Per prima query dopo login: sempre query completa (non incrementale)
- Incrementale solo per refresh manuali o automatici periodici
- Oppure: query incrementale ma anche query completa periodica (es. ogni 24h)

### 4. Ordinamento Dopo Merge
**Problema**: Dopo il merge, l'ordinamento potrebbe non essere corretto se mescolo dati vecchi e nuovi.

**Soluzione**:
- Sempre riordinare dopo merge per timestamp
- Assicurarsi che ordinamento sia fatto dopo ogni aggiornamento

### 5. Conversazioni Solo in Cache
**Problema**: Se una conversazione esiste solo in cache ma non nel server (es. contatto rimosso), rimane per sempre.

**Soluzione**:
- Confrontare JID trovati con quelli in cache
- Rimuovere o marcare come "non più attiva" quelle non trovate
- Opzionale: mantenere ma con flag "archived"

## Strategia di Fix

1. **Prima query sempre completa**: Non usare incrementale al primo login
2. **Merge intelligente**: Usare Map per evitare duplicati, confrontare timestamp
3. **Cleanup conversazioni**: Rimuovere quelle non più presenti nei risultati MAM
4. **Ordinamento sempre**: Riordinare dopo ogni merge
5. **Gestione stati**: Distinguere tra "attiva", "archived", "removed"
